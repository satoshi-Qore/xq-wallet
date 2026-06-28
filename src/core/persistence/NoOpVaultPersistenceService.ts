/**
 * NoOpVaultPersistenceService — transparent no-op IVaultPersistenceService.
 *
 * All mutating operations silently succeed without touching any storage backend.
 * `loadWallet()` throws VAULT_NOT_FOUND because nothing was ever persisted.
 * `listWallets()` always returns an empty array.
 * `verifyIntegrity()` always resolves with `valid: false`.
 *
 * This is the DEFAULT persistence service injected by WalletService when no
 * explicit service is provided. It preserves full backward compatibility:
 *   - `createWallet()` and `importWallet()` continue to work as pure in-memory
 *     operations (no STORAGE_UNAVAILABLE error).
 *   - New persistence-aware methods (`openWallet`, `listWallets`) will reflect
 *     the no-op behaviour (empty list, VAULT_NOT_FOUND on load attempts).
 *
 * To enable real persistence, replace this with:
 *   new VaultPersistenceService(new IndexedDBVaultAdapter())
 *
 * Architecture: P0.3 §2.3 — Null-Object pattern (silent-success variant)
 *   Contrast with NullVaultPersistenceService which throws on every mutating
 *   call — that variant is for explicit "persistence not allowed" scenarios.
 */

import { WalletError } from '../../domain/errors'
import type { EncryptedVault } from '../../domain/vault'
import type { CreateVaultParams, WalletListEntry, VerificationResult } from '../../domain/storage'
import type { IVaultPersistenceService } from './IVaultPersistenceService'

// ── No-op implementation ──────────────────────────────────────────────────────

/**
 * Silent-success persistence service — writes nothing, reads nothing.
 *
 * Replace with `VaultPersistenceService` once an `IVaultStorageAdapter` is
 * available and injected into the WalletService composition root.
 */
export class NoOpVaultPersistenceService implements IVaultPersistenceService {
  // ── IVaultPersistenceService ──────────────────────────────────────────────

  /**
   * Silent no-op — resolves immediately without writing anything.
   * The wallet continues to live in WalletService memory only.
   */
  async createWallet(
    _walletId: string,
    _encrypted: EncryptedVault,
    _params: CreateVaultParams,
  ): Promise<void> {
    // Intentional no-op. No storage backend is configured.
  }

  /**
   * Always throws VAULT_NOT_FOUND — nothing was ever stored.
   */
  async loadWallet(walletId: string): Promise<EncryptedVault> {
    throw new WalletError(
      'VAULT_NOT_FOUND',
      `No wallet found with id '${walletId}' (no-op persistence service — nothing is persisted to storage).`,
    )
  }

  /**
   * Silent no-op — nothing to delete.
   */
  async deleteWallet(_walletId: string): Promise<void> {
    // Intentional no-op. No storage backend is configured.
  }

  /**
   * Silent no-op — nothing to update in storage.
   * In-memory vault is updated separately by WalletService.
   */
  async rotatePassword(_walletId: string, _newEncrypted: EncryptedVault): Promise<void> {
    // Intentional no-op. No storage backend is configured.
  }

  /**
   * Always returns an empty array — nothing was ever persisted.
   */
  async listWallets(): Promise<WalletListEntry[]> {
    return []
  }

  /**
   * Always resolves with valid: false — no record exists to verify.
   * Never throws (per IVaultPersistenceService contract).
   */
  async verifyIntegrity(walletId: string): Promise<VerificationResult> {
    return {
      valid: false,
      walletId,
      schemaVersion: 0,
      errorCode: 'VAULT_CORRUPTED',
      errorDetail:
        'No-op persistence service — nothing is persisted to storage. ' +
        'Replace NoOpVaultPersistenceService with VaultPersistenceService to enable real persistence.',
    }
  }
}
