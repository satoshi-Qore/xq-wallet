/**
 * EvmAddressAdapter.test.ts — Unit tests for EVM address derivation.
 *
 * Test vectors verified against the BIP-44 / EIP-55 specification.
 * The known EVM address for the "abandon x11 about" mnemonic at index 0 is
 * 0x9858EfFD232B4033E47d90003D41EC34EcaEda94 — a well-known test address
 * used by many BIP-44 test suites.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeed } from '@scure/bip39'
import { deriveEvmAddress } from '../../adapters/EvmAddressAdapter'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

// Known EVM address vectors derived from MNEMONIC_1 (empty passphrase, BIP-44 EVM path)
// Verified against multiple BIP-44 reference implementations.
const KNOWN_EVM_VECTORS = [
  { index: 0, address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' },
  { index: 1, address: '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0' },
  { index: 2, address: '0xb6716976A3ebe8D39aCEB04372f22Ff8e6802D7A' },
]

let masterNode1: HDKey
let masterNode2: HDKey

beforeAll(async () => {
  const seed1 = await mnemonicToSeed(MNEMONIC_1, '')
  masterNode1 = HDKey.fromMasterSeed(seed1)
  const seed2 = await mnemonicToSeed(MNEMONIC_2, '')
  masterNode2 = HDKey.fromMasterSeed(seed2)
})

// ─── Known-Vector Tests ────────────────────────────────────────────────────

describe('deriveEvmAddress() — known vectors', () => {
  for (const { index, address } of KNOWN_EVM_VECTORS) {
    it(`index ${index} produces ${address}`, () => {
      const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: index })
      expect(entry.address).toBe(address)
    })
  }
})

// ─── Address Properties ────────────────────────────────────────────────────

describe('deriveEvmAddress() — address format', () => {
  it('address starts with "0x"', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.address.startsWith('0x')).toBe(true)
  })

  it('address is 42 characters (0x + 40 hex chars = 20 bytes)', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.address).toHaveLength(42)
  })

  it('address contains mixed case (EIP-55 checksum)', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    const hex = entry.address.slice(2)
    expect(hex).not.toBe(hex.toLowerCase())
    expect(hex).not.toBe(hex.toUpperCase())
  })

  it('address hex portion is valid hexadecimal', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.address.slice(2)).toMatch(/^[0-9a-fA-F]{40}$/)
  })
})

// ─── Public Key Properties ─────────────────────────────────────────────────

describe('deriveEvmAddress() — publicKeyHex', () => {
  it('publicKeyHex is 66 characters (33 bytes compressed secp256k1)', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.publicKeyHex).toHaveLength(66)
  })

  it('publicKeyHex is valid lowercase hex', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.publicKeyHex).toMatch(/^[0-9a-f]{66}$/)
  })

  it('publicKeyHex starts with 02 or 03 (compressed secp256k1 prefix)', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(['02', '03']).toContain(entry.publicKeyHex.slice(0, 2))
  })
})

// ─── Derivation Path ──────────────────────────────────────────────────────

describe('deriveEvmAddress() — derivationPath', () => {
  it("derivationPath is m/44'/60'/0'/0/0 for index 0", () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.derivationPath).toBe("m/44'/60'/0'/0/0")
  })

  it("derivationPath is m/44'/60'/0'/0/5 for index 5", () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 5 })
    expect(entry.derivationPath).toBe("m/44'/60'/0'/0/5")
  })
})

// ─── vm discriminant ──────────────────────────────────────────────────────

describe('deriveEvmAddress() — vm type', () => {
  it('vm is "evm"', () => {
    const entry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    expect(entry.vm).toBe('evm')
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────

describe('deriveEvmAddress() — determinism', () => {
  it('produces the same address for the same mnemonic and index', async () => {
    const seed = await mnemonicToSeed(MNEMONIC_1, '')
    const node1 = HDKey.fromMasterSeed(seed)
    const node2 = HDKey.fromMasterSeed(seed)
    const addr1 = deriveEvmAddress({ masterNode: node1, accountIndex: 0 }).address
    const addr2 = deriveEvmAddress({ masterNode: node2, accountIndex: 0 }).address
    expect(addr1).toBe(addr2)
  })

  it('produces different addresses for different indices', () => {
    const addr0 = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 }).address
    const addr1 = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 1 }).address
    expect(addr0).not.toBe(addr1)
  })

  it('produces different addresses for different mnemonics at the same index', () => {
    const addr1 = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 }).address
    const addr2 = deriveEvmAddress({ masterNode: masterNode2, accountIndex: 0 }).address
    expect(addr1).not.toBe(addr2)
  })

  it('produces different public keys for different indices', () => {
    const pk0 = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 }).publicKeyHex
    const pk1 = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 1 }).publicKeyHex
    expect(pk0).not.toBe(pk1)
  })
})
