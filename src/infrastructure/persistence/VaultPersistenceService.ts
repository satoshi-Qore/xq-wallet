/**
 * VaultPersistenceService — concrete IVaultPersistenceService implementation.
 *
 * Orchestrates the full encrypt-persist-verify flow for vault storage.
 * This service is the single point of coordination between:
 *   - The caller (WalletService — who encrypts before calling us)
 *   - IVaultStorageAdapter (the low-level IDB operations)
 *   - VaultIntegrityChecker (HMAC-SHA-256 checksum computation)
 *
 * Security contract (inherited from IVaultPersistenceService):
 *   - This service NEVER holds plaintext mnemonic, seed, or private key.
 *   - Callers encrypt BEFORE calling createWallet() / rotatePassword().
 *   - We only handle already-encrypted EncryptedVault blobs.
 *   - Every write is followed by a read-back integrity check.
 *   - On post-write verification failure, a compensating delete is attempted
 *     before throwing VAULT_CORRUPTED (fail-closed policy).
 *
 * Atomic guarantees:
 *   - createWallet: save() is a single IDB transaction; if it fails, nothing
 *     is written.  If save() succeeds but verify() fails, we delete() and throw.
 *   - rotatePassword: replace() is a single IDB transaction; if it fails, the
 *     original record is preserved (IDB rollback).  If replace() succeeds but
 *     verify() fails, the record is in an indeterminate state — caller receives
 *     VAULT_CORRUPTED and must re-try.
 *
 * Architecture: P0.3 §2.3 VaultPersistenceService, Clean Architecture application layer
 */

import { WalletError } from '../../domain/errors'
import { VAULT_STORAGE_SCHEMA_VERSION } from '../../domain/storage'
import type {
  CreateVaultParams,
  VaultStorageRecord,
  WalletListEntry,
  VerificationResult,
} from '../../domain/storage'
import type { EncryptedVault } from '../../domain/vault'
import type { IVaultPersistenceService } from '../../core/persistence/IVaultPersistenceService'
import type { IVaultStorageAdapter } from '../../core/persistence/IVaultStorageAdapter'
import { VaultIntegrityChecker } from './VaultIntegrityChecker'

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Production implementation of `IVaultPersistenceService`.
 *
 * ```ts
 * // Production
 * const adapter  = new IndexedDBVaultAdapter()
 * const service  = new VaultPersistenceService(adapter)
 *
 * // Tests
 * const adapter  = new IndexedDBVaultAdapter(fakeIDBFactory)
 * const checker  = new VaultIntegrityChecker()
 * const service  = new VaultPersistenceService(adapter, checker)
 * ```
 */
export class VaultPersistenceService implements IVaultPersistenceService {
  private readonly _adapter: IVaultStorageAdapter
  private readonly _checker: VaultIntegrityChecker

  constructor(
    adapter: IVaultStorageAdapter,
    checker: VaultIntegrityChecker = new VaultIntegrityChecker(),
  ) {
    this._adapter = adapter
    this._checker = checker
  }

  // ── IVaultPersistenceService ───────────────────────────────────────────────

  /**
   * Atomically create a new wallet record.
   *
   * Flow: computeChecksum → buildRecord → adapter.save → adapter.verify
   * On post-write verify failure: attempt adapter.delete (compensating tx),
   * then throw VAULT_CORRUPTED.
   */
  async createWallet(
    walletId: string,
    encrypted: EncryptedVault,
    params: CreateVaultParams,
  ): Promise<void> {
    const checksum = await this._checker.computeChecksum(encrypted.crypto.ciphertext, walletId)

    const record: VaultStorageRecord = {
      walletId,
      schemaVersion: VAULT_STORAGE_SCHEMA_VERSION,
      encryptedVault: encrypted,
      metadata: {
        displayName: params.displayName,
        vm: params.vm,
      },
      integrity: {
        checksum,
        algorithm: 'HMAC-SHA-256',
      },
    }

    // Write — throws on duplicate key, quota exceeded, or IDB unavailable.
    await this._adapter.save(record)

    // Read-back integrity verification.
    const result = await this._adapter.verify(walletId)
    if (!result.valid) {
      // Compensating delete — best-effort; ignore failure.
      try {
        await this._adapter.delete(walletId)
      } catch {
        // best-effort cleanup; swallow error
      }
      throw new WalletError(
        'VAULT_CORRUPTED',
        `Post-write integrity check failed for wallet '${walletId}'.`,
      )
    }
  }

  /**
   * Load an EncryptedVault from storage by walletId.
   *
   * The adapter.load() call performs its own integrity check.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if no record exists.
   * @throws WalletError('VAULT_CORRUPTED') if integrity check fails.
   * @throws WalletError('STORAGE_VERSION_MISMATCH') if schema is too new.
   */
  async loadWallet(walletId: string): Promise<EncryptedVault> {
    const record = await this._adapter.load(walletId)
    if (record === null) {
      throw new WalletError('VAULT_NOT_FOUND', `No wallet found with id '${walletId}'.`)
    }
    return record.encryptedVault
  }

  /**
   * Delete a wallet record from storage.
   *
   * Delegates to adapter.delete() which performs a best-effort
   * overwrite-before-delete.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if no record exists.
   */
  async deleteWallet(walletId: string): Promise<void> {
    await this._adapter.delete(walletId)
  }

  /**
   * Atomically replace an existing vault with a re-encrypted version.
   *
   * Flow: load (for metadata) → computeChecksum → buildRecord → adapter.replace → adapter.verify
   *
   * If adapter.replace() fails (IDB transaction abort), the original record
   * is preserved by IDB's rollback guarantee.
   * If replace() succeeds but verify() fails, the record is in an indeterminate
   * state — VAULT_CORRUPTED is thrown; the caller must inform the user.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if walletId does not exist.
   * @throws WalletError('VAULT_CORRUPTED') if post-replace integrity check fails.
   */
  async rotatePassword(walletId: string, newEncrypted: EncryptedVault): Promise<void> {
    // Load existing record to preserve public metadata (displayName, vm).
    const existing = await this._adapter.load(walletId)
    if (existing === null) {
      throw new WalletError('VAULT_NOT_FOUND', `No wallet found with id '${walletId}'.`)
    }

    const checksum = await this._checker.computeChecksum(newEncrypted.crypto.ciphertext, walletId)

    const newRecord: VaultStorageRecord = {
      walletId,
      schemaVersion: VAULT_STORAGE_SCHEMA_VERSION,
      encryptedVault: newEncrypted,
      metadata: existing.metadata, // preserve display name and VM type
      integrity: {
        checksum,
        algorithm: 'HMAC-SHA-256',
      },
    }

    // Atomic replace — if this fails, original is preserved.
    await this._adapter.replace(walletId, newRecord)

    // Read-back integrity verification.
    const result = await this._adapter.verify(walletId)
    if (!result.valid) {
      throw new WalletError(
        'VAULT_CORRUPTED',
        `Post-rotation integrity check failed for wallet '${walletId}'.`,
      )
    }
  }

  /**
   * Return public metadata for all stored wallets, sorted by createdAt ascending.
   * Delegates directly to adapter.list() — no decryption, no integrity check.
   */
  async listWallets(): Promise<WalletListEntry[]> {
    return this._adapter.list()
  }

  /**
   * Explicitly verify the integrity of a stored record without loading it.
   * Always resolves — never throws.
   */
  async verifyIntegrity(walletId: string): Promise<VerificationResult> {
    return this._adapter.verify(walletId)
  }
}
