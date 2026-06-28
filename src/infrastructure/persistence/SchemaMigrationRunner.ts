/**
 * SchemaMigrationRunner — IndexedDB schema setup and migration.
 *
 * Called inside the IDB `onupgradeneeded` handler (a version-change transaction).
 * Every method is synchronous because IDB upgrade transactions do not support
 * awaiting Promises.
 *
 * The runner is idempotent: each migration checks whether the target object store
 * already exists before creating it.  Existing data is never touched.
 *
 * Current schema:
 *   v0 → v1: create `vault_records` and `schema_meta` object stores.
 *
 * Architecture: P0.3 §2.4 SchemaMigrationRunner, §4 Storage Schema
 */

import { VAULT_STORAGE_SCHEMA_VERSION } from '../../domain/storage'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Primary object store for encrypted vault records. */
export const STORE_VAULTS = 'vault_records' as const
/** Metadata object store (holds schemaVersion, migration log, timestamps). */
export const STORE_META = 'schema_meta' as const

// ── Meta record shape ─────────────────────────────────────────────────────────

interface MetaRecord {
  key: string
  value: unknown
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * SchemaMigrationRunner — static utility; not instantiated.
 *
 * Usage (inside onupgradeneeded):
 *   const db  = event.target.result
 *   const tx  = event.target.transaction   // may be null for version 0→1
 *   SchemaMigrationRunner.run(db, event.oldVersion)
 */
export class SchemaMigrationRunner {
  /** IDB object store name for vault records. */
  static readonly STORE_VAULTS = STORE_VAULTS
  /** IDB object store name for schema metadata. */
  static readonly STORE_META = STORE_META

  private constructor() {
    // static-only — never instantiate
  }

  /**
   * Apply all migrations needed to go from `oldVersion` to the current schema.
   *
   * Must be called synchronously inside the `onupgradeneeded` callback.
   * The `db` object must be the `IDBDatabase` from the version-change event.
   *
   * @param db          The IDBDatabase from event.target.result.
   * @param oldVersion  The previous IDB schema version (0 if brand-new).
   */
  static run(db: IDBDatabase, oldVersion: number): void {
    if (oldVersion < 1) {
      SchemaMigrationRunner._v0ToV1(db)
    }
    // Future migrations: if (oldVersion < 2) { ... }
  }

  // ── Private migrations ──────────────────────────────────────────────────────

  /**
   * v0 → v1: create the two required object stores and seed schema_meta.
   *
   * Idempotent: skips store creation if the store already exists.
   * (Idempotency only matters in edge cases; IDB normally calls onupgradeneeded
   * exactly once per version bump.)
   */
  private static _v0ToV1(db: IDBDatabase): void {
    // ── vault_records ──────────────────────────────────────────────────────
    if (!db.objectStoreNames.contains(STORE_VAULTS)) {
      const store = db.createObjectStore(STORE_VAULTS, { keyPath: 'walletId' })
      // Indexes for future sorted reads (not used by the adapter yet).
      store.createIndex('idx_createdAt', 'encryptedVault.createdAt', { unique: false })
      store.createIndex('idx_updatedAt', 'encryptedVault.updatedAt', { unique: false })
    }

    // ── schema_meta ────────────────────────────────────────────────────────
    if (!db.objectStoreNames.contains(STORE_META)) {
      const meta = db.createObjectStore(STORE_META, { keyPath: 'key' })
      const now = Date.now()
      const seed: MetaRecord[] = [
        { key: 'schemaVersion', value: VAULT_STORAGE_SCHEMA_VERSION },
        { key: 'dbCreatedAt', value: now },
        { key: 'lastMigratedAt', value: now },
        { key: 'migrationLog', value: ['v0-to-v1'] },
      ]
      for (const record of seed) {
        // Inside onupgradeneeded the upgrade tx is active — add() is fine.
        meta.add(record)
      }
    }
  }
}
