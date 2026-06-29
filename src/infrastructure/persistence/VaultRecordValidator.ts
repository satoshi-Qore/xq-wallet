/**
 * VaultRecordValidator — runtime validation for persisted vault records.
 *
 * Validates that a raw value loaded from IndexedDB conforms to the
 * `VaultStorageRecord` shape before it is used by the application.
 *
 * Motivation (P0.3.1, Fix 3): IndexedDB is a dynamic store — any value can
 * be written to it. Without validation, a corrupt or hand-crafted record can
 * cause non-obvious failures deep in crypto code rather than a clear error at
 * the persistence boundary. This validator enforces the full expected shape
 * and rejects records that could cause downstream misbehaviour.
 *
 * Checked invariants:
 *   - walletId: non-empty string
 *   - schemaVersion: positive integer (≥ 1)
 *   - encryptedVault.version: 1
 *   - encryptedVault.walletId: matches top-level walletId (consistency)
 *   - encryptedVault.crypto.algorithm: 'AES-GCM'
 *   - encryptedVault.crypto.kdf: 'PBKDF2'
 *   - encryptedVault.crypto.iv: non-empty string (base64url, 12-byte decoded)
 *   - encryptedVault.crypto.salt: non-empty string (base64url, 32-byte decoded)
 *   - encryptedVault.crypto.ciphertext: non-empty string
 *   - encryptedVault.crypto.kdfParams.hash: 'SHA-256'
 *   - encryptedVault.crypto.kdfParams.iterations: safe positive integer
 *   - encryptedVault.crypto.kdfParams.keyLength: 32
 *   - integrity.checksum: 64-character hex string
 *   - integrity.algorithm: 'HMAC-SHA-256'
 *   - metadata.displayName: string
 *   - metadata.vm: string
 *
 * Architecture: P0.3 §2.2 IndexedDBVaultAdapter, §5 Data Flow
 */

import { WalletError } from '../../domain/errors'
import type { VaultStorageRecord } from '../../domain/storage'

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Assert that `raw` is a well-formed `VaultStorageRecord`.
 *
 * @throws WalletError('VAULT_CORRUPTED') if any required field is absent,
 *   has the wrong type, or has an invalid value.
 */
export function validateVaultRecord(raw: unknown): asserts raw is VaultStorageRecord {
  if (raw === null || typeof raw !== 'object') {
    throw new WalletError('VAULT_CORRUPTED', 'Vault record is not an object.')
  }

  const r = raw as Record<string, unknown>

  // ── Top-level ──────────────────────────────────────────────────────────────

  if (typeof r['walletId'] !== 'string' || r['walletId'].length === 0) {
    throw new WalletError('VAULT_CORRUPTED', 'Vault record missing or empty walletId.')
  }
  const walletId = r['walletId'] as string

  if (
    typeof r['schemaVersion'] !== 'number' ||
    !Number.isInteger(r['schemaVersion']) ||
    r['schemaVersion'] < 1
  ) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' has invalid schemaVersion: ${String(r['schemaVersion'])}.`,
    )
  }

  // ── encryptedVault ─────────────────────────────────────────────────────────

  if (r['encryptedVault'] === null || typeof r['encryptedVault'] !== 'object') {
    throw new WalletError('VAULT_CORRUPTED', `Vault record '${walletId}' missing encryptedVault.`)
  }
  const ev = r['encryptedVault'] as Record<string, unknown>

  if (ev['version'] !== 1) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' encryptedVault.version must be 1 (got ${String(ev['version'])}).`,
    )
  }

  if (ev['walletId'] !== walletId) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record walletId mismatch: outer='${walletId}', inner='${String(ev['walletId'])}'.`,
    )
  }

  // ── encryptedVault.crypto ──────────────────────────────────────────────────

  if (ev['crypto'] === null || typeof ev['crypto'] !== 'object') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' missing encryptedVault.crypto.`,
    )
  }
  const crypto = ev['crypto'] as Record<string, unknown>

  if (crypto['algorithm'] !== 'AES-GCM') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' unsupported crypto algorithm: ${String(crypto['algorithm'])}.`,
    )
  }

  if (crypto['kdf'] !== 'PBKDF2') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' unsupported KDF: ${String(crypto['kdf'])}.`,
    )
  }

  // iv — 16-char base64url encodes 12 bytes
  if (
    typeof crypto['iv'] !== 'string' ||
    crypto['iv'].length === 0 ||
    !isNonEmptyBase64url(crypto['iv'])
  ) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' has invalid or missing IV.`,
    )
  }
  if (base64urlByteLength(crypto['iv'] as string) !== 12) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' IV must encode exactly 12 bytes (got ${base64urlByteLength(crypto['iv'] as string)}).`,
    )
  }

  // salt — 44-char base64url encodes 32 bytes
  if (
    typeof crypto['salt'] !== 'string' ||
    crypto['salt'].length === 0 ||
    !isNonEmptyBase64url(crypto['salt'])
  ) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' has invalid or missing salt.`,
    )
  }
  if (base64urlByteLength(crypto['salt'] as string) !== 32) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' salt must encode exactly 32 bytes (got ${base64urlByteLength(crypto['salt'] as string)}).`,
    )
  }

  // ciphertext
  if (typeof crypto['ciphertext'] !== 'string' || crypto['ciphertext'].length === 0) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' has missing or empty ciphertext.`,
    )
  }

  // ── kdfParams ──────────────────────────────────────────────────────────────

  if (crypto['kdfParams'] === null || typeof crypto['kdfParams'] !== 'object') {
    throw new WalletError('VAULT_CORRUPTED', `Vault record '${walletId}' missing kdfParams.`)
  }
  const kdf = crypto['kdfParams'] as Record<string, unknown>

  if (kdf['hash'] !== 'SHA-256') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' unsupported KDF hash: ${String(kdf['hash'])}.`,
    )
  }

  if (
    typeof kdf['iterations'] !== 'number' ||
    !Number.isInteger(kdf['iterations']) ||
    !Number.isSafeInteger(kdf['iterations']) ||
    kdf['iterations'] < 1
  ) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' kdfParams.iterations is invalid: ${String(kdf['iterations'])}.`,
    )
  }

  if (kdf['keyLength'] !== 32) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' kdfParams.keyLength must be 32 (got ${String(kdf['keyLength'])}).`,
    )
  }

  // ── integrity ─────────────────────────────────────────────────────────────

  if (r['integrity'] === null || typeof r['integrity'] !== 'object') {
    throw new WalletError('VAULT_CORRUPTED', `Vault record '${walletId}' missing integrity block.`)
  }
  const integrity = r['integrity'] as Record<string, unknown>

  if (typeof integrity['checksum'] !== 'string' || !/^[0-9a-f]{64}$/i.test(integrity['checksum'])) {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' integrity.checksum must be a 64-character hex string.`,
    )
  }

  if (integrity['algorithm'] !== 'HMAC-SHA-256') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' unsupported integrity algorithm: ${String(integrity['algorithm'])}.`,
    )
  }

  // ── metadata ──────────────────────────────────────────────────────────────

  if (r['metadata'] === null || typeof r['metadata'] !== 'object') {
    throw new WalletError('VAULT_CORRUPTED', `Vault record '${walletId}' missing metadata.`)
  }
  const meta = r['metadata'] as Record<string, unknown>

  if (typeof meta['displayName'] !== 'string') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' metadata.displayName must be a string.`,
    )
  }

  if (typeof meta['vm'] !== 'string') {
    throw new WalletError(
      'VAULT_CORRUPTED',
      `Vault record '${walletId}' metadata.vm must be a string.`,
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if `s` looks like a valid non-empty base64url string. */
function isNonEmptyBase64url(s: string): boolean {
  // base64url: [A-Za-z0-9+/=] or [A-Za-z0-9_-=] — both variants common
  return s.length > 0 && /^[A-Za-z0-9+/=_-]+$/.test(s)
}

/**
 * Returns the decoded byte length of a base64 or base64url string.
 * Formula: floor(length * 3/4) - padding bytes.
 */
function base64urlByteLength(s: string): number {
  const padded = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  return Math.floor((s.length * 3) / 4) - padded
}
