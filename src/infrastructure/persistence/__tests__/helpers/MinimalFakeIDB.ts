/**
 * MinimalFakeIDB — lightweight in-memory IndexedDB implementation for unit tests.
 *
 * Implements exactly the IDB surface used by IndexedDBVaultAdapter:
 *   IDBFactory.open()          → FakeIDBOpenRequest
 *   IDBDatabase.transaction()  → FakeIDBTransaction
 *   IDBDatabase.createObjectStore() → FakeIDBObjectStore (upgrade only)
 *   IDBObjectStore.add / put / get / delete / getAll / clear
 *
 * Callback timing mirrors real IDB: handlers (onerror, onsuccess, oncomplete)
 * are fired via queueMicrotask so they run after the synchronous setup code
 * (event handler assignment) in the adapter completes.
 *
 * Limitations (acceptable for unit tests):
 *   - No indexes (createIndex is a no-op)
 *   - No cursor API
 *   - No multi-store transactions
 *   - No persistence across factory instances
 *
 * Usage:
 *   const adapter = new IndexedDBVaultAdapter(new MinimalFakeIDBFactory())
 */

// ── Internal store data ────────────────────────────────────────────────────────

interface StoreSpec {
  data: Map<unknown, unknown>
  keyPath: string
}

// ── Upgrade-time object store ──────────────────────────────────────────────────
// Used inside onupgradeneeded only.  Operations are synchronous because the
// migration code does not set onsuccess/onerror on the returned requests.

class FakeUpgradeObjectStore {
  constructor(private readonly _spec: StoreSpec) {}

  /** Synchronous add — used during schema migration seed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(value: any): void {
    const key = value[this._spec.keyPath]
    this._spec.data.set(key, structuredClone(value))
  }

  createIndex(_name: string, _keyPath: string, _options?: unknown): void {
    // No-op for testing — no index queries are exercised.
  }
}

// ── Transaction-time object store ─────────────────────────────────────────────

export class FakeIDBObjectStore {
  constructor(
    private readonly _spec: StoreSpec,
    private readonly _tx: FakeIDBTransaction,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(value: any): FakeIDBRequest<unknown> {
    const req = new FakeIDBRequest<unknown>()
    this._tx._track()
    queueMicrotask(() => {
      const key = value[this._spec.keyPath]
      if (this._spec.data.has(key)) {
        req.error = new DOMException('Key already exists in the object store.', 'ConstraintError')
        req.onerror?.(makeFakeEvent())
        this._tx._done(/*failed=*/ true)
      } else {
        this._spec.data.set(key, structuredClone(value))
        req.result = key
        req.onsuccess?.(makeFakeEvent())
        this._tx._done()
      }
    })
    return req
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(value: any): FakeIDBRequest<unknown> {
    const req = new FakeIDBRequest<unknown>()
    this._tx._track()
    queueMicrotask(() => {
      const key = value[this._spec.keyPath]
      this._spec.data.set(key, structuredClone(value))
      req.result = key
      req.onsuccess?.(makeFakeEvent())
      this._tx._done()
    })
    return req
  }

  get(key: unknown): FakeIDBRequest<unknown> {
    const req = new FakeIDBRequest<unknown>()
    this._tx._track()
    queueMicrotask(() => {
      const value = this._spec.data.has(key) ? structuredClone(this._spec.data.get(key)) : undefined
      req.result = value
      req.onsuccess?.(makeFakeEvent())
      this._tx._done()
    })
    return req
  }

  delete(key: unknown): FakeIDBRequest<void> {
    const req = new FakeIDBRequest<void>()
    this._tx._track()
    queueMicrotask(() => {
      this._spec.data.delete(key)
      req.result = undefined
      req.onsuccess?.(makeFakeEvent())
      this._tx._done()
    })
    return req
  }

  getAll(): FakeIDBRequest<unknown[]> {
    const req = new FakeIDBRequest<unknown[]>()
    this._tx._track()
    queueMicrotask(() => {
      const all = Array.from(this._spec.data.values()).map((v) => structuredClone(v))
      req.result = all
      req.onsuccess?.(makeFakeEvent())
      this._tx._done()
    })
    return req
  }

  clear(): FakeIDBRequest<void> {
    const req = new FakeIDBRequest<void>()
    this._tx._track()
    queueMicrotask(() => {
      this._spec.data.clear()
      req.result = undefined
      req.onsuccess?.(makeFakeEvent())
      this._tx._done()
    })
    return req
  }

  createIndex(_name: string, _keyPath: string, _options?: unknown): void {
    // No-op.
  }
}

// ── Transaction ───────────────────────────────────────────────────────────────

export class FakeIDBTransaction {
  oncomplete: ((e: Event) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  error: DOMException | null = null

  private _pending = 0
  private _hasAny = false
  private _failed = false
  private readonly _stores: Map<string, FakeIDBObjectStore>

  constructor(db: FakeIDBDatabase, storeNames: string[]) {
    this._stores = new Map(
      storeNames.map((name) => {
        const spec = db._getSpec(name)
        if (!spec) {
          throw new DOMException(`No objectStore named '${name}'`, 'NotFoundError')
        }
        return [name, new FakeIDBObjectStore(spec, this)]
      }),
    )
  }

  objectStore(name: string): FakeIDBObjectStore {
    const s = this._stores.get(name)
    if (!s) throw new DOMException(`No objectStore named '${name}'`, 'NotFoundError')
    return s
  }

  abort(): void {
    this._failed = true
  }

  /** Called by each FakeIDBObjectStore operation at the start. */
  _track(): void {
    this._pending++
    this._hasAny = true
  }

  /** Called when a request completes (success or error). */
  _done(failed = false): void {
    if (failed) this._failed = true
    this._pending--
    if (this._pending === 0 && this._hasAny) {
      queueMicrotask(() => {
        if (this._failed) {
          this.onerror?.(makeFakeEvent())
        } else {
          this.oncomplete?.(makeFakeEvent())
        }
      })
    }
  }
}

// ── FakeIDBRequest ────────────────────────────────────────────────────────────

export class FakeIDBRequest<T> {
  onsuccess: ((e: Event) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  result: T = undefined as unknown as T
  error: DOMException | null = null
}

// ── Database ──────────────────────────────────────────────────────────────────

export class FakeIDBDatabase {
  onversionchange: ((e: Event) => void) | null = null

  private readonly _specs: Map<string, StoreSpec> = new Map()

  readonly objectStoreNames = {
    contains: (name: string): boolean => this._specs.has(name),
  }

  /** Used by SchemaMigrationRunner inside onupgradeneeded. */
  createObjectStore(name: string, options: { keyPath: string }): FakeUpgradeObjectStore {
    const spec: StoreSpec = { data: new Map(), keyPath: options.keyPath }
    this._specs.set(name, spec)
    return new FakeUpgradeObjectStore(spec)
  }

  transaction(storeNames: string[], _mode: IDBTransactionMode): FakeIDBTransaction {
    return new FakeIDBTransaction(this, storeNames)
  }

  close(): void {
    // No-op — nothing to clean up in memory.
  }

  /** Internal: retrieve a store spec by name. */
  _getSpec(name: string): StoreSpec | undefined {
    return this._specs.get(name)
  }
}

// ── Open request ──────────────────────────────────────────────────────────────

export class FakeIDBOpenRequest {
  onsuccess: ((e: Event) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onblocked: ((e: Event) => void) | null = null
  onupgradeneeded: ((e: IDBVersionChangeEvent) => void) | null = null

  result: FakeIDBDatabase = new FakeIDBDatabase()
  error: DOMException | null = null
  transaction: FakeIDBTransaction | null = null
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * MinimalFakeIDBFactory — inject this into IndexedDBVaultAdapter for unit tests.
 *
 * Each factory instance maintains its own in-memory database.  To get a fresh
 * database for each test, create a new MinimalFakeIDBFactory() in beforeEach().
 */
export class MinimalFakeIDBFactory {
  private _db: FakeIDBDatabase | null = null
  private _version = 0

  open(_name: string, version: number): FakeIDBOpenRequest {
    const req = new FakeIDBOpenRequest()
    const oldVersion = this._version

    queueMicrotask(() => {
      if (this._db === null) {
        this._db = new FakeIDBDatabase()
      }
      req.result = this._db

      if (version > oldVersion) {
        // Version upgrade needed — fire onupgradeneeded synchronously relative
        // to this microtask, then fire onsuccess in a second microtask.
        this._version = version
        const fakeEvent = {
          oldVersion,
          newVersion: version,
          target: req,
        } as unknown as IDBVersionChangeEvent
        req.onupgradeneeded?.(fakeEvent)

        queueMicrotask(() => {
          req.onsuccess?.(makeFakeEvent())
        })
      } else {
        req.onsuccess?.(makeFakeEvent())
      }
    })

    return req
  }

  /** Compatibility shim — never used in our tests. */
  deleteDatabase(_name: string): IDBOpenDBRequest {
    throw new Error('MinimalFakeIDBFactory.deleteDatabase() is not implemented.')
  }

  /** Compatibility shim — not used. */
  cmp(_first: unknown, _second: unknown): number {
    throw new Error('MinimalFakeIDBFactory.cmp() is not implemented.')
  }

  /** Expose the underlying database for direct inspection in tests. */
  get _database(): FakeIDBDatabase | null {
    return this._db
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function makeFakeEvent(): Event {
  return {} as Event
}
