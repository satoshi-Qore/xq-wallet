/**
 * Storage domain types — P0.3 Vault Persistence.
 *
 * Defines the shape of data written to IndexedDB and the contracts used by
 * the persistence layer.  All types in this file are safe to store — they
 * contain NO mnemonic, seed, private key, derived key, or password material.
 *
 * NEVER stored in IndexedDB:
 *   - mnemonic / BIP-39 seed
 *   - private keys (xprv, raw bytes, WIF)
 *   - PBKDF2 / AES derived key
 *   - password or any hash of a password
 *   - decrypted WalletMetadata (HD paths, account indices)
 *   - session state (unlocked / locked)
 *
 * Architecture: P0.3 design — §3 Interfaces, §4 Storage Schema
 * Security: PRIN-SEC-01, PRIN-SEC-04
 */

import type { VMType } from './chain'
import type { EncryptedVault } from './vault'

// ─── Schema Version ────────────────────────────────────────────────────────

/**
 * Current storage schema version for VaultStorageRecord.
 * Increment whenever the shape of VaultStorageRecord changes.
 * Stored inside every record so per-record lazy migration is possible.
 */
export const VAULT_STORAGE_SCHEMA_VERSION = 1 as const

/**
 * Current IndexedDB database schema version.
 * Increment to trigger IDB onupgradeneeded and run SchemaMigrationRunner.
 * Must stay in sync with IndexedDBVaultAdapter.DB_VERSION.
 */
export const IDB_SCHEMA_VERSION = 1 as const

// ─── Integrity Algorithms ──────────────────────────────────────────────────

/** Supported checksum algorithms for VaultStorageRecord.integrity */
export type IntegrityAlgorithm = 'HMAC-SHA-256'

// ─── VaultStorageRecord ────────────────────────────────────────────────────

/**
 * The canonical on-disk shape of a persisted wallet vault.
 *
 * Written to the `vault_records` IndexedDB object store by IndexedDBVaultAdapter.
 * The primary key is `walletId`.
 *
 * Security invariants:
 *   - `encryptedVault` contains only ciphertext — useless without the password.
 *   - `metadata` contains only display-safe information (name, timestamps, VM).
 *   - `integrity.checksum` is HMAC-SHA-256 of the ciphertext bytes, keyed by
 *     walletId.  It detects accidental corruption, NOT adversarial modification.
 *
 * A record is only returned to callers after VaultIntegrityChecker confirms
 * that the checksum matches the stored ciphertext.
 */
export interface VaultStorageRecord {
  /**
   * Primary key — UUID v4 generated at wallet creation.
   * Matches EncryptedVault.walletId.
   */
  readonly walletId: string

  /**
   * Format version of this record.
   * Must equal VAULT_STORAGE_SCHEMA_VERSION on creation.
   * Checked on every read; records with an unknown version are rejected.
   */
  readonly schemaVersion: typeof VAULT_STORAGE_SCHEMA_VERSION

  /**
   * The encrypted vault blob produced by VaultService.encryptVault().
   * Contains ciphertext, IV, salt, PBKDF2 parameters, and envelope metadata.
   * NEVER contains plaintext mnemonic or any derived key.
   */
  readonly encryptedVault: EncryptedVault

  /**
   * Public metadata — safe to read without decryption.
   * These fields are also returned by list() without touching the ciphertext.
   */
  readonly metadata: VaultRecordMetadata

  /**
   * Integrity protection for the ciphertext.
   * Computed by VaultIntegrityChecker on every write and verified on every read.
   */
  readonly integrity: VaultRecordIntegrity
}

/** Public, display-safe metadata stored alongside the ciphertext. */
export interface VaultRecordMetadata {
  /** User-visible wallet name — e.g. "My Wallet", "Trading Wallet". */
  readonly displayName: string
  /**
   * Primary VM of this wallet.
   * Safe to store — does not reveal key material.
   */
  readonly vm: VMType
}

/** Integrity checksum stored with every VaultStorageRecord. */
export interface VaultRecordIntegrity {
  /**
   * HMAC-SHA-256 hex digest of the raw ciphertext bytes,
   * keyed with the walletId string.
   *
   * Binding to walletId prevents a valid ciphertext from being transplanted
   * into a different wallet record without detection.
   *
   * Comparison is always performed in constant time.
   */
  readonly checksum: string
  /** Always 'HMAC-SHA-256'. Stored explicitly for future algorithm agility. */
  readonly algorithm: IntegrityAlgorithm
}

// ─── Wallet List Entry ─────────────────────────────────────────────────────

/**
 * Public summary of a stored wallet — returned by IVaultStorageAdapter.list().
 *
 * Contains NO ciphertext, NO key material, NO derivation paths.
 * Safe to display in a wallet-picker UI without decryption.
 */
export interface WalletListEntry {
  readonly walletId: string
  readonly displayName: string
  /** Unix timestamp (ms) — sourced from EncryptedVault.createdAt */
  readonly createdAt: number
  /** Unix timestamp (ms) — sourced from EncryptedVault.updatedAt */
  readonly updatedAt: number
  readonly vm: VMType
}

// ─── Verification Result ───────────────────────────────────────────────────

/**
 * Result of VaultIntegrityChecker.verify() or IVaultStorageAdapter.verify().
 *
 * When `valid` is true, the stored ciphertext matches its HMAC checksum and
 * the record's schemaVersion is known.
 *
 * When `valid` is false, `errorCode` is set to the specific failure reason.
 * The record must NOT be returned to the caller in this case.
 */
export interface VerificationResult {
  readonly valid: boolean
  readonly walletId: string
  readonly schemaVersion: number
  /**
   * Failure code — present only when valid is false.
   * Maps to a WalletErrorCode in src/domain/errors.ts.
   */
  readonly errorCode?: 'VAULT_CORRUPTED' | 'STORAGE_VERSION_MISMATCH'
  /**
   * Human-readable failure description for internal logging.
   * Must NOT be shown to the user verbatim.
   * Must NOT be forwarded to analytics or Sentry.
   */
  readonly errorDetail?: string
}

// ─── Wallet Creation Parameters ────────────────────────────────────────────

/**
 * Parameters supplied by the caller when creating a new persisted wallet.
 * Combined with EncryptedVault (from VaultService) to build VaultStorageRecord.
 */
export interface CreateVaultParams {
  /** User-visible wallet name. */
  readonly displayName: string
  /** Primary VM of this wallet. */
  readonly vm: VMType
}
