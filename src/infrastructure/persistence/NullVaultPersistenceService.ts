/**
 * NullVaultPersistenceService — no-op IVaultPersistenceService.
 *
 * Used as the default persistence service in WalletService before a real
 * IVaultStorageAdapter is wired up.  Every mutating operation throws
 * WalletError('STORAGE_UNAVAILABLE') so that calling code fails loudly
 * rather than silently losing data.
 *
 * `verifyIntegrity` is the one exception — it always resolves with
 * valid: false rather than throwing, matching the contract in IVaultPersistenceService
 * that says it "never rejects".
 *
 * Usage:
 *   // Default — used until persistence is configured
 *   const service = new NullVaultPersistenceService()
 *
 * Architecture: P0.3 §2.3 (null implementation pattern)
 */

import { WalletError } from '../../domain/errors'
import type { EncryptedVault } from '../../domain/vault'
import type { CreateVaultParams, WalletListEntry, VerificationResult } from '../../domain/storage'
import type { IVaultPersistenceService } from '../../core/persistence/IVaultPersistenceService'

// ── Null implementation ───────────────────────────────────────────────────────

/**
 * No-op persistence service that rejects every mutating call.
 *
 * Replace this with `VaultPersistenceService` once an `IVaultStorageAdapter`
 * has been configured and injected.
 */
export class NullVaultPersistenceService implements IVaultPersistenceService {
  // ── IVaultPersistenceService ─────────────────────────────────────────────

  async createWallet(
    _walletId: string,
    _encrypted: EncryptedVault,
    _params: CreateVaultParams,
  ): Promise<void> {
    throw new WalletError(
      'STORAGE_UNAVAILABLE',
      'Persistence is not configured. Replace NullVaultPersistenceService with VaultPersistenceService.',
    )
  }

  async loadWallet(_walletId: string): Promise<EncryptedVault> {
    throw new WalletError(
      'STORAGE_UNAVAILABLE',
      'Persistence is not configured. Replace NullVaultPersistenceService with VaultPersistenceService.',
    )
  }

  async deleteWallet(_walletId: string): Promise<void> {
    throw new WalletError(
      'STORAGE_UNAVAILABLE',
      'Persistence is not configured. Replace NullVaultPersistenceService with VaultPersistenceService.',
    )
  }

  async rotatePassword(_walletId: string, _newEncrypted: EncryptedVault): Promise<void> {
    throw new WalletError(
      'STORAGE_UNAVAILABLE',
      'Persistence is not configured. Replace NullVaultPersistenceService with VaultPersistenceService.',
    )
  }

  async listWallets(): Promise<WalletListEntry[]> {
    throw new WalletError(
      'STORAGE_UNAVAILABLE',
      'Persistence is not configured. Replace NullVaultPersistenceService with VaultPersistenceService.',
    )
  }

  /**
   * Always resolves — never throws (per IVaultPersistenceService contract).
   */
  async verifyIntegrity(walletId: string): Promise<VerificationResult> {
    return {
      valid: false,
      walletId,
      schemaVersion: 0,
      errorCode: 'VAULT_CORRUPTED',
      errorDetail:
        'Persistence is not configured (NullVaultPersistenceService). No record to verify.',
    }
  }
}
