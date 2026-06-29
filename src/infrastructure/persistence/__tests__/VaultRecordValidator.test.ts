/**
 * VaultRecordValidator — unit tests (Fix 3, P0.3.1).
 *
 * validateVaultRecord() is an assertion function: it either passes silently
 * or throws WalletError('VAULT_CORRUPTED').
 */

import { describe, it, expect } from 'vitest'
import { validateVaultRecord } from '../VaultRecordValidator'
import { WalletError } from '../../../domain/errors'

// ── Valid fixture ─────────────────────────────────────────────────────────────

// Build a minimal valid record factory
function makeValid(): unknown {
  return {
    walletId: 'test-wallet-id',
    schemaVersion: 1,
    encryptedVault: {
      version: 1,
      walletId: 'test-wallet-id',
      crypto: {
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2',
        iv: 'AAAAAAAAAAAAAAAA', // 16 base64 chars = 12 bytes
        salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 44 base64 chars = 32 bytes
        ciphertext: 'c29tZWNpcGhlcg==',
        kdfParams: {
          hash: 'SHA-256',
          iterations: 600_000,
          keyLength: 32,
        },
      },
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
    metadata: {
      displayName: 'My Wallet',
      vm: 'evm',
    },
    integrity: {
      checksum: 'a'.repeat(64),
      algorithm: 'HMAC-SHA-256',
    },
  }
}

// Correctly sized IV (12 bytes) and salt (32 bytes) in base64url
// 12 bytes: btoa(String.fromCharCode(...new Uint8Array(12).fill(0))) = 'AAAAAAAAAAAAAAAA'
// 32 bytes: btoa(String.fromCharCode(...new Uint8Array(32).fill(0))) = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='

function withSalt32(): string {
  // 32 zero bytes in base64url: 43 chars + '=' = 44 chars total → 32 bytes
  return 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
}

function goodRecord(): unknown {
  const r = makeValid() as Record<string, unknown>
  const ev = r['encryptedVault'] as Record<string, unknown>
  const crypto = ev['crypto'] as Record<string, unknown>
  crypto['salt'] = withSalt32()
  return r
}

// ── Passing cases ─────────────────────────────────────────────────────────────

describe('validateVaultRecord — valid records', () => {
  it('passes a fully valid record without throwing', () => {
    expect(() => validateVaultRecord(goodRecord())).not.toThrow()
  })

  it('passes with iterations=1 (test value)', () => {
    const r = goodRecord() as Record<string, unknown>
    const ev = r['encryptedVault'] as Record<string, unknown>
    const crypto = ev['crypto'] as Record<string, unknown>
    ;(crypto['kdfParams'] as Record<string, unknown>)['iterations'] = 1
    expect(() => validateVaultRecord(r)).not.toThrow()
  })

  it('passes with iterations=10 000 000 (maximum)', () => {
    const r = goodRecord() as Record<string, unknown>
    const ev = r['encryptedVault'] as Record<string, unknown>
    const crypto = ev['crypto'] as Record<string, unknown>
    ;(crypto['kdfParams'] as Record<string, unknown>)['iterations'] = 10_000_000
    expect(() => validateVaultRecord(r)).not.toThrow()
  })
})

// ── Failing cases — top-level ─────────────────────────────────────────────────

describe('validateVaultRecord — top-level field rejection', () => {
  it('rejects null', () => {
    expect(() => validateVaultRecord(null)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects a non-object', () => {
    expect(() => validateVaultRecord('string')).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects missing walletId', () => {
    const r = goodRecord() as Record<string, unknown>
    delete r['walletId']
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects empty walletId', () => {
    const r = goodRecord() as Record<string, unknown>
    r['walletId'] = ''
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects schemaVersion 0', () => {
    const r = goodRecord() as Record<string, unknown>
    r['schemaVersion'] = 0
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects non-integer schemaVersion', () => {
    const r = goodRecord() as Record<string, unknown>
    r['schemaVersion'] = 1.5
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Failing cases — encryptedVault ────────────────────────────────────────────

describe('validateVaultRecord — encryptedVault field rejection', () => {
  it('rejects missing encryptedVault', () => {
    const r = goodRecord() as Record<string, unknown>
    delete r['encryptedVault']
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects encryptedVault.version !== 1', () => {
    const r = goodRecord() as Record<string, unknown>
    ;(r['encryptedVault'] as Record<string, unknown>)['version'] = 2
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects walletId mismatch between outer and inner', () => {
    const r = goodRecord() as Record<string, unknown>
    ;(r['encryptedVault'] as Record<string, unknown>)['walletId'] = 'different-id'
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Failing cases — crypto fields ─────────────────────────────────────────────

describe('validateVaultRecord — crypto field rejection', () => {
  function withCrypto(overrides: Record<string, unknown>): unknown {
    const r = goodRecord() as Record<string, unknown>
    const ev = r['encryptedVault'] as Record<string, unknown>
    ev['crypto'] = { ...(ev['crypto'] as object), ...overrides }
    return r
  }

  it('rejects unsupported algorithm', () => {
    expect(() => validateVaultRecord(withCrypto({ algorithm: 'AES-CBC' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects unsupported kdf', () => {
    expect(() => validateVaultRecord(withCrypto({ kdf: 'scrypt' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects empty IV', () => {
    expect(() => validateVaultRecord(withCrypto({ iv: '' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects IV of wrong byte length (not 12 bytes)', () => {
    // 'AAAAAAAA' = 8 base64 chars → 6 bytes, not 12
    expect(() => validateVaultRecord(withCrypto({ iv: 'AAAAAAAA' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects empty ciphertext', () => {
    expect(() => validateVaultRecord(withCrypto({ ciphertext: '' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects salt of wrong byte length (not 32 bytes)', () => {
    // IV-length salt: 16 chars → 12 bytes, not 32
    expect(() => validateVaultRecord(withCrypto({ salt: 'AAAAAAAAAAAAAAAA' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Failing cases — kdfParams ─────────────────────────────────────────────────

describe('validateVaultRecord — kdfParams rejection', () => {
  function withKdf(overrides: Record<string, unknown>): unknown {
    const r = goodRecord() as Record<string, unknown>
    const ev = r['encryptedVault'] as Record<string, unknown>
    const crypto = ev['crypto'] as Record<string, unknown>
    crypto['kdfParams'] = { ...(crypto['kdfParams'] as object), ...overrides }
    return r
  }

  it('rejects unsupported hash', () => {
    expect(() => validateVaultRecord(withKdf({ hash: 'SHA-512' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects iterations=0', () => {
    expect(() => validateVaultRecord(withKdf({ iterations: 0 }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects negative iterations', () => {
    expect(() => validateVaultRecord(withKdf({ iterations: -1 }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects float iterations', () => {
    expect(() => validateVaultRecord(withKdf({ iterations: 1.5 }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects NaN iterations', () => {
    expect(() => validateVaultRecord(withKdf({ iterations: NaN }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects keyLength != 32', () => {
    expect(() => validateVaultRecord(withKdf({ keyLength: 16 }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Failing cases — integrity ─────────────────────────────────────────────────

describe('validateVaultRecord — integrity block rejection', () => {
  function withIntegrity(overrides: Record<string, unknown>): unknown {
    const r = goodRecord() as Record<string, unknown>
    r['integrity'] = { ...(r['integrity'] as object), ...overrides }
    return r
  }

  it('rejects a checksum shorter than 64 chars', () => {
    expect(() => validateVaultRecord(withIntegrity({ checksum: 'a'.repeat(63) }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects a checksum longer than 64 chars', () => {
    expect(() => validateVaultRecord(withIntegrity({ checksum: 'a'.repeat(65) }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects a non-hex checksum', () => {
    expect(() => validateVaultRecord(withIntegrity({ checksum: 'z'.repeat(64) }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects unsupported integrity algorithm', () => {
    expect(() => validateVaultRecord(withIntegrity({ algorithm: 'HMAC-SHA-512' }))).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects missing integrity block', () => {
    const r = goodRecord() as Record<string, unknown>
    delete r['integrity']
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Failing cases — metadata ──────────────────────────────────────────────────

describe('validateVaultRecord — metadata rejection', () => {
  it('rejects missing metadata', () => {
    const r = goodRecord() as Record<string, unknown>
    delete r['metadata']
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects non-string displayName', () => {
    const r = goodRecord() as Record<string, unknown>
    ;(r['metadata'] as Record<string, unknown>)['displayName'] = 42
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })

  it('rejects non-string vm', () => {
    const r = goodRecord() as Record<string, unknown>
    ;(r['metadata'] as Record<string, unknown>)['vm'] = null
    expect(() => validateVaultRecord(r)).toThrow(
      expect.objectContaining({ code: 'VAULT_CORRUPTED' }),
    )
  })
})

// ── Error type ────────────────────────────────────────────────────────────────

describe('validateVaultRecord — error type', () => {
  it('all thrown errors are WalletError instances', () => {
    let caught: unknown
    try {
      validateVaultRecord(null)
    } catch (e) {
      caught = e
    }
    expect(WalletError.isWalletError(caught)).toBe(true)
  })

  it('error messages do not contain sensitive data', () => {
    const r = goodRecord() as Record<string, unknown>
    const ev = r['encryptedVault'] as Record<string, unknown>
    const crypto = ev['crypto'] as Record<string, unknown>
    crypto['ciphertext'] = 'secret-sensitive-ciphertext-value'
    // Force a different failure (algorithm) so the validator stops early
    crypto['algorithm'] = 'BAD'
    let caught: Error | null = null
    try {
      validateVaultRecord(r)
    } catch (e) {
      if (e instanceof Error) caught = e
    }
    expect(caught).not.toBeNull()
    expect(caught!.message).not.toContain('secret-sensitive-ciphertext-value')
  })
})
