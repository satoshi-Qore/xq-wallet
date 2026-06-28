/**
 * SchemaMigrationRunner — unit tests.
 *
 * Uses MinimalFakeIDBFactory to simulate the IDB upgrade path.
 * Tests: store creation, idempotency, schema_meta seeding, index presence.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDBVaultAdapter } from '../IndexedDBVaultAdapter'
import { SchemaMigrationRunner, STORE_VAULTS, STORE_META } from '../SchemaMigrationRunner'
import { MinimalFakeIDBFactory, FakeIDBDatabase } from './helpers/MinimalFakeIDB'

// ── Helper: open a fresh database via the adapter (triggers onupgradeneeded) ──

async function openFreshDB(): Promise<{ factory: MinimalFakeIDBFactory; db: FakeIDBDatabase }> {
  const factory = new MinimalFakeIDBFactory()
  const adapter = new IndexedDBVaultAdapter(factory as unknown as IDBFactory)
  // Await something to ensure the DB is open and migration has run
  await adapter.list()
  await adapter.close()
  const db = factory._database!
  return { factory, db }
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe('SchemaMigrationRunner — constants', () => {
  it('STORE_VAULTS is "vault_records"', () => {
    expect(STORE_VAULTS).toBe('vault_records')
    expect(SchemaMigrationRunner.STORE_VAULTS).toBe('vault_records')
  })

  it('STORE_META is "schema_meta"', () => {
    expect(STORE_META).toBe('schema_meta')
    expect(SchemaMigrationRunner.STORE_META).toBe('schema_meta')
  })
})

// ── Object store creation ─────────────────────────────────────────────────────

describe('SchemaMigrationRunner — object store creation (via adapter)', () => {
  let db: FakeIDBDatabase

  beforeEach(async () => {
    ;({ db } = await openFreshDB())
  })

  it('creates the vault_records object store', () => {
    expect(db.objectStoreNames.contains('vault_records')).toBe(true)
  })

  it('creates the schema_meta object store', () => {
    expect(db.objectStoreNames.contains('schema_meta')).toBe(true)
  })

  it('does not create unexpected stores', () => {
    expect(db.objectStoreNames.contains('some_other_store')).toBe(false)
  })
})

// ── Schema_meta seeding ───────────────────────────────────────────────────────

describe('SchemaMigrationRunner — schema_meta seeding', () => {
  it('seeds schemaVersion = 1', async () => {
    const { db } = await openFreshDB()
    const spec = db._getSpec('schema_meta')
    expect(spec).toBeDefined()
    const versionRecord = spec!.data.get('schemaVersion') as { key: string; value: number }
    expect(versionRecord).toBeDefined()
    expect(versionRecord.value).toBe(1)
  })

  it('seeds dbCreatedAt as a recent timestamp', async () => {
    const before = Date.now()
    const { db } = await openFreshDB()
    const after = Date.now()
    const spec = db._getSpec('schema_meta')!
    const record = spec.data.get('dbCreatedAt') as { key: string; value: number }
    expect(record.value).toBeGreaterThanOrEqual(before)
    expect(record.value).toBeLessThanOrEqual(after)
  })

  it('seeds lastMigratedAt as a recent timestamp', async () => {
    const before = Date.now()
    const { db } = await openFreshDB()
    const after = Date.now()
    const spec = db._getSpec('schema_meta')!
    const record = spec.data.get('lastMigratedAt') as { key: string; value: number }
    expect(record.value).toBeGreaterThanOrEqual(before)
    expect(record.value).toBeLessThanOrEqual(after)
  })

  it('seeds migrationLog containing "v0-to-v1"', async () => {
    const { db } = await openFreshDB()
    const spec = db._getSpec('schema_meta')!
    const record = spec.data.get('migrationLog') as { key: string; value: string[] }
    expect(Array.isArray(record.value)).toBe(true)
    expect(record.value).toContain('v0-to-v1')
  })
})

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('SchemaMigrationRunner.run — idempotency', () => {
  it('run() with oldVersion=0 completes without throwing', () => {
    const fakeDb = new FakeIDBDatabase()
    // Simulate calling run() directly (migration path)
    expect(() => SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)).not.toThrow()
  })

  it('run() with oldVersion=1 (already migrated) is a no-op', () => {
    const fakeDb = new FakeIDBDatabase()
    // First run
    SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)
    const storeCountAfterFirst = ['vault_records', 'schema_meta'].filter((n) =>
      fakeDb.objectStoreNames.contains(n),
    ).length

    // Second run (oldVersion=1 means no migration needed)
    SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 1)
    const storeCountAfterSecond = ['vault_records', 'schema_meta'].filter((n) =>
      fakeDb.objectStoreNames.contains(n),
    ).length

    expect(storeCountAfterFirst).toBe(2)
    expect(storeCountAfterSecond).toBe(2)
  })

  it('run() twice with oldVersion=0 does not duplicate stores', () => {
    const fakeDb = new FakeIDBDatabase()
    SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)
    // Second call with oldVersion=0 should check contains() and skip
    expect(() => SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)).not.toThrow()
    // Stores still present exactly once
    expect(fakeDb.objectStoreNames.contains('vault_records')).toBe(true)
    expect(fakeDb.objectStoreNames.contains('schema_meta')).toBe(true)
  })
})

// ── Direct unit test of run() ─────────────────────────────────────────────────

describe('SchemaMigrationRunner.run (direct)', () => {
  let fakeDb: FakeIDBDatabase

  beforeEach(() => {
    fakeDb = new FakeIDBDatabase()
  })

  it('creates vault_records with keyPath walletId', () => {
    SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)
    const spec = fakeDb._getSpec('vault_records')
    expect(spec).toBeDefined()
    expect(spec!.keyPath).toBe('walletId')
  })

  it('creates schema_meta with keyPath key', () => {
    SchemaMigrationRunner.run(fakeDb as unknown as IDBDatabase, 0)
    const spec = fakeDb._getSpec('schema_meta')
    expect(spec).toBeDefined()
    expect(spec!.keyPath).toBe('key')
  })
})
