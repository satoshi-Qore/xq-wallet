/**
 * hd.test.ts — Unit tests for BIP-32 HD key derivation.
 *
 * BIP-32 test vectors from the official specification:
 *   https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#Test_Vectors
 *
 * We verify:
 *   1. createMasterNode produces a valid HDKey with the expected properties
 *   2. derivePath produces child keys with correct depth and public key presence
 *   3. publicKeyToHex encodes correctly
 *   4. Error paths throw correct WalletError codes
 */

import { describe, it, expect } from 'vitest'
import { createMasterNode, derivePath, publicKeyToHex } from '../hd'
import { mnemonicToSeed } from '../seed'
import { WalletError } from '@/domain/errors'

// ─── BIP-32 Test Vector 1 ─────────────────────────────────────────────────────
// Seed (hex): 000102030405060708090a0b0c0d0e0f
// Source: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#test-vector-1
const BIP32_VECTOR_1_SEED = Uint8Array.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  // BIP-32 test seeds are 16 bytes; pad to 64 for HDKey.fromMasterSeed
  // Note: HDKey.fromMasterSeed in @scure/bip32 accepts any length ≥ 16
  // but our wrapper requires exactly 64 bytes (BIP-39 seed length).
  // We use the BIP-39 → seed pipeline for integration tests below.
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

// ─── Known BIP-39 mnemonic → seed pipeline ────────────────────────────────────
const KNOWN_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// ─── createMasterNode() ───────────────────────────────────────────────────────

describe('createMasterNode()', () => {
  it('returns an HDKey instance from a 64-byte seed', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(node).toBeDefined()
    expect(typeof node.derive).toBe('function')
  })

  it('master node has depth 0', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(node.depth).toBe(0)
  })

  it('master node has index 0', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(node.index).toBe(0)
  })

  it('master node has a 33-byte compressed public key', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(node.publicKey).toBeInstanceOf(Uint8Array)
    expect(node.publicKey?.length).toBe(33)
  })

  it('master node has a 32-byte private key', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(node.privateKey).toBeInstanceOf(Uint8Array)
    expect(node.privateKey?.length).toBe(32)
  })

  it('master node public key starts with 02 or 03 (compressed prefix)', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    const prefix = node.publicKey![0]
    expect(prefix === 0x02 || prefix === 0x03).toBe(true)
  })

  it('is deterministic — same seed gives same public key', () => {
    const node1 = createMasterNode(BIP32_VECTOR_1_SEED)
    const node2 = createMasterNode(BIP32_VECTOR_1_SEED)
    expect(publicKeyToHex(node1.publicKey!)).toBe(publicKeyToHex(node2.publicKey!))
  })

  it('produces different master nodes for different seeds', () => {
    const seedA = new Uint8Array(64).fill(0)
    const seedB = new Uint8Array(64).fill(1)
    const nodeA = createMasterNode(seedA)
    const nodeB = createMasterNode(seedB)
    expect(publicKeyToHex(nodeA.publicKey!)).not.toBe(publicKeyToHex(nodeB.publicKey!))
  })

  // ── BIP-39 integration ─────────────────────────────────────────────────────

  it('works end-to-end with a real BIP-39 seed (mnemonic → seed → master node)', async () => {
    const seed = await mnemonicToSeed(KNOWN_MNEMONIC)
    expect(seed.length).toBe(64)
    const master = createMasterNode(seed)
    expect(master.publicKey?.length).toBe(33)
    expect(master.depth).toBe(0)
  })

  // ── Error Handling ─────────────────────────────────────────────────────────

  it("throws WalletError('DERIVATION_FAILED') for a 32-byte seed (too short)", () => {
    const shortSeed = new Uint8Array(32)
    expect(() => createMasterNode(shortSeed)).toThrow(WalletError)
    expect(() => createMasterNode(shortSeed)).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })

  it("throws WalletError('DERIVATION_FAILED') for a 65-byte seed (too long)", () => {
    const longSeed = new Uint8Array(65)
    expect(() => createMasterNode(longSeed)).toThrow(WalletError)
  })

  it("throws WalletError('DERIVATION_FAILED') for an empty seed", () => {
    const emptySeed = new Uint8Array(0)
    expect(() => createMasterNode(emptySeed)).toThrow(WalletError)
  })
})

// ─── derivePath() ─────────────────────────────────────────────────────────────

describe('derivePath()', () => {
  // Re-use same master node for all path derivation tests
  const master = createMasterNode(BIP32_VECTOR_1_SEED)

  it('derives a child key at m/0 (non-hardened)', () => {
    const child = derivePath(master, 'm/0')
    expect(child).toBeDefined()
    expect(child.publicKey?.length).toBe(33)
  })

  it('derived key at m/0 has depth 1', () => {
    const child = derivePath(master, 'm/0')
    expect(child.depth).toBe(1)
  })

  it("derives a child key at m/0' (hardened)", () => {
    const child = derivePath(master, "m/0'")
    expect(child.publicKey?.length).toBe(33)
    expect(child.depth).toBe(1)
  })

  it("derives EVM path m/44'/60'/0'/0/0", () => {
    const child = derivePath(master, "m/44'/60'/0'/0/0")
    expect(child.publicKey?.length).toBe(33)
    expect(child.depth).toBe(5)
  })

  it("derives SVM path m/44'/501'/0'", () => {
    const child = derivePath(master, "m/44'/501'/0'")
    expect(child.publicKey?.length).toBe(33)
    expect(child.depth).toBe(3)
  })

  it('derives different keys for different paths', () => {
    const evm = derivePath(master, "m/44'/60'/0'/0/0")
    const svm = derivePath(master, "m/44'/501'/0'")
    expect(publicKeyToHex(evm.publicKey!)).not.toBe(publicKeyToHex(svm.publicKey!))
  })

  it('derives different keys for different account indices', () => {
    const account0 = derivePath(master, "m/44'/60'/0'/0/0")
    const account1 = derivePath(master, "m/44'/60'/0'/0/1")
    expect(publicKeyToHex(account0.publicKey!)).not.toBe(publicKeyToHex(account1.publicKey!))
  })

  it('is deterministic — same path gives same child public key', () => {
    const child1 = derivePath(master, "m/44'/60'/0'/0/0")
    const child2 = derivePath(master, "m/44'/60'/0'/0/0")
    expect(publicKeyToHex(child1.publicKey!)).toBe(publicKeyToHex(child2.publicKey!))
  })

  // ── Error Handling ─────────────────────────────────────────────────────────

  it("throws WalletError('DERIVATION_FAILED') when path does not start with 'm/'", () => {
    expect(() => derivePath(master, "44'/60'/0'/0/0")).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })

  it("throws WalletError('DERIVATION_FAILED') for an empty path", () => {
    expect(() => derivePath(master, '')).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })

  it("throws WalletError('DERIVATION_FAILED') for a path with invalid segment", () => {
    expect(() => derivePath(master, 'm/notanumber')).toThrowError(WalletError)
  })
})

// ─── publicKeyToHex() ─────────────────────────────────────────────────────────

describe('publicKeyToHex()', () => {
  it('encodes a 33-byte public key as a 66-character hex string', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    const hex = publicKeyToHex(node.publicKey!)
    expect(hex).toHaveLength(66) // 33 bytes × 2 hex chars
  })

  it('produces only lowercase hex characters', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    const hex = publicKeyToHex(node.publicKey!)
    expect(hex).toMatch(/^[0-9a-f]+$/)
  })

  it('round-trips: hex string back to bytes matches original', () => {
    const node = createMasterNode(BIP32_VECTOR_1_SEED)
    const hex = publicKeyToHex(node.publicKey!)
    const restored = Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)))
    expect(restored).toEqual(node.publicKey!)
  })

  it('encodes a known byte sequence correctly', () => {
    const bytes = Uint8Array.from([0x02, 0xab, 0xcd, 0x00, 0xff])
    expect(publicKeyToHex(bytes)).toBe('02abcd00ff')
  })

  it('pads single-digit hex values with a leading zero', () => {
    const bytes = Uint8Array.from([0x00, 0x01, 0x0f, 0x10])
    expect(publicKeyToHex(bytes)).toBe('00010f10')
  })
})
