/**
 * VaultIntegrityChecker — HMAC-SHA-256 integrity for VaultStorageRecords.
 *
 * Computes and verifies a keyed checksum over the vault ciphertext.  Detects
 * accidental corruption (bit-rot, incomplete writes, IDB bugs).
 *
 * Security notes:
 *   - HMAC key is the walletId string (UTF-8) — binds the checksum to the record
 *     and prevents a valid ciphertext being transplanted into a different record.
 *   - Verification uses constant-time comparison (XOR fold) to eliminate timing
 *     side-channels that could be used to brute-force the HMAC.
 *   - This does NOT protect against an attacker who has IDB write access.
 *     Encryption (AES-256-GCM) is the primary security control; this checksum
 *     is corruption detection only.
 *
 * Architecture: P0.3 §2.3 VaultIntegrityChecker
 */

import type { VaultStorageRecord } from '../../domain/storage'

// ── Internal helpers ────────────────────────────────────────────────────────

const ALGORITHM = 'HMAC-SHA-256' as const
const subtle = (): SubtleCrypto => globalThis.crypto.subtle

/**
 * Constant-time string comparison.
 * Returns true iff a === b, regardless of string contents.
 * Both strings must already have the same length; caller must check first.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// ── Public class ─────────────────────────────────────────────────────────────

/**
 * Stateless helper — create one instance and reuse it.
 * All methods are async (Web Crypto API is Promise-based).
 */
export class VaultIntegrityChecker {
  /**
   * Compute HMAC-SHA-256 of `ciphertext`, keyed by `walletId`.
   *
   * @returns 64-character lowercase hex string (32 bytes).
   */
  async computeChecksum(ciphertext: string, walletId: string): Promise<string> {
    if (!walletId) {
      throw new Error(
        'VaultIntegrityChecker: walletId must not be empty (zero-length HMAC key is invalid)',
      )
    }
    const encoder = new TextEncoder()
    const keyMaterial = encoder.encode(walletId)
    const message = encoder.encode(ciphertext)

    const cryptoKey = await subtle().importKey(
      'raw',
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false, // not extractable
      ['sign'],
    )

    const sig = await subtle().sign('HMAC', cryptoKey, message)

    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Verify the integrity of a stored VaultStorageRecord.
   *
   * Recomputes the expected HMAC and compares it to the stored checksum using
   * constant-time comparison.
   *
   * @returns `true` if the record is intact; `false` if the ciphertext or
   *          checksum has been modified.
   */
  async verify(record: VaultStorageRecord): Promise<boolean> {
    const { walletId, encryptedVault, integrity } = record
    if (integrity.algorithm !== ALGORITHM) return false

    try {
      const expected = await this.computeChecksum(encryptedVault.crypto.ciphertext, walletId)
      return constantTimeEqual(expected, integrity.checksum)
    } catch {
      // Treat any error during HMAC computation as verification failure.
      return false
    }
  }
}
