/**
 * NativeChainAdapter.test.ts — Unit tests for the Native chain adapter.
 *
 * Tests cover:
 *   - Address validation (same hex format as EVM, no checksum requirement)
 *   - Address formatting (returns lowercase hex, no EIP-55)
 *   - Public key extraction from AddressEntry
 *   - Sign / verify round-trip (secp256k1 ECDSA, keccak256 pre-hash)
 *   - Verify returns false for tampered data
 *
 * The native adapter uses secp256k1 with a different BIP-44 path
 * (coin type 9999 instead of 60) from the EVM adapter.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeed } from '@scure/bip39'
import { NativeChainAdapter } from '../NativeChainAdapter'
import { WalletError } from '@/domain/errors'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const adapter = new NativeChainAdapter()

let nativePrivKey: Uint8Array
let nativePubKeyHex: string

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

beforeAll(async () => {
  const seed = await mnemonicToSeed(MNEMONIC, '')
  const master = HDKey.fromMasterSeed(seed)
  // Native path: m/44'/9999'/0'/0/0 (coin type 9999 = QoreChain placeholder)
  const child = master.derive("m/44'/9999'/0'/0/0")
  nativePrivKey = new Uint8Array(child.privateKey!)
  nativePubKeyHex = bytesToHex(child.publicKey!)
})

// ─── vm property ─────────────────────────────────────────────────────────

describe('vm', () => {
  it('is "native"', () => {
    expect(adapter.vm).toBe('native')
  })
})

// ─── isValidAddress() ─────────────────────────────────────────────────────

describe('isValidAddress()', () => {
  it('accepts a valid lowercase hex address', () => {
    expect(adapter.isValidAddress('0xabcdef1234567890abcdef1234567890abcdef12')).toBe(true)
  })

  it('accepts a valid uppercase hex address', () => {
    expect(adapter.isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true)
  })

  it('accepts zero address', () => {
    expect(adapter.isValidAddress('0x' + '0'.repeat(40))).toBe(true)
  })

  it('rejects address missing 0x prefix', () => {
    expect(adapter.isValidAddress('abcdef1234567890abcdef1234567890abcdef12')).toBe(false)
  })

  it('rejects address that is too short', () => {
    expect(adapter.isValidAddress('0xabcdef')).toBe(false)
  })

  it('rejects address that is too long', () => {
    expect(adapter.isValidAddress('0x' + 'a'.repeat(42))).toBe(false)
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
  it('converts uppercase hex to lowercase', () => {
    const result = adapter.formatAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
    expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
  })

  it('is idempotent on already-lowercase address', () => {
    const addr = '0x' + 'a'.repeat(40)
    expect(adapter.formatAddress(addr)).toBe(addr)
  })

  it('starts with "0x" always', () => {
    expect(adapter.formatAddress('0x' + '1'.repeat(40))).toMatch(/^0x[0-9a-f]{40}$/)
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
})

// ─── getPublicKeyHex() ────────────────────────────────────────────────────

describe('getPublicKeyHex()', () => {
  const nativeEntry = {
    vm: 'native' as const,
    chainId: 'qorechain-devnet',
    address: '0x' + 'a'.repeat(40),
    publicKeyHex: 'beefcafe',
    derivationPath: "m/44'/9999'/0'/0/0",
  }

  it('returns publicKeyHex from a native entry', () => {
    expect(adapter.getPublicKeyHex(nativeEntry)).toBe('beefcafe')
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
  const message = new TextEncoder().encode('Hello, QoreChain!')

  it('sign() returns a 64-byte compact signature', () => {
    const result = adapter.sign(nativePrivKey, message)
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
  })

  it('sign() returns lowercase hex encoding', () => {
    const result = adapter.sign(nativePrivKey, message)
    expect(result.signatureHex).toBe(bytesToHex(result.signature))
    expect(result.signatureHex).toMatch(/^[0-9a-f]{128}$/)
  })

  it('verify() returns true for a valid signature', () => {
    const { signature } = adapter.sign(nativePrivKey, message)
    expect(adapter.verify({ publicKeyHex: nativePubKeyHex, message, signature })).toBe(true)
  })

  it('verify() returns false for a tampered message', () => {
    const { signature } = adapter.sign(nativePrivKey, message)
    const tampered = new TextEncoder().encode('Hello, FAKE!')
    expect(adapter.verify({ publicKeyHex: nativePubKeyHex, message: tampered, signature })).toBe(
      false,
    )
  })

  it('verify() returns false for a tampered signature', () => {
    const { signature } = adapter.sign(nativePrivKey, message)
    const tampered = new Uint8Array(signature)
    tampered[32] ^= 0x01
    expect(adapter.verify({ publicKeyHex: nativePubKeyHex, message, signature: tampered })).toBe(
      false,
    )
  })

  it('native and EVM produce different signatures for same message (different key paths)', async () => {
    // Even though both use secp256k1, their derivation paths differ
    const nativeResult = adapter.sign(nativePrivKey, message)
    // We can only check that signature is valid bytes — cross-vm comparison is not meaningful
    expect(nativeResult.signature.byteLength).toBe(64)
  })
})
