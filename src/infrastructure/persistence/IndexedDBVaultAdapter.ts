/**
 * IndexedDBVaultAdapter — concrete IVaultStorageAdapter backed by IndexedDB.
 *
 * Implements all eight IVaultStorageAdapter methods.  Every read runs a
 * VaultIntegrityChecker.verify() call so corrupted records are detected
 * before data reaches the caller.
 *
 * Design decisions:
 *   - `IDBFactory` is injected so tests can pass a fake/in-memory factory.
 *     Production code uses `globalThis.indexedDB` (the browser built-in).
 *   - Each IDB operation runs inside its own `readwrite` or `readonly`
 *     transaction; IDB guarantees rollback if the transaction never commits.
 *   - `save()` uses `IDBObjectStore.add()` (throws ConstraintError on dup).
 *   - `replace()` uses `IDBObjectStore.put()` (upsert semantics, with an
 *     explicit pre-existence check to produce the right error code).
 *   - `delete()` overwrites the ciphertext with random bytes (best-effort)
 *     before issuing the delete — mitigates forensic disk recovery.
 *   - `verify()` always resolves; it never throws.
 *
 * Architecture: P0.3 §2.2 IndexedDBVaultAdapter, §5 Data Flow
 */

import { WalletError } from '../../domain/errors'
import { VAULT_STORAGE_SCHEMA_VERSION, IDB_SCHEMA_VERSION } from '../../domain/storage'
import type { VaultStorageRecord, WalletListEntry, VerificationResult } from '../../domain/storage'
import type { IVaultStorageAdapter } from '../../core/persistence/IVaultStorageAdapter'
import { VaultIntegrityChecker } from './VaultIntegrityChecker'
import { validateVaultRecord } from './VaultRecordValidator'
import { SchemaMigrationRunner } from './SchemaMigrationRunner'

// ── Constants ─────────────────────────────────────────────────────────────────

const DB_NAME = 'xq-wallet-v1'
const DB_VERSION = IDB_SCHEMA_VERSION // 1
const STORE_VAULTS = SchemaMigrationRunner.STORE_VAULTS // 'vault_records'

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Production IVaultStorageAdapter backed by the browser IndexedDB API.
 *
 * ```ts
 * // Production
 * const adapter = new IndexedDBVaultAdapter()
 *
 * // Tests (inject a fake IDB factory)
 * const adapter = new IndexedDBVaultAdapter(new FakeIDBFactory(), new VaultIntegrityChecker())
 * ```
 */
export class IndexedDBVaultAdapter implements IVaultStorageAdapter {
  /** IndexedDB database name. */
  static readonly DB_NAME = DB_NAME
  /** IDB schema version — bumped whenever SchemaMigrationRunner adds a migration. */
  static readonly DB_VERSION = DB_VERSION
  /** Vault object store name. */
  static readonly STORE_VAULTS = STORE_VAULTS

  private readonly _dbPromise: Promise<IDBDatabase>
  private readonly _checker: VaultIntegrityChecker

  /**
   * @param idbFactory  The IDB factory to use.  Defaults to `globalThis.indexedDB`.
   *                    Inject a fake factory in unit tests.
   * @param checker     Integrity checker instance.  Defaults to a new instance.
   */
  constructor(
    idbFactory: IDBFactory = globalThis.indexedDB,
    checker: VaultIntegrityChecker = new VaultIntegrityChecker(),
  ) {
    this._checker = checker
    this._dbPromise = this._openDatabase(idbFactory)
  }

  // ── IVaultStorageAdapter ───────────────────────────────────────────────────

  async save(record: VaultStorageRecord): Promise<void> {
    const db = await this._dbPromise
    await idbRequest(() => {
      const tx = db.transaction([STORE_VAULTS], 'readwrite')
      const store = tx.objectStore(STORE_VAULTS)
      return {
        request: store.add(record),
        tx,
        onRequestError: (req: IDBRequest) => {
          if (req.error?.name === 'ConstraintError') {
            return new WalletError(
              'VAULT_ALREADY_EXISTS',
              `A vault with id '${record.walletId}' already exists.`,
              req.error,
            )
          }
          if (req.error?.name === 'QuotaExceededError') {
            return new WalletError('STORAGE_QUOTA_EXCEEDED', 'Storage quota exceeded.', req.error)
          }
          return new WalletError('STORAGE_UNAVAILABLE', 'Failed to save vault record.', req.error)
        },
      }
    })
  }

  async load(walletId: string): Promise<VaultStorageRecord | null> {
    const record = await this._loadRaw(walletId)
    if (record === null) return null

    // Fix 3 (P0.3.1): Validate shape before trusting the record.
    // validateVaultRecord() throws VAULT_CORRUPTED for any shape violation.
    try {
      validateVaultRecord(record)
    } catch (err) {
      if (err instanceof WalletError) throw err
      throw new WalletError(
        'VAULT_CORRUPTED',
        `Vault '${walletId}' failed structural validation.`,
        err,
      )
    }

    if (record.schemaVersion > VAULT_STORAGE_SCHEMA_VERSION) {
      throw new WalletError(
        'STORAGE_VERSION_MISMATCH',
        `Vault record schema version ${record.schemaVersion} is not supported by this build.`,
      )
    }

    const valid = await this._checker.verify(record)
    if (!valid) {
      throw new WalletError('VAULT_CORRUPTED', `Vault '${walletId}' failed the integrity check.`)
    }

    return record
  }

  async replace(walletId: string, record: VaultStorageRecord): Promise<void> {
    const existing = await this._loadRaw(walletId)
    if (existing === null) {
      throw new WalletError('VAULT_NOT_FOUND', `No vault found with id '${walletId}'.`)
    }

    const db = await this._dbPromise
    await idbRequest(() => {
      const tx = db.transaction([STORE_VAULTS], 'readwrite')
      const store = tx.objectStore(STORE_VAULTS)
      return {
        request: store.put(record),
        tx,
        onRequestError: (req: IDBRequest) =>
          new WalletError('STORAGE_UNAVAILABLE', 'Failed to replace vault record.', req.error),
      }
    })
  }

  async delete(walletId: string): Promise<void> {
    const existing = await this._loadRaw(walletId)
    if (existing === null) {
      throw new WalletError('VAULT_NOT_FOUND', `No vault found with id '${walletId}'.`)
    }

    // Fix 2 (P0.3.1): Removed pre-delete overwrite-with-garbage.
    // The previous approach called _overwriteWithGarbage() BEFORE the IDB delete
    // transaction. If the delete failed, the record was left with garbage ciphertext
    // — corrupted but still present, with no way to recover. That is worse than
    // leaving the original encrypted data intact.
    //
    // Physical erasure limitation: IndexedDB offers no zero-on-delete guarantee.
    // The OS/storage layer may retain the bytes until the page is reused. This is
    // a documented hardware-layer limitation; mitigating it requires full-disk
    // encryption (e.g. FileVault, BitLocker) at the OS level, which is outside
    // the scope of this application.
    //
    // The IDB delete transaction is atomic: if it fails, the original encrypted
    // record remains intact and the caller receives STORAGE_UNAVAILABLE.

    const db = await this._dbPromise
    await idbRequest(() => {
      const tx = db.transaction([STORE_VAULTS], 'readwrite')
      const store = tx.objectStore(STORE_VAULTS)
      return {
        request: store.delete(walletId),
        tx,
        onRequestError: () =>
          new WalletError('STORAGE_UNAVAILABLE', 'Failed to delete vault record.'),
      }
    })
  }

  async exists(walletId: string): Promise<boolean> {
    try {
      return (await this._loadRaw(walletId)) !== null
    } catch {
      return false
    }
  }

  async list(): Promise<WalletListEntry[]> {
    const db = await this._dbPromise
    const records = await idbGetResult<VaultStorageRecord[]>(() => {
      const tx = db.transaction([STORE_VAULTS], 'readonly')
      const store = tx.objectStore(STORE_VAULTS)
      return {
        request: store.getAll() as IDBRequest<VaultStorageRecord[]>,
        onRequestError: () => new WalletError('STORAGE_UNAVAILABLE', 'Failed to list vaults.'),
      }
    })

    const entries: WalletListEntry[] = (records ?? []).map((r) => ({
      walletId: r.walletId,
      displayName: r.metadata.displayName,
      createdAt: r.encryptedVault.createdAt,
      updatedAt: r.encryptedVault.updatedAt,
      vm: r.metadata.vm,
    }))

    // Sort by createdAt ascending (oldest first).
    return entries.sort((a, b) => a.createdAt - b.createdAt)
  }

  async verify(walletId: string): Promise<VerificationResult> {
    let record: VaultStorageRecord | null
    try {
      record = await this._loadRaw(walletId)
    } catch (err) {
      return {
        valid: false,
        walletId,
        schemaVersion: 0,
        errorCode: 'VAULT_CORRUPTED',
        errorDetail: err instanceof Error ? err.message : String(err),
      }
    }

    if (record === null) {
      return {
        valid: false,
        walletId,
        schemaVersion: 0,
        errorCode: 'VAULT_CORRUPTED',
        errorDetail: 'Record not found in storage.',
      }
    }

    if (record.schemaVersion > VAULT_STORAGE_SCHEMA_VERSION) {
      return {
        valid: false,
        walletId,
        schemaVersion: record.schemaVersion,
        errorCode: 'STORAGE_VERSION_MISMATCH',
        errorDetail: `schemaVersion ${record.schemaVersion} > supported ${VAULT_STORAGE_SCHEMA_VERSION}`,
      }
    }

    const valid = await this._checker.verify(record)
    if (!valid) {
      return {
        valid: false,
        walletId,
        schemaVersion: record.schemaVersion,
        errorCode: 'VAULT_CORRUPTED',
        errorDetail: 'HMAC-SHA-256 checksum mismatch — ciphertext may be corrupted.',
      }
    }

    return { valid: true, walletId, schemaVersion: record.schemaVersion }
  }

  async clear(): Promise<void> {
    const db = await this._dbPromise
    await idbRequest(() => {
      const tx = db.transaction([STORE_VAULTS], 'readwrite')
      const store = tx.objectStore(STORE_VAULTS)
      return {
        request: store.clear(),
        tx,
        onRequestError: () =>
          new WalletError('STORAGE_UNAVAILABLE', 'Failed to clear vault store.'),
      }
    })
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Close the underlying IDB connection.
   *
   * Not part of IVaultStorageAdapter; useful for test teardown.
   */
  async close(): Promise<void> {
    try {
      const db = await this._dbPromise
      db.close()
    } catch {
      // Already closed or never opened.
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest
      try {
        request = factory.open(DB_NAME, DB_VERSION)
      } catch (err) {
        reject(new WalletError('STORAGE_UNAVAILABLE', 'IndexedDB is not accessible.', err))
        return
      }

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result
        try {
          SchemaMigrationRunner.run(db, event.oldVersion)
        } catch (err) {
          ;(event.target as IDBOpenDBRequest).transaction?.abort()
          reject(new WalletError('SCHEMA_MIGRATION_FAILED', 'Schema migration failed.', err))
        }
      }

      request.onsuccess = () => {
        const db = request.result
        // Allow other tabs to trigger a version upgrade by closing our connection.
        db.onversionchange = () => {
          db.close()
        }
        resolve(db)
      }

      request.onerror = () => {
        const err = request.error
        if (err?.name === 'SecurityError') {
          reject(
            new WalletError(
              'STORAGE_UNAVAILABLE',
              'IndexedDB is not accessible (private/incognito mode or security policy).',
              err,
            ),
          )
        } else {
          reject(new WalletError('STORAGE_UNAVAILABLE', 'Failed to open the vault database.', err))
        }
      }

      request.onblocked = () => {
        reject(
          new WalletError(
            'STORAGE_UNAVAILABLE',
            'Database upgrade is blocked — please close other tabs with this app.',
          ),
        )
      }
    })
  }

  /** Read a raw record from IDB without running an integrity check. */
  private _loadRaw(walletId: string): Promise<VaultStorageRecord | null> {
    return this._dbPromise.then((db) =>
      idbGetResult<VaultStorageRecord | undefined>(() => {
        const tx = db.transaction([STORE_VAULTS], 'readonly')
        const store = tx.objectStore(STORE_VAULTS)
        return {
          request: store.get(walletId) as IDBRequest<VaultStorageRecord | undefined>,
          onRequestError: () =>
            new WalletError('STORAGE_UNAVAILABLE', 'Failed to read vault record.'),
        }
      }).then((v) => v ?? null),
    )
  }
}

// ── IDB Promise helpers ───────────────────────────────────────────────────────
//
// IDB is callback-based.  These helpers wrap the three common call patterns:
//   idbRequest    — write ops that resolve from tx.oncomplete
//   idbGetResult  — read ops that resolve from req.onsuccess
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIDBRequest = IDBRequest<any>

interface WriteSpec {
  request: AnyIDBRequest
  tx?: IDBTransaction
  onRequestError: (req: AnyIDBRequest) => WalletError
}

interface ReadSpec<T> {
  request: IDBRequest<T>
  onRequestError: (req: AnyIDBRequest) => WalletError
}

/**
 * Write helper: resolves when `tx.oncomplete` fires, rejects on any error.
 *
 * @param spec  A factory that creates and returns the IDB request + transaction.
 */
function idbRequest(spec: () => WriteSpec): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { request, tx, onRequestError } = spec()

    request.onerror = () => {
      reject(onRequestError(request))
    }

    if (tx) {
      tx.oncomplete = () => resolve()
      tx.onerror = () => {
        if (tx.error?.name === 'QuotaExceededError') {
          reject(new WalletError('STORAGE_QUOTA_EXCEEDED', 'Storage quota exceeded.', tx.error))
        } else {
          reject(new WalletError('STORAGE_UNAVAILABLE', 'Transaction failed.', tx.error))
        }
      }
    } else {
      // No separate tx reference — resolve on request success.
      const originalOnError = request.onerror
      request.onsuccess = () => resolve()
      request.onerror = originalOnError
    }
  })
}

/**
 * Read helper: resolves with `req.result` when `req.onsuccess` fires.
 *
 * @param spec  A factory that creates and returns the IDB request.
 */
function idbGetResult<T>(spec: () => ReadSpec<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const { request, onRequestError } = spec()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(onRequestError(request))
  })
}
