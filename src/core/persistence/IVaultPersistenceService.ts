/**
 * IVaultPersistenceService — application-layer persistence port.
 *
 * Defines the high-level persistence contract consumed by WalletService.
 * This is a higher-level abstraction than IVaultStorageAdapter — it
 * orchestrates the encrypt → persist → verify → success sequence and
 * coordinates memory management (zeroing plaintext after use).
 *
 * Implementations:
 *   - VaultPersistenceService   (Day 14 — application layer)
 *   - NullVaultPersistenceService  (Day 14 — throws on every call;
 *       used as WalletService default until persistence is fully wired)
 *
 * Security contract:
 *   - This service NEVER receives, holds, or returns plaintext mnemonic,
 *     seed, or private key.
 *   - Callers (WalletService) perform encryption BEFORE calling createWallet().
 *   - Callers perform re-encryption BEFORE calling rotatePassword().
 *   - This service only handles already-encrypted EncryptedVault blobs.
 *
 * Architecture: P0.3 design — §2.3 VaultPersistenceService, §3.3 VaultPersistencePort
 */

import type { EncryptedVault } from '../../domain/vault'
import type { CreateVaultParams, WalletListEntry, VerificationResult } from '../../domain/storage'

export interface IVaultPersistenceService {
  /**
   * Atomically create a new wallet record in persistent storage.
   *
   * Expected caller flow:
   *   1. VaultService.encryptVault(payload, password) → EncryptedVault
   *   2. Call createWallet(walletId, encrypted, params)
   *   3. This service builds the VaultStorageRecord (including HMAC checksum)
   *   4. Calls adapter.save() → atomic IDB transaction
   *   5. Calls adapter.verify() — read-back integrity check
   *   6. Returns void on success; throws and rolls back on any failure
   *
   * @throws WalletError('VAULT_ALREADY_EXISTS') if walletId already exists.
   * @throws WalletError('VAULT_CORRUPTED') if post-write verification fails.
   * @throws WalletError('STORAGE_QUOTA_EXCEEDED') if storage is full.
   * @throws WalletError('STORAGE_UNAVAILABLE') if IndexedDB is inaccessible.
   */
  createWallet(
    walletId: string,
    encrypted: EncryptedVault,
    params: CreateVaultParams,
  ): Promise<void>

  /**
   * Load an EncryptedVault from persistent storage by walletId.
   *
   * The returned EncryptedVault is passed to VaultService.decryptVault()
   * by the caller for actual decryption.  This method never decrypts.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if no record exists.
   * @throws WalletError('VAULT_CORRUPTED') if integrity verification fails.
   * @throws WalletError('STORAGE_VERSION_MISMATCH') if the record schema is unknown.
   */
  loadWallet(walletId: string): Promise<EncryptedVault>

  /**
   * Delete a wallet record from persistent storage.
   *
   * Performs a best-effort overwrite-before-delete.  Physical data erasure
   * on disk is not guaranteed — see design §5.4 for the documented limitation.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if no record exists.
   */
  deleteWallet(walletId: string): Promise<void>

  /**
   * Atomically replace an existing vault with a re-encrypted version.
   *
   * Used for password rotation.  Expected caller flow:
   *   1. loadWallet(walletId) → EncryptedVault
   *   2. VaultService.decryptVault(encrypted, oldPassword) → plaintext
   *   3. VaultService.encryptVault(payload, newPassword) → newEncrypted
   *   4. Call rotatePassword(walletId, newEncrypted)
   *   5. This service atomically replaces the record and verifies integrity
   *   6. Caller zeros plaintext from memory in a finally block
   *
   * If any step in this method fails, the ORIGINAL record is preserved.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if walletId does not exist.
   * @throws WalletError('VAULT_CORRUPTED') if post-write verification fails.
   */
  rotatePassword(walletId: string, newEncrypted: EncryptedVault): Promise<void>

  /**
   * Return public metadata for all stored wallets, sorted by createdAt ascending.
   *
   * Never returns ciphertext or any key material.
   * Safe to call without a password.
   */
  listWallets(): Promise<WalletListEntry[]>

  /**
   * Explicitly verify the integrity of a specific wallet record.
   *
   * Useful for health checks, post-migration verification, and diagnostic flows.
   * Does not decrypt — only verifies the HMAC checksum of the stored ciphertext.
   *
   * @returns VerificationResult — always resolved, never rejects.
   */
  verifyIntegrity(walletId: string): Promise<VerificationResult>
}
