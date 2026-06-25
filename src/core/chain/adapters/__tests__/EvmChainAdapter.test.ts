/**
 * EvmChainAdapter.test.ts — Unit tests for the EVM chain adapter.
 *
 * Tests cover:
 *   - Address validation (valid & invalid inputs)
 *   - Address formatting (EIP-55 checksum)
 *   - Public key extraction from AddressEntry
 *   - Sign / verify round-trip (secp256k1 ECDSA, keccak256 pre-hash)
 *   - Verify returns false for tampered data
 *   - Error paths (wrong vm type, invalid public key hex)
 *
 * Key derivation uses the standard BIP-39 test mnemonic:
 *   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeed } from '@scure/bip39'
import { EvmChainAdapter } from '../EvmChainAdapter'
import { WalletError } from '@/domain/errors'
import type { EVMAddressEntry } from '@/domain/wallet'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Known EVM address for MNEMONIC at index 0 — verified against multiple reference implementations
const KNOWN_EVM_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

const adapter = new EvmChainAdapter()

let evmPrivKey: Uint8Array
let evmPubKeyHex: string

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

beforeAll(async () => {
  const seed = await mnemonicToSeed(MNEMONIC, '')
  const master = HDKey.fromMasterSeed(seed)
  const child = master.derive("m/44'/60'/0'/0/0")
  evmPrivKey = new Uint8Array(child.privateKey!)
  evmPubKeyHex = bytesToHex(child.publicKey!)
})

// ─── vm property ─────────────────────────────────────────────────────────

describe('vm', () => {
  it('is "evm"', () => {
    expect(adapter.vm).toBe('evm')
  })
})

// ─── isValidAddress() ─────────────────────────────────────────────────────

describe('isValidAddress()', () => {
  it('accepts a valid EIP-55 checksummed address', () => {
    expect(adapter.isValidAddress(KNOWN_EVM_ADDRESS)).toBe(true)
  })

  it('accepts a valid lowercase address', () => {
    expect(adapter.isValidAddress('0x9858effd232b4033e47d90003d41ec34ecaeda94')).toBe(true)
  })

  it('accepts a valid uppercase address', () => {
    expect(adapter.isValidAddress('0x9858EFFD232B4033E47D90003D41EC34ECAEDA94')).toBe(true)
  })

  it('accepts zero address', () => {
    expect(adapter.isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true)
  })

  it('rejects address missing 0x prefix', () => {
    expect(adapter.isValidAddress('9858effd232b4033e47d90003d41ec34ecaeda94')).toBe(false)
  })

  it('rejects address that is too short', () => {
    expect(adapter.isValidAddress('0x9858effd')).toBe(false)
  })

  it('rejects address that is too long', () => {
    expect(adapter.isValidAddress('0x9858effd232b4033e47d90003d41ec34ecaeda94ff')).toBe(false)
  })

  it('rejects address with invalid hex character', () => {
    expect(adapter.isValidAddress('0xGGGGeffd232b4033e47d90003d41ec34ecaeda94')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(adapter.isValidAddress('')).toBe(false)
  })

  it('rejects a Solana address', () => {
    expect(adapter.isValidAddress('GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL')).toBe(false)
  })
})

// ─── formatAddress() ─────────────────────────────────────────────────────

describe('formatAddress()', () => {
  it('applies EIP-55 checksum to a lowercase address', () => {
    const result = adapter.formatAddress('0x9858effd232b4033e47d90003d41ec34ecaeda94')
    expect(result).toBe(KNOWN_EVM_ADDRESS)
  })

  it('is idempotent on an already-checksummed address', () => {
    const result = adapter.formatAddress(KNOWN_EVM_ADDRESS)
    expect(result).toBe(KNOWN_EVM_ADDRESS)
  })

  it('throws INVALID_ADDRESS for malformed input', () => {
    let _err: unknown
    try {
      adapter.formatAddress('not-an-address')
    } catch (e) {
      _err = e
    }
    expect(WalletError.isWalletError(_err)).toBe(true)
    if (WalletError.isWalletError(_err)) {
      expect(_err.code).toBe('INVALID_ADDRESS')
    }
  })

  it('returns a string starting with "0x"', () => {
    expect(adapter.formatAddress('0x' + 'a'.repeat(40))).toMatch(/^0x/)
  })
})

// ─── getPublicKeyHex() ────────────────────────────────────────────────────

describe('getPublicKeyHex()', () => {
  const evmEntry: EVMAddressEntry = {
    vm: 'evm',
    address: KNOWN_EVM_ADDRESS,
    publicKeyHex: 'deadbeef',
    derivationPath: "m/44'/60'/0'/0/0",
  }

  it('returns publicKeyHex from an EVM entry', () => {
    expect(adapter.getPublicKeyHex(evmEntry)).toBe('deadbeef')
  })

  it('throws UNSUPPORTED_VM for a native entry', () => {
    const nativeEntry = {
      vm: 'native' as const,
      chainId: 'qorechain-devnet',
      address: '0x' + 'a'.repeat(40),
      publicKeyHex: 'abc',
      derivationPath: "m/44'/9999'/0'/0/0",
    }
    let _err: unknown
    try {
      adapter.getPublicKeyHex(nativeEntry)
    } catch (e) {
      _err = e
    }
    expect(WalletError.isWalletError(_err)).toBe(true)
    if (WalletError.isWalletError(_err)) {
      expect(_err.code).toBe('UNSUPPORTED_VM')
    }
  })

  it('throws UNSUPPORTED_VM for an SVM entry', () => {
    const svmEntry = {
      vm: 'svm' as const,
      chainId: 'solana',
      address: 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL',
      publicKeyHex: 'abc',
      derivationPath: "m/44'/501'/0'",
    }
    let _err: unknown
    try {
      adapter.getPublicKeyHex(svmEntry)
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
  const message = new TextEncoder().encode('Hello, XQ Wallet!')

  it('sign() returns a 64-byte compact signature', async () => {
    const result = adapter.sign(evmPrivKey, message)
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
  })

  it('sign() returns lowercase hex encoding of the same bytes', async () => {
    const result = adapter.sign(evmPrivKey, message)
    expect(result.signatureHex).toBe(bytesToHex(result.signature))
    expect(result.signatureHex).toMatch(/^[0-9a-f]{128}$/)
  })

  it('verify() returns true for a valid signature', async () => {
    const { signature } = adapter.sign(evmPrivKey, message)
    expect(adapter.verify({ publicKeyHex: evmPubKeyHex, message, signature })).toBe(true)
  })

  it('verify() returns false for a tampered message', async () => {
    const { signature } = adapter.sign(evmPrivKey, message)
    const tampered = new TextEncoder().encode('Hello, WRONG!')
    expect(adapter.verify({ publicKeyHex: evmPubKeyHex, message: tampered, signature })).toBe(false)
  })

  it('verify() returns false for a tampered signature', async () => {
    const { signature } = adapter.sign(evmPrivKey, message)
    const tampered = new Uint8Array(signature)
    tampered[0] ^= 0xff
    expect(adapter.verify({ publicKeyHex: evmPubKeyHex, message, signature: tampered })).toBe(false)
  })

  it('verify() returns false for wrong public key', async () => {
    const wrongPubKey = '0'.repeat(66)
    const { signature } = adapter.sign(evmPrivKey, message)
    expect(adapter.verify({ publicKeyHex: wrongPubKey, message, signature })).toBe(false)
  })

  it('sign() is deterministic for the same inputs', async () => {
    const r1 = adapter.sign(evmPrivKey, message)
    const r2 = adapter.sign(evmPrivKey, message)
    // secp256k1 RFC 6979 deterministic nonce — same input always yields same sig
    expect(r1.signatureHex).toBe(r2.signatureHex)
  })
})
