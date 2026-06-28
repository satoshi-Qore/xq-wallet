/**
 * IVaultStorageAdapter — persistence port (abstract interface).
 *
 * Defines the contract between the application layer and any storage
 * back-end implementation.  This interface knows NOTHING about IndexedDB,
 * browser APIs, or encryption mechanics.
 *
 * It is the Clean Architecture "port" — the seam that makes the storage
 * implementation swappable (IndexedDB today, in-memory for tests, etc.).
 *
 * Implementations:
 *   - IndexedDBVaultAdapter  (Day 13 — infrastructure layer)
 *   - NullVaultStorageAdapter (for tests that do not need persistence)
 *
 * Security contract:
 *   - Every method that reads a record MUST run VaultIntegrityChecker.verify()
 *     before returning data to the caller.
 *   - Corrupted records MUST throw WalletError("VAULT_CORRUPTED") rather than
 *     returning partial or unverified data.
 *   - No method may ever accept plaintext mnemonic, seed, or private key as a
 *     parameter or return them to the caller.
 *
 * Architecture: P0.3 design — §2.1 VaultStorageAdapter, §3.2 VaultStoragePort
 */

import type { VaultStorageRecord, WalletListEntry, VerificationResult } from '../../domain/storage'

export interface IVaultStorageAdapter {
  /**
   * Persist a new VaultStorageRecord.
   *
   * @throws WalletError('VAULT_ALREADY_EXISTS') if walletId already exists.
   *   Use replace() intentionally if an overwrite is desired.
   * @throws WalletError('STORAGE_QUOTA_EXCEEDED') if the storage quota is full.
   * @throws WalletError('STORAGE_UNAVAILABLE') if the backend cannot be reached.
   */
  save(record: VaultStorageRecord): Promise<void>

  /**
   * Load a VaultStorageRecord by walletId.
   *
   * Runs an integrity check (HMAC-SHA-256 verification) before returning.
   *
   * @returns The record, or null if no record exists for walletId.
   * @throws WalletError('VAULT_CORRUPTED') if the integrity check fails.
   * @throws WalletError('STORAGE_VERSION_MISMATCH') if schemaVersion is unknown.
   */
  load(walletId: string): Promise<VaultStorageRecord | null>

  /**
   * Atomically replace an existing VaultStorageRecord (e.g. after password rotation).
   *
   * A single atomic write — if it fails, the original record is preserved.
   * Runs a read-back integrity check after the write succeeds.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if walletId does not exist.
   * @throws WalletError('VAULT_CORRUPTED') if the post-write integrity check fails.
   */
  replace(walletId: string, record: VaultStorageRecord): Promise<void>

  /**
   * Delete a VaultStorageRecord.
   *
   * Best-effort: overwrites the ciphertext with random bytes before deletion.
   * Physical erasure on disk is NOT guaranteed — see design §5.4 for the
   * documented limitation.
   *
   * @throws WalletError('VAULT_NOT_FOUND') if walletId does not exist.
   */
  delete(walletId: string): Promise<void>

  /**
   * Check whether a record exists for walletId.
   *
   * Does NOT run an integrity check.
   * Returns false for any error (treated as "not present" for presence-only checks).
   */
  exists(walletId: string): Promise<boolean>

  /**
   * Return public metadata for all stored wallets, sorted by createdAt ascending.
   *
   * Never returns ciphertext.  The returned entries are derived from the
   * public metadata embedded in each VaultStorageRecord.
   */
  list(): Promise<WalletListEntry[]>

  /**
   * Explicitly verify the integrity of a stored record without loading it.
   *
   * Re-reads the record and re-computes the HMAC-SHA-256 checksum.
   * Use this for health-check or post-write verification flows.
   *
   * @returns VerificationResult — always resolved, never rejects.
   *   Check result.valid to determine whether the record is intact.
   */
  verify(walletId: string): Promise<VerificationResult>

  /**
   * Wipe ALL vault records from storage.
   *
   * DANGER: this is irreversible without a mnemonic backup.
   * Intended for account reset and test teardown only.
   * Must not be exposed in normal user-facing flows.
   */
  clear(): Promise<void>
}
