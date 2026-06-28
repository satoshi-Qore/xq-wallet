/**
 * Infrastructure — Persistence barrel export.
 *
 * Import the adapter and helpers from here:
 *   import { IndexedDBVaultAdapter } from '@/infrastructure/persistence'
 *
 * Do not import directly from individual files outside this directory.
 */

export { IndexedDBVaultAdapter } from './IndexedDBVaultAdapter'
export { VaultIntegrityChecker } from './VaultIntegrityChecker'
export { SchemaMigrationRunner, STORE_VAULTS, STORE_META } from './SchemaMigrationRunner'
export { VaultPersistenceService } from './VaultPersistenceService'
export { NullVaultPersistenceService } from './NullVaultPersistenceService'
