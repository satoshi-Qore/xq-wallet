/**
 * SvmAddressAdapter.test.ts — Unit tests for SLIP-0010 Ed25519 / Solana address derivation.
 *
 * Test vectors computed via the SLIP-0010 spec using HMAC-SHA512 with "ed25519 seed" key.
 * Path: m/44'/501'/{index}' (Ledger / Backpack 3-level style, all hardened).
 *
 * The known Solana address for the "abandon x11 about" mnemonic at index 0 is
 * GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { mnemonicToSeed } from '@scure/bip39'
import { deriveSvmAddress, deriveEd25519PrivateKey } from '../../adapters/SvmAddressAdapter'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

// Known SVM address vectors for MNEMONIC_1 (empty passphrase, m/44'/501'/{index}')
const KNOWN_SVM_VECTORS = [
  { index: 0, address: 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL' },
  { index: 1, address: 'ANf3TEKFL6jPWjzkndo4CbnNdUNkBk4KHPggJs2nu8Xi' },
  { index: 2, address: 'Ag74i82rUZBTgMGLacCA1ZLnotvAca8CLscXcrG6Nwem' },
]

let seed1: Uint8Array
let seed2: Uint8Array

beforeAll(async () => {
  seed1 = await mnemonicToSeed(MNEMONIC_1, '')
  seed2 = await mnemonicToSeed(MNEMONIC_2, '')
})

// ─── Known-Vector Tests ────────────────────────────────────────────────────

describe('deriveSvmAddress() — known vectors', () => {
  for (const { index, address } of KNOWN_SVM_VECTORS) {
    it(`index ${index} produces ${address}`, () => {
      const entry = deriveSvmAddress({ seed: seed1, accountIndex: index, chainId: 'solana' })
      expect(entry.address).toBe(address)
    })
  }
})

// ─── Address Properties ────────────────────────────────────────────────────

describe('deriveSvmAddress() — address format', () => {
  it('address is a non-empty string', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(typeof entry.address).toBe('string')
    expect(entry.address.length).toBeGreaterThan(0)
  })

  it('address is valid base58 (no 0, O, I, l characters)', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.address).not.toMatch(/[0OIl]/)
  })

  it('address is 32-44 characters (base58-encoded 32-byte Ed25519 pubkey)', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.address.length).toBeGreaterThanOrEqual(32)
    expect(entry.address.length).toBeLessThanOrEqual(44)
  })
})

// ─── Public Key Properties ─────────────────────────────────────────────────

describe('deriveSvmAddress() — publicKeyHex', () => {
  it('publicKeyHex is 64 characters (32-byte Ed25519 public key)', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.publicKeyHex).toHaveLength(64)
  })

  it('publicKeyHex is valid lowercase hex', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.publicKeyHex).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ─── Chain ID ─────────────────────────────────────────────────────────────

describe('deriveSvmAddress() — chainId', () => {
  it('stores the chainId in the entry', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.chainId).toBe('solana')
  })

  it('stores different chainIds for different calls', () => {
    const solana = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    const eclipse = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'eclipse' })
    expect(solana.chainId).toBe('solana')
    expect(eclipse.chainId).toBe('eclipse')
    // Same key — chainId is only metadata; address is the same key regardless of chainId
    expect(solana.address).toBe(eclipse.address)
  })
})

// ─── Derivation Path ──────────────────────────────────────────────────────

describe('deriveSvmAddress() — derivationPath', () => {
  it("derivationPath is m/44'/501'/0' for index 0", () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.derivationPath).toBe("m/44'/501'/0'")
  })

  it("derivationPath is m/44'/501'/3' for index 3", () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 3, chainId: 'solana' })
    expect(entry.derivationPath).toBe("m/44'/501'/3'")
  })
})

// ─── vm discriminant ──────────────────────────────────────────────────────

describe('deriveSvmAddress() — vm type', () => {
  it('vm is "svm"', () => {
    const entry = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' })
    expect(entry.vm).toBe('svm')
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────

describe('deriveSvmAddress() — determinism', () => {
  it('produces the same address given the same seed and index', async () => {
    const seed = await mnemonicToSeed(MNEMONIC_1, '')
    const addr1 = deriveSvmAddress({ seed, accountIndex: 0, chainId: 'solana' }).address
    const addr2 = deriveSvmAddress({ seed, accountIndex: 0, chainId: 'solana' }).address
    expect(addr1).toBe(addr2)
  })

  it('produces different addresses for different indices', () => {
    const addr0 = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' }).address
    const addr1 = deriveSvmAddress({ seed: seed1, accountIndex: 1, chainId: 'solana' }).address
    expect(addr0).not.toBe(addr1)
  })

  it('produces different addresses for different mnemonics at the same index', () => {
    const addr1 = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' }).address
    const addr2 = deriveSvmAddress({ seed: seed2, accountIndex: 0, chainId: 'solana' }).address
    expect(addr1).not.toBe(addr2)
  })

  it('produces different public keys for different indices', () => {
    const pk0 = deriveSvmAddress({ seed: seed1, accountIndex: 0, chainId: 'solana' }).publicKeyHex
    const pk1 = deriveSvmAddress({ seed: seed1, accountIndex: 1, chainId: 'solana' }).publicKeyHex
    expect(pk0).not.toBe(pk1)
  })
})

// ─── SLIP-0010 Internal: deriveEd25519PrivateKey() ────────────────────────

describe('deriveEd25519PrivateKey() — SLIP-0010 sanity checks', () => {
  it('returns a 32-byte Uint8Array', () => {
    const key = deriveEd25519PrivateKey(seed1, 0)
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  it('is deterministic — same seed and index yield the same key', () => {
    const k1 = deriveEd25519PrivateKey(seed1, 0)
    const k2 = deriveEd25519PrivateKey(seed1, 0)
    expect(Buffer.from(k1).toString('hex')).toBe(Buffer.from(k2).toString('hex'))
  })

  it('different indices yield different keys', () => {
    const k0 = Buffer.from(deriveEd25519PrivateKey(seed1, 0)).toString('hex')
    const k1 = Buffer.from(deriveEd25519PrivateKey(seed1, 1)).toString('hex')
    expect(k0).not.toBe(k1)
  })

  it('different seeds yield different keys', () => {
    const k1 = Buffer.from(deriveEd25519PrivateKey(seed1, 0)).toString('hex')
    const k2 = Buffer.from(deriveEd25519PrivateKey(seed2, 0)).toString('hex')
    expect(k1).not.toBe(k2)
  })
})
