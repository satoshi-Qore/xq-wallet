/**
 * SvmChainAdapter.test.ts — Unit tests for the SVM chain adapter.
 *
 * Tests cover:
 *   - Address validation (valid base58 32-byte, invalid variants)
 *   - Address formatting (returns unchanged)
 *   - Public key extraction from AddressEntry
 *   - Sign / verify round-trip (Ed25519)
 *   - Verify returns false for tampered data
 *   - Error paths (wrong vm type, invalid public key hex)
 *
 * Known Solana address for "abandon x11 about" at index 0:
 *   GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { mnemonicToSeed } from '@scure/bip39'
import { ed25519 } from '@noble/curves/ed25519'
import { SvmChainAdapter } from '../SvmChainAdapter'
import { WalletError } from '@/domain/errors'
import { deriveEd25519PrivateKey } from '@/core/wallet/adapters/SvmAddressAdapter'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const KNOWN_SVM_ADDRESS = 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL'

const adapter = new SvmChainAdapter()

let svmPrivKey: Uint8Array
let svmPubKeyHex: string

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

beforeAll(async () => {
  const seed = await mnemonicToSeed(MNEMONIC, '')
  svmPrivKey = deriveEd25519PrivateKey(seed, 0)
  svmPubKeyHex = bytesToHex(ed25519.getPublicKey(svmPrivKey))
})

// ─── vm property ─────────────────────────────────────────────────────────

describe('vm', () => {
  it('is "svm"', () => {
    expect(adapter.vm).toBe('svm')
  })
})

// ─── isValidAddress() ─────────────────────────────────────────────────────

describe('isValidAddress()', () => {
  it('accepts a known valid Solana address', () => {
    expect(adapter.isValidAddress(KNOWN_SVM_ADDRESS)).toBe(true)
  })

  it('accepts another known valid SVM address', () => {
    expect(adapter.isValidAddress('ANf3TEKFL6jPWjzkndo4CbnNdUNkBk4KHPggJs2nu8Xi')).toBe(true)
  })

  it('rejects an EVM address (contains invalid base58 chars)', () => {
    expect(adapter.isValidAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(adapter.isValidAddress('')).toBe(false)
  })

  it('rejects a string with base58-illegal characters', () => {
    expect(adapter.isValidAddress('0OIl_not_valid!')).toBe(false)
  })

  it('rejects a base58 string that decodes to wrong length', () => {
    // base58.encode of a 16-byte buffer → decodes to 16 bytes, not 32
    expect(adapter.isValidAddress('2foobar2foobar2f')).toBe(false)
  })
})

// ─── formatAddress() ─────────────────────────────────────────────────────

describe('formatAddress()', () => {
  it('returns the address unchanged (base58 is canonical)', () => {
    expect(adapter.formatAddress(KNOWN_SVM_ADDRESS)).toBe(KNOWN_SVM_ADDRESS)
  })

  it('throws INVALID_ADDRESS for a malformed address', () => {
    let _err: unknown
    try {
      adapter.formatAddress('not-valid!!!')
    } catch (e) {
      _err = e
    }
    expect(WalletError.isWalletError(_err)).toBe(true)
    if (WalletError.isWalletError(_err)) {
      expect(_err.code).toBe('INVALID_ADDRESS')
    }
  })
})

// ─── getPublicKeyHex() ────────────────────────────────────────────────────

describe('getPublicKeyHex()', () => {
  const svmEntry = {
    vm: 'svm' as const,
    chainId: 'solana',
    address: KNOWN_SVM_ADDRESS,
    publicKeyHex: 'cafebabe',
    derivationPath: "m/44'/501'/0'",
  }

  it('returns publicKeyHex from an SVM entry', () => {
    expect(adapter.getPublicKeyHex(svmEntry)).toBe('cafebabe')
  })

  it('throws UNSUPPORTED_VM for an EVM entry', () => {
    const evmEntry = {
      vm: 'evm' as const,
      address: '0x' + 'a'.repeat(40),
      publicKeyHex: 'abc',
      derivationPath: "m/44'/60'/0'/0/0",
    }
    let _err: unknown
    try {
      adapter.getPublicKeyHex(evmEntry)
    } catch (e) {
      _err = e
    }
    expect(WalletError.isWalletError(_err)).toBe(true)
    if (WalletError.isWalletError(_err)) {
      expect(_err.code).toBe('UNSUPPORTED_VM')
    }
  })
})

// ─── sign() / verify() ────────────────────────────────────────────────────

describe('sign() / verify() round-trip', () => {
  const message = new TextEncoder().encode('Hello, Solana!')

  it('sign() returns a 64-byte Ed25519 signature', () => {
    const result = adapter.sign(svmPrivKey, message)
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
  })

  it('sign() returns lowercase hex encoding of the signature', () => {
    const result = adapter.sign(svmPrivKey, message)
    expect(result.signatureHex).toBe(bytesToHex(result.signature))
    expect(result.signatureHex).toMatch(/^[0-9a-f]{128}$/)
  })

  it('verify() returns true for a valid signature', () => {
    const { signature } = adapter.sign(svmPrivKey, message)
    expect(adapter.verify({ publicKeyHex: svmPubKeyHex, message, signature })).toBe(true)
  })

  it('verify() returns false for a tampered message', () => {
    const { signature } = adapter.sign(svmPrivKey, message)
    const tampered = new TextEncoder().encode('Hello, WRONG!')
    expect(adapter.verify({ publicKeyHex: svmPubKeyHex, message: tampered, signature })).toBe(false)
  })

  it('verify() returns false for a tampered signature', () => {
    const { signature } = adapter.sign(svmPrivKey, message)
    const tampered = new Uint8Array(signature)
    tampered[0] ^= 0xff
    expect(adapter.verify({ publicKeyHex: svmPubKeyHex, message, signature: tampered })).toBe(false)
  })

  it('verify() returns false for wrong public key', () => {
    const { signature } = adapter.sign(svmPrivKey, message)
    const wrongKey = '0'.repeat(64)
    expect(adapter.verify({ publicKeyHex: wrongKey, message, signature })).toBe(false)
  })

  it('sign() is deterministic (Ed25519 RFC 8032)', () => {
    const r1 = adapter.sign(svmPrivKey, message)
    const r2 = adapter.sign(svmPrivKey, message)
    expect(r1.signatureHex).toBe(r2.signatureHex)
  })
})
