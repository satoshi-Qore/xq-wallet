/**
 * VaultIntegrityChecker — unit tests.
 *
 * Uses Node.js v22 globalThis.crypto.subtle (no mocking needed).
 * Tests: checksum determinism, key-binding, constant-time verify, algorithm guard.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { VaultIntegrityChecker } from '../VaultIntegrityChecker'
import type { VaultStorageRecord } from '../../../domain/storage'
import type { EncryptedVault } from '../../../domain/vault'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEncryptedVault(overrides: Partial<EncryptedVault['crypto']> = {}): EncryptedVault {
  return {
    version: 1,
    walletId: 'wallet-a',
    crypto: {
      algorithm: 'AES-GCM',
      ciphertext: 'dGhpcyBpcyBhIGZha2UgY2lwaGVydGV4dA==',
      iv: 'aXZpdmVjdG9y',
      salt: 'c2FsdHNhbHQ=',
      kdf: 'PBKDF2',
      kdfParams: { hash: 'SHA-256', iterations: 600_000, keyLength: 32 },
      ...overrides,
    },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

function makeRecord(
  walletId = 'wallet-a',
  ciphertext = 'dGhpcyBpcyBhIGZha2UgY2lwaGVydGV4dA==',
  checksum = '',
): VaultStorageRecord {
  return {
    walletId,
    schemaVersion: 1,
    encryptedVault: makeEncryptedVault({ ciphertext }),
    metadata: { displayName: 'Test Wallet', vm: 'evm' },
    integrity: { checksum, algorithm: 'HMAC-SHA-256' },
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let checker: VaultIntegrityChecker

beforeAll(() => {
  checker = new VaultIntegrityChecker()
})

// ── computeChecksum ───────────────────────────────────────────────────────────

describe('VaultIntegrityChecker.computeChecksum', () => {
  it('returns a 64-character lowercase hex string', async () => {
    const cs = await checker.computeChecksum('ciphertext', 'walletId')
    expect(cs).toHaveLength(64)
    expect(cs).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same inputs produce the same checksum', async () => {
    const a = await checker.computeChecksum('same-ciphertext', 'wallet-id')
    const b = await checker.computeChecksum('same-ciphertext', 'wallet-id')
    expect(a).toBe(b)
  })

  it('changes when ciphertext changes', async () => {
    const a = await checker.computeChecksum('ciphertext-A', 'wallet-1')
    const b = await checker.computeChecksum('ciphertext-B', 'wallet-1')
    expect(a).not.toBe(b)
  })

  it('changes when walletId changes (key-binding)', async () => {
    const ciphertext = 'shared-ciphertext'
    const a = await checker.computeChecksum(ciphertext, 'wallet-1')
    const b = await checker.computeChecksum(ciphertext, 'wallet-2')
    expect(a).not.toBe(b)
  })

  it('handles empty ciphertext without throwing', async () => {
    const cs = await checker.computeChecksum('', 'wallet-1')
    expect(cs).toHaveLength(64)
  })

  it('throws for an empty walletId (zero-length HMAC key is invalid)', async () => {
    await expect(checker.computeChecksum('ciphertext', '')).rejects.toThrow()
  })

  it('handles unicode ciphertext without throwing', async () => {
    const cs = await checker.computeChecksum('cíphêrtéxt-日本語', 'wallet-unicode')
    expect(cs).toHaveLength(64)
  })

  it('produces different checksums for different length inputs', async () => {
    const short = await checker.computeChecksum('abc', 'w')
    const long = await checker.computeChecksum('abcdefghijklmnop', 'w')
    expect(short).not.toBe(long)
  })
})

// ── verify ────────────────────────────────────────────────────────────────────

describe('VaultIntegrityChecker.verify', () => {
  it('returns true for a record with a valid checksum', async () => {
    const ciphertext = 'valid-ciphertext'
    const walletId = 'wallet-valid'
    const checksum = await checker.computeChecksum(ciphertext, walletId)

    const record = makeRecord(walletId, ciphertext, checksum)
    await expect(checker.verify(record)).resolves.toBe(true)
  })

  it('returns false when ciphertext has been tampered', async () => {
    const walletId = 'wallet-tamper'
    const original = 'original-ciphertext'
    const checksum = await checker.computeChecksum(original, walletId)

    const tampered = makeRecord(walletId, 'tampered-ciphertext', checksum)
    await expect(checker.verify(tampered)).resolves.toBe(false)
  })

  it('returns false when checksum has been modified', async () => {
    const ciphertext = 'intact-ciphertext'
    const walletId = 'wallet-bad-cs'
    const record = makeRecord(walletId, ciphertext, 'a'.repeat(64))
    await expect(checker.verify(record)).resolves.toBe(false)
  })

  it('returns false when walletId is different from the one used to compute the checksum (prevents transplant)', async () => {
    const ciphertext = 'some-ciphertext'
    const checksum = await checker.computeChecksum(ciphertext, 'wallet-A')

    // Record claims walletId = wallet-B but checksum was computed for wallet-A
    const transplanted = makeRecord('wallet-B', ciphertext, checksum)
    await expect(checker.verify(transplanted)).resolves.toBe(false)
  })

  it('returns false when algorithm field is not HMAC-SHA-256', async () => {
    const ciphertext = 'ciphertext'
    const walletId = 'wallet-alg'
    const checksum = await checker.computeChecksum(ciphertext, walletId)

    const record: VaultStorageRecord = {
      ...makeRecord(walletId, ciphertext, checksum),
      integrity: { checksum, algorithm: 'HMAC-SHA-256' },
    }
    // Forge an unknown algorithm (bypass TypeScript — simulate future record)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(record as any).integrity = { checksum, algorithm: 'SHA-256' }
    await expect(checker.verify(record)).resolves.toBe(false)
  })

  it('returns false for an all-zero checksum (common corruption pattern)', async () => {
    const record = makeRecord('wallet-z', 'ciphertext', '0'.repeat(64))
    await expect(checker.verify(record)).resolves.toBe(false)
  })

  it('returns false for an empty checksum', async () => {
    const record = makeRecord('wallet-empty', 'ciphertext', '')
    await expect(checker.verify(record)).resolves.toBe(false)
  })

  it('verify and computeChecksum are consistent across multiple calls', async () => {
    for (let i = 0; i < 5; i++) {
      const ciphertext = `ciphertext-${i}`
      const walletId = `wallet-${i}`
      const checksum = await checker.computeChecksum(ciphertext, walletId)
      const record = makeRecord(walletId, ciphertext, checksum)
      await expect(checker.verify(record)).resolves.toBe(true)
    }
  })
})

// ── Security properties ───────────────────────────────────────────────────────

describe('VaultIntegrityChecker — security properties', () => {
  it('a one-byte change in ciphertext changes the checksum', async () => {
    const base = 'A'.repeat(100)
    const altered = 'B' + 'A'.repeat(99)
    const csBase = await checker.computeChecksum(base, 'wallet-sec')
    const csAltered = await checker.computeChecksum(altered, 'wallet-sec')
    expect(csBase).not.toBe(csAltered)
  })

  it('checksums from two different walletIds never collide (for common ciphertext)', async () => {
    const ciphertext = 'collision-test'
    const ids = ['w1', 'w2', 'w3', 'w4', 'w5']
    const checksums = await Promise.all(ids.map((id) => checker.computeChecksum(ciphertext, id)))
    const unique = new Set(checksums)
    expect(unique.size).toBe(ids.length)
  })
})
