/**
 * NativeAddressAdapter.test.ts — Unit tests for QoreChain (Native VM) address derivation.
 *
 * Native addresses use secp256k1 BIP-44 at m/44'/9999'/0'/0/{index} — same key
 * curve as EVM but a different coin type and path, producing completely different
 * addresses for the same account index.
 *
 * The address format is a lowercase hex placeholder pending the QoreChain SDK.
 * Tests verify structural properties and derivation correctness.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeed } from '@scure/bip39'
import { deriveNativeAddress } from '../../adapters/NativeAddressAdapter'

// ─── Test Fixtures ────────────────────────────────────────────────────────

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

// Known Native address vectors for MNEMONIC_1 (empty passphrase, m/44'/9999'/0'/0/{index})
const KNOWN_NATIVE_VECTORS = [
  { index: 0, address: '0x3b45664e195dbacd0035046b511491e09bd3ca8a' },
  { index: 1, address: '0xa8c4866741cd73e62d51e4004ed039b79ffdfce8' },
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

describe('deriveNativeAddress() — known vectors', () => {
  for (const { index, address } of KNOWN_NATIVE_VECTORS) {
    it(`index ${index} produces ${address}`, () => {
      const entry = deriveNativeAddress({
        masterNode: masterNode1,
        accountIndex: index,
        chainId: 'qorechain-devnet',
      })
      expect(entry.address).toBe(address)
    })
  }
})

// ─── Address Properties ────────────────────────────────────────────────────

describe('deriveNativeAddress() — address format', () => {
  it('address starts with "0x"', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.address.startsWith('0x')).toBe(true)
  })

  it('address is 42 characters (0x + 40 lowercase hex)', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.address).toHaveLength(42)
  })

  it('address hex portion is lowercase (no EIP-55 checksum applied)', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    const hex = entry.address.slice(2)
    expect(hex).toBe(hex.toLowerCase())
  })

  it('address hex portion is valid hexadecimal', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.address.slice(2)).toMatch(/^[0-9a-f]{40}$/)
  })

  it('Native address differs from EVM address for the same index (different coin type)', async () => {
    // Import EVM adapter dynamically to avoid circular reference confusion in tests
    const { deriveEvmAddress } = await import('../../adapters/EvmAddressAdapter')
    const evmEntry = deriveEvmAddress({ masterNode: masterNode1, accountIndex: 0 })
    const nativeEntry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    // They use different paths so even with the same mnemonic the addresses differ
    expect(evmEntry.address.toLowerCase()).not.toBe(nativeEntry.address.toLowerCase())
  })
})

// ─── Public Key Properties ─────────────────────────────────────────────────

describe('deriveNativeAddress() — publicKeyHex', () => {
  it('publicKeyHex is 66 characters (33-byte compressed secp256k1)', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.publicKeyHex).toHaveLength(66)
  })

  it('publicKeyHex is valid lowercase hex', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.publicKeyHex).toMatch(/^[0-9a-f]{66}$/)
  })

  it('publicKeyHex starts with 02 or 03 (compressed secp256k1 prefix)', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(['02', '03']).toContain(entry.publicKeyHex.slice(0, 2))
  })
})

// ─── Chain ID ─────────────────────────────────────────────────────────────

describe('deriveNativeAddress() — chainId', () => {
  it('stores the chainId in the entry', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.chainId).toBe('qorechain-devnet')
  })

  it('stores a different chainId when passed a different value', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-testnet',
    })
    expect(entry.chainId).toBe('qorechain-testnet')
  })

  it('address is the same regardless of chainId (chainId is metadata only)', () => {
    const devnet = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    const testnet = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-testnet',
    })
    expect(devnet.address).toBe(testnet.address)
  })
})

// ─── Derivation Path ──────────────────────────────────────────────────────

describe('deriveNativeAddress() — derivationPath', () => {
  it("derivationPath is m/44'/9999'/0'/0/0 for index 0", () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.derivationPath).toBe("m/44'/9999'/0'/0/0")
  })

  it("derivationPath is m/44'/9999'/0'/0/7 for index 7", () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 7,
      chainId: 'qorechain-devnet',
    })
    expect(entry.derivationPath).toBe("m/44'/9999'/0'/0/7")
  })
})

// ─── vm discriminant ──────────────────────────────────────────────────────

describe('deriveNativeAddress() — vm type', () => {
  it('vm is "native"', () => {
    const entry = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    })
    expect(entry.vm).toBe('native')
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────

describe('deriveNativeAddress() — determinism', () => {
  it('produces the same address for the same mnemonic and index', async () => {
    const seed = await mnemonicToSeed(MNEMONIC_1, '')
    const node1 = HDKey.fromMasterSeed(seed)
    const node2 = HDKey.fromMasterSeed(seed)
    const addr1 = deriveNativeAddress({
      masterNode: node1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    }).address
    const addr2 = deriveNativeAddress({
      masterNode: node2,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    }).address
    expect(addr1).toBe(addr2)
  })

  it('produces different addresses for different indices', () => {
    const addr0 = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    }).address
    const addr1 = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 1,
      chainId: 'qorechain-devnet',
    }).address
    expect(addr0).not.toBe(addr1)
  })

  it('produces different addresses for different mnemonics at the same index', () => {
    const addr1 = deriveNativeAddress({
      masterNode: masterNode1,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    }).address
    const addr2 = deriveNativeAddress({
      masterNode: masterNode2,
      accountIndex: 0,
      chainId: 'qorechain-devnet',
    }).address
    expect(addr1).not.toBe(addr2)
  })
})
