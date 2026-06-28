/**
 * Persistence layer barrel export.
 *
 * Import persistence interfaces from here:
 *   import type { IVaultStorageAdapter } from '@/core/persistence'
 *   import type { IVaultPersistenceService } from '@/core/persistence'
 *
 * Do not import from individual files outside of core/persistence/ itself.
 *
 * Architecture: P0.3 — Day 12 Domain Extension & Port Definition
 */

export type { IVaultStorageAdapter } from './IVaultStorageAdapter'
export type { IVaultPersistenceService } from './IVaultPersistenceService'
export { NoOpVaultPersistenceService } from './NoOpVaultPersistenceService'
