/**
 * storage.test.ts — Unit tests for P0.3 storage domain types.
 *
 * Covers:
 *   - VaultStorageRecord shape validation
 *   - WalletListEntry shape validation
 *   - VerificationResult shape validation
 *   - CreateVaultParams shape validation
 *   - Schema version constants
 *   - WalletErrorCode completeness for all P0.3 storage codes
 *   - Compile-time interface checks (assignment compatibility)
 *
 * No IndexedDB, no browser APIs, no implementation classes.
 */

import { describe, it, expect } from 'vitest'
import type { WalletErrorCode } from '../errors'
import { WalletError } from '../errors'
import { VAULT_STORAGE_SCHEMA_VERSION, IDB_SCHEMA_VERSION } from '../storage'
import type {
  VaultStorageRecord,
  VaultRecordMetadata,
  VaultRecordIntegrity,
  WalletListEntry,
  VerificationResult,
  CreateVaultParams,
  IntegrityAlgorithm,
} from '../storage'
import type { EncryptedVault } from '../vault'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const MOCK_ENCRYPTED_VAULT: EncryptedVault = {
  version: 1,
  walletId: 'wallet-uuid-0001',
  crypto: {
    algorithm: 'AES-GCM',
    ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
    iv: 'dGVzdC1pdg==',
    salt: 'dGVzdC1zYWx0',
    kdf: 'PBKDF2',
    kdfParams: {
      hash: 'SHA-256',
      iterations: 600_000,
      keyLength: 32,
    },
  },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
}

const MOCK_METADATA: VaultRecordMetadata = {
  displayName: 'My Wallet',
  vm: 'evm',
}

const MOCK_INTEGRITY: VaultRecordIntegrity = {
  checksum: 'a'.repeat(64),
  algorithm: 'HMAC-SHA-256',
}

const MOCK_RECORD: VaultStorageRecord = {
  walletId: 'wallet-uuid-0001',
  schemaVersion: 1,
  encryptedVault: MOCK_ENCRYPTED_VAULT,
  metadata: MOCK_METADATA,
  integrity: MOCK_INTEGRITY,
}

// ─── Schema Version Constants ──────────────────────────────────────────────

describe('schema version constants', () => {
  it('VAULT_STORAGE_SCHEMA_VERSION is 1', () => {
    expect(VAULT_STORAGE_SCHEMA_VERSION).toBe(1)
  })

  it('IDB_SCHEMA_VERSION is 1', () => {
    expect(IDB_SCHEMA_VERSION).toBe(1)
  })

  it('VAULT_STORAGE_SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(VAULT_STORAGE_SCHEMA_VERSION)).toBe(true)
    expect(VAULT_STORAGE_SCHEMA_VERSION).toBeGreaterThan(0)
  })
})

// ─── VaultStorageRecord ────────────────────────────────────────────────────

describe('VaultStorageRecord', () => {
  it('has required walletId field', () => {
    expect(MOCK_RECORD.walletId).toBe('wallet-uuid-0001')
  })

  it('schemaVersion matches VAULT_STORAGE_SCHEMA_VERSION', () => {
    expect(MOCK_RECORD.schemaVersion).toBe(VAULT_STORAGE_SCHEMA_VERSION)
  })

  it('encryptedVault is present and has AES-GCM algorithm', () => {
    expect(MOCK_RECORD.encryptedVault.crypto.algorithm).toBe('AES-GCM')
  })

  it('encryptedVault.walletId matches record.walletId', () => {
    expect(MOCK_RECORD.encryptedVault.walletId).toBe(MOCK_RECORD.walletId)
  })

  it('metadata.displayName is a non-empty string', () => {
    expect(typeof MOCK_RECORD.metadata.displayName).toBe('string')
    expect(MOCK_RECORD.metadata.displayName.length).toBeGreaterThan(0)
  })

  it('metadata.vm is a valid VMType', () => {
    const validVMs = ['evm', 'svm', 'native'] as const
    expect(validVMs).toContain(MOCK_RECORD.metadata.vm)
  })

  it('integrity.algorithm is HMAC-SHA-256', () => {
    expect(MOCK_RECORD.integrity.algorithm).toBe('HMAC-SHA-256')
  })

  it('integrity.checksum is a non-empty string', () => {
    expect(typeof MOCK_RECORD.integrity.checksum).toBe('string')
    expect(MOCK_RECORD.integrity.checksum.length).toBeGreaterThan(0)
  })

  it('record does NOT contain mnemonic field', () => {
    expect('mnemonic' in MOCK_RECORD).toBe(false)
  })

  it('record does NOT contain privateKey field', () => {
    expect('privateKey' in MOCK_RECORD).toBe(false)
  })

  it('record does NOT contain password field', () => {
    expect('password' in MOCK_RECORD).toBe(false)
  })

  it('record does NOT contain seed field', () => {
    expect('seed' in MOCK_RECORD).toBe(false)
  })

  it('accepts all valid VMType values for metadata.vm', () => {
    const evmRecord: VaultStorageRecord = {
      ...MOCK_RECORD,
      metadata: { ...MOCK_METADATA, vm: 'evm' },
    }
    const svmRecord: VaultStorageRecord = {
      ...MOCK_RECORD,
      metadata: { ...MOCK_METADATA, vm: 'svm' },
    }
    const nativeRecord: VaultStorageRecord = {
      ...MOCK_RECORD,
      metadata: { ...MOCK_METADATA, vm: 'native' },
    }
    expect(evmRecord.metadata.vm).toBe('evm')
    expect(svmRecord.metadata.vm).toBe('svm')
    expect(nativeRecord.metadata.vm).toBe('native')
  })
})

// ─── VaultRecordIntegrity ──────────────────────────────────────────────────

describe('VaultRecordIntegrity', () => {
  it('algorithm is always HMAC-SHA-256', () => {
    const algo: IntegrityAlgorithm = 'HMAC-SHA-256'
    expect(algo).toBe('HMAC-SHA-256')
  })

  it('checksum is a hex string', () => {
    // 64-char hex = 32 bytes = SHA-256 output length
    const hexChecksum = 'a'.repeat(64)
    const integrity: VaultRecordIntegrity = {
      checksum: hexChecksum,
      algorithm: 'HMAC-SHA-256',
    }
    expect(integrity.checksum).toHaveLength(64)
    expect(/^[0-9a-f]+$/i.test(integrity.checksum)).toBe(true)
  })
})

// ─── WalletListEntry ───────────────────────────────────────────────────────

describe('WalletListEntry', () => {
  const entry: WalletListEntry = {
    walletId: 'wallet-uuid-0001',
    displayName: 'My Wallet',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000,
    vm: 'evm',
  }

  it('has walletId, displayName, createdAt, updatedAt, vm', () => {
    expect(entry.walletId).toBe('wallet-uuid-0001')
    expect(entry.displayName).toBe('My Wallet')
    expect(typeof entry.createdAt).toBe('number')
    expect(typeof entry.updatedAt).toBe('number')
    expect(entry.vm).toBe('evm')
  })

  it('updatedAt >= createdAt', () => {
    expect(entry.updatedAt).toBeGreaterThanOrEqual(entry.createdAt)
  })

  it('does NOT contain ciphertext field', () => {
    expect('ciphertext' in entry).toBe(false)
  })

  it('does NOT contain encryptedVault field', () => {
    expect('encryptedVault' in entry).toBe(false)
  })
})

// ─── VerificationResult ────────────────────────────────────────────────────

describe('VerificationResult', () => {
  it('valid result has valid: true and no errorCode', () => {
    const result: VerificationResult = {
      valid: true,
      walletId: 'wallet-uuid-0001',
      schemaVersion: 1,
    }
    expect(result.valid).toBe(true)
    expect(result.errorCode).toBeUndefined()
  })

  it('invalid result has valid: false and errorCode set', () => {
    const result: VerificationResult = {
      valid: false,
      walletId: 'wallet-uuid-0001',
      schemaVersion: 1,
      errorCode: 'VAULT_CORRUPTED',
      errorDetail: 'HMAC checksum mismatch',
    }
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VAULT_CORRUPTED')
    expect(typeof result.errorDetail).toBe('string')
  })

  it('invalid result accepts STORAGE_VERSION_MISMATCH errorCode', () => {
    const result: VerificationResult = {
      valid: false,
      walletId: 'wallet-uuid-0001',
      schemaVersion: 99,
      errorCode: 'STORAGE_VERSION_MISMATCH',
      errorDetail: 'schemaVersion 99 not supported',
    }
    expect(result.errorCode).toBe('STORAGE_VERSION_MISMATCH')
  })

  it('walletId is always present regardless of valid', () => {
    const valid: VerificationResult = { valid: true, walletId: 'w1', schemaVersion: 1 }
    const invalid: VerificationResult = {
      valid: false,
      walletId: 'w1',
      schemaVersion: 1,
      errorCode: 'VAULT_CORRUPTED',
    }
    expect(valid.walletId).toBe('w1')
    expect(invalid.walletId).toBe('w1')
  })
})

// ─── CreateVaultParams ─────────────────────────────────────────────────────

describe('CreateVaultParams', () => {
  it('requires displayName and vm', () => {
    const params: CreateVaultParams = {
      displayName: 'Trading Wallet',
      vm: 'svm',
    }
    expect(params.displayName).toBe('Trading Wallet')
    expect(params.vm).toBe('svm')
  })

  it('accepts all valid VMType values', () => {
    const evmParams: CreateVaultParams = { displayName: 'EVM', vm: 'evm' }
    const svmParams: CreateVaultParams = { displayName: 'SVM', vm: 'svm' }
    const nativeParams: CreateVaultParams = { displayName: 'Native', vm: 'native' }
    expect(evmParams.vm).toBe('evm')
    expect(svmParams.vm).toBe('svm')
    expect(nativeParams.vm).toBe('native')
  })
})

// ─── WalletErrorCode — storage completeness ────────────────────────────────

describe('WalletErrorCode storage codes', () => {
  // These tests verify that all P0.3 storage error codes can be constructed
  // and caught via WalletError.isWalletError().  They also serve as a
  // compile-time guarantee that the codes exist in the WalletErrorCode union.

  const storageCodes: WalletErrorCode[] = [
    'STORAGE_UNAVAILABLE',
    'STORAGE_QUOTA_EXCEEDED',
    'STORAGE_SCHEMA_ERROR',
    'VAULT_ALREADY_EXISTS',
    'SCHEMA_MIGRATION_FAILED',
    'STORAGE_VERSION_MISMATCH',
    'VAULT_NOT_FOUND',
    'VAULT_CORRUPTED',
  ]

  it('all P0.3 storage codes exist in WalletErrorCode union (compile-time)', () => {
    // If any code were missing from the union, this assignment would fail
    // TypeScript type-checking at build time.
    expect(storageCodes).toHaveLength(8)
  })

  it.each(storageCodes)('WalletError can be constructed with code %s', (code) => {
    const err = new WalletError(code, 'Test message.')
    expect(err.code).toBe(code)
    expect(err.message).toBe('Test message.')
    expect(WalletError.isWalletError(err)).toBe(true)
  })

  it.each(storageCodes)('WalletError(%s) has name "WalletError"', (code) => {
    const err = new WalletError(code, 'msg')
    expect(err.name).toBe('WalletError')
  })

  it('VAULT_ALREADY_EXISTS is a valid WalletErrorCode', () => {
    const err = new WalletError('VAULT_ALREADY_EXISTS', 'Wallet already exists.')
    expect(err.code).toBe('VAULT_ALREADY_EXISTS')
  })

  it('SCHEMA_MIGRATION_FAILED is a valid WalletErrorCode', () => {
    const err = new WalletError('SCHEMA_MIGRATION_FAILED', 'Migration failed.')
    expect(err.code).toBe('SCHEMA_MIGRATION_FAILED')
  })

  it('STORAGE_VERSION_MISMATCH is a valid WalletErrorCode', () => {
    const err = new WalletError('STORAGE_VERSION_MISMATCH', 'Schema version unsupported.')
    expect(err.code).toBe('STORAGE_VERSION_MISMATCH')
  })

  it('WalletError.isWalletError returns false for plain Error', () => {
    expect(WalletError.isWalletError(new Error('plain'))).toBe(false)
  })

  it('WalletError.isWalletError returns false for non-errors', () => {
    expect(WalletError.isWalletError('string')).toBe(false)
    expect(WalletError.isWalletError(null)).toBe(false)
    expect(WalletError.isWalletError(undefined)).toBe(false)
    expect(WalletError.isWalletError(42)).toBe(false)
  })

  it('internalCause is preserved on WalletError', () => {
    const cause = new Error('original')
    const err = new WalletError('VAULT_CORRUPTED', 'Safe message.', cause)
    expect(err.internalCause).toBe(cause)
    // internalCause must not appear in .message
    expect(err.message).not.toContain('original')
  })
})

// ─── Barrel export completeness ────────────────────────────────────────────

describe('domain/index.ts barrel exports', () => {
  it('re-exports VAULT_STORAGE_SCHEMA_VERSION', async () => {
    const domain = await import('../index')
    expect(domain.VAULT_STORAGE_SCHEMA_VERSION).toBe(1)
  })

  it('re-exports IDB_SCHEMA_VERSION', async () => {
    const domain = await import('../index')
    expect(domain.IDB_SCHEMA_VERSION).toBe(1)
  })
})
