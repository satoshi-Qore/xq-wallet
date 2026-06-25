/**
 * derive.test.ts — Integration tests for the public wallet derivation API.
 *
 * Tests the complete pipeline: mnemonic → seed → HD key → address entry / AccountMetadata.
 * Covers: determinism, cross-mnemonic uniqueness, invalid inputs, error codes,
 * deriveAllAccounts structure, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveEvmAccount,
  deriveSvmAccount,
  deriveNativeAccount,
  deriveAllAccounts,
} from '../derive'
import { WalletError } from '@/domain/errors'

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const MNEMONIC_3 = 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'

const INVALID_MNEMONIC = 'this is not a valid bip39 mnemonic phrase at all'
const BAD_CHECKSUM =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon above'

// ─── deriveEvmAccount() ───────────────────────────────────────────────────

describe('deriveEvmAccount()', () => {
  // ── Known vectors ─────────────────────────────────────────────────────────
  it('derives the correct EVM address for MNEMONIC_1 index 0', async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(entry.address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')
  })

  it('derives the correct EVM address for MNEMONIC_1 index 1', async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 1)
    expect(entry.address).toBe('0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0')
  })

  // ── Return type ───────────────────────────────────────────────────────────
  it('returns vm: "evm"', async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(entry.vm).toBe('evm')
  })

  it('address is 42 chars (EIP-55 checksummed)', async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(entry.address).toHaveLength(42)
    expect(entry.address.startsWith('0x')).toBe(true)
  })

  it('publicKeyHex is 66 chars (33-byte compressed)', async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(entry.publicKeyHex).toHaveLength(66)
    expect(entry.publicKeyHex).toMatch(/^[0-9a-f]{66}$/)
  })

  it("derivationPath is m/44'/60'/0'/0/0 for index 0", async () => {
    const entry = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(entry.derivationPath).toBe("m/44'/60'/0'/0/0")
  })

  // ── Determinism ───────────────────────────────────────────────────────────
  it('is deterministic — same mnemonic+index produces same address', async () => {
    const addr1 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    const addr2 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    expect(addr1).toBe(addr2)
  })

  it('different indices produce different addresses', async () => {
    const addr0 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    const addr1 = (await deriveEvmAccount(MNEMONIC_1, 1)).address
    expect(addr0).not.toBe(addr1)
  })

  it('different mnemonics produce different addresses at the same index', async () => {
    const addr1 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    const addr2 = (await deriveEvmAccount(MNEMONIC_2, 0)).address
    const addr3 = (await deriveEvmAccount(MNEMONIC_3, 0)).address
    expect(addr1).not.toBe(addr2)
    expect(addr1).not.toBe(addr3)
    expect(addr2).not.toBe(addr3)
  })

  it('normalises mnemonic — uppercase gives same address as lowercase', async () => {
    const addr1 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    const addr2 = (await deriveEvmAccount(MNEMONIC_1.toUpperCase(), 0)).address
    expect(addr1).toBe(addr2)
  })

  it('normalises mnemonic — extra whitespace gives same address', async () => {
    const addr1 = (await deriveEvmAccount(MNEMONIC_1, 0)).address
    const addr2 = (await deriveEvmAccount(`  ${MNEMONIC_1}  `, 0)).address
    expect(addr1).toBe(addr2)
  })

  // ── Error handling ────────────────────────────────────────────────────────
  it('throws WalletError for invalid mnemonic', async () => {
    await expect(deriveEvmAccount(INVALID_MNEMONIC, 0)).rejects.toBeInstanceOf(WalletError)
  })

  it('throws INVALID_MNEMONIC for invalid mnemonic', async () => {
    await expect(deriveEvmAccount(INVALID_MNEMONIC, 0)).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws INVALID_MNEMONIC for bad checksum mnemonic', async () => {
    await expect(deriveEvmAccount(BAD_CHECKSUM, 0)).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws INVALID_MNEMONIC for empty string mnemonic', async () => {
    await expect(deriveEvmAccount('', 0)).rejects.toMatchObject({ code: 'INVALID_MNEMONIC' })
  })

  it('throws DERIVATION_FAILED for negative index', async () => {
    await expect(deriveEvmAccount(MNEMONIC_1, -1)).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED for fractional index', async () => {
    await expect(deriveEvmAccount(MNEMONIC_1, 1.5)).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED for index exceeding 2147483647', async () => {
    await expect(deriveEvmAccount(MNEMONIC_1, 0x80000000)).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED before touching the mnemonic (index check is first)', async () => {
    // If index check throws before mnemonicToSeed, we get DERIVATION_FAILED not INVALID_MNEMONIC
    await expect(deriveEvmAccount('bad mnemonic', -1)).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })
})

// ─── deriveSvmAccount() ───────────────────────────────────────────────────

describe('deriveSvmAccount()', () => {
  // ── Known vectors ─────────────────────────────────────────────────────────
  it('derives the correct SVM address for MNEMONIC_1 index 0', async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 0, 'solana')
    expect(entry.address).toBe('GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL')
  })

  it('derives the correct SVM address for MNEMONIC_1 index 1', async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 1, 'solana')
    expect(entry.address).toBe('ANf3TEKFL6jPWjzkndo4CbnNdUNkBk4KHPggJs2nu8Xi')
  })

  // ── Return type ───────────────────────────────────────────────────────────
  it('returns vm: "svm"', async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 0, 'solana')
    expect(entry.vm).toBe('svm')
  })

  it('stores the chainId in the entry', async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 0, 'eclipse')
    expect(entry.chainId).toBe('eclipse')
  })

  it('publicKeyHex is 64 chars (32-byte Ed25519)', async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 0, 'solana')
    expect(entry.publicKeyHex).toHaveLength(64)
    expect(entry.publicKeyHex).toMatch(/^[0-9a-f]{64}$/)
  })

  it("derivationPath is m/44'/501'/0' for index 0", async () => {
    const entry = await deriveSvmAccount(MNEMONIC_1, 0, 'solana')
    expect(entry.derivationPath).toBe("m/44'/501'/0'")
  })

  // ── Determinism ───────────────────────────────────────────────────────────
  it('is deterministic — same mnemonic+index produces same address', async () => {
    const addr1 = (await deriveSvmAccount(MNEMONIC_1, 0, 'solana')).address
    const addr2 = (await deriveSvmAccount(MNEMONIC_1, 0, 'solana')).address
    expect(addr1).toBe(addr2)
  })

  it('different indices produce different addresses', async () => {
    const addr0 = (await deriveSvmAccount(MNEMONIC_1, 0, 'solana')).address
    const addr1 = (await deriveSvmAccount(MNEMONIC_1, 1, 'solana')).address
    expect(addr0).not.toBe(addr1)
  })

  it('different mnemonics produce different addresses', async () => {
    const addr1 = (await deriveSvmAccount(MNEMONIC_1, 0, 'solana')).address
    const addr2 = (await deriveSvmAccount(MNEMONIC_2, 0, 'solana')).address
    expect(addr1).not.toBe(addr2)
  })

  // ── Error handling ────────────────────────────────────────────────────────
  it('throws INVALID_MNEMONIC for invalid mnemonic', async () => {
    await expect(deriveSvmAccount(INVALID_MNEMONIC, 0, 'solana')).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws DERIVATION_FAILED for negative index', async () => {
    await expect(deriveSvmAccount(MNEMONIC_1, -1, 'solana')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED for empty chainId', async () => {
    await expect(deriveSvmAccount(MNEMONIC_1, 0, '')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED for whitespace-only chainId', async () => {
    await expect(deriveSvmAccount(MNEMONIC_1, 0, '   ')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws WalletError (not generic Error) for all failures', async () => {
    await expect(deriveSvmAccount(INVALID_MNEMONIC, 0, 'solana')).rejects.toBeInstanceOf(
      WalletError,
    )
    await expect(deriveSvmAccount(MNEMONIC_1, -1, 'solana')).rejects.toBeInstanceOf(WalletError)
  })
})

// ─── deriveNativeAccount() ────────────────────────────────────────────────

describe('deriveNativeAccount()', () => {
  // ── Known vectors ─────────────────────────────────────────────────────────
  it('derives the correct Native address for MNEMONIC_1 index 0', async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    expect(entry.address).toBe('0x3b45664e195dbacd0035046b511491e09bd3ca8a')
  })

  it('derives the correct Native address for MNEMONIC_1 index 1', async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 1, 'qorechain-devnet')
    expect(entry.address).toBe('0xa8c4866741cd73e62d51e4004ed039b79ffdfce8')
  })

  // ── Return type ───────────────────────────────────────────────────────────
  it('returns vm: "native"', async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    expect(entry.vm).toBe('native')
  })

  it('stores the chainId in the entry', async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-testnet')
    expect(entry.chainId).toBe('qorechain-testnet')
  })

  it('address is 42 chars in lowercase (0x + 40 hex)', async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    expect(entry.address).toHaveLength(42)
    expect(entry.address.slice(2)).toBe(entry.address.slice(2).toLowerCase())
  })

  it("derivationPath is m/44'/9999'/0'/0/0 for index 0", async () => {
    const entry = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    expect(entry.derivationPath).toBe("m/44'/9999'/0'/0/0")
  })

  // ── Native vs EVM addresses differ ────────────────────────────────────────
  it('Native address differs from EVM address for the same mnemonic+index', async () => {
    const native = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    const evm = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(native.address.toLowerCase()).not.toBe(evm.address.toLowerCase())
  })

  // ── Determinism ───────────────────────────────────────────────────────────
  it('is deterministic — same mnemonic+index produces same address', async () => {
    const addr1 = (await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')).address
    const addr2 = (await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')).address
    expect(addr1).toBe(addr2)
  })

  it('different indices produce different addresses', async () => {
    const addr0 = (await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')).address
    const addr1 = (await deriveNativeAccount(MNEMONIC_1, 1, 'qorechain-devnet')).address
    expect(addr0).not.toBe(addr1)
  })

  it('different mnemonics produce different addresses', async () => {
    const addr1 = (await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')).address
    const addr2 = (await deriveNativeAccount(MNEMONIC_2, 0, 'qorechain-devnet')).address
    expect(addr1).not.toBe(addr2)
  })

  // ── Error handling ────────────────────────────────────────────────────────
  it('throws INVALID_MNEMONIC for invalid mnemonic', async () => {
    await expect(
      deriveNativeAccount(INVALID_MNEMONIC, 0, 'qorechain-devnet'),
    ).rejects.toMatchObject({ code: 'INVALID_MNEMONIC' })
  })

  it('throws DERIVATION_FAILED for negative index', async () => {
    await expect(deriveNativeAccount(MNEMONIC_1, -1, 'qorechain-devnet')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })

  it('throws DERIVATION_FAILED for empty chainId', async () => {
    await expect(deriveNativeAccount(MNEMONIC_1, 0, '')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })
})

// ─── deriveAllAccounts() ──────────────────────────────────────────────────

describe('deriveAllAccounts()', () => {
  // ── Structure ──────────────────────────────────────────────────────────────
  it('returns an AccountMetadata object with required fields', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana'],
      nativeChainIds: ['qorechain-devnet'],
    })
    expect(typeof account.id).toBe('string')
    expect(account.id.length).toBeGreaterThan(0)
    expect(account.index).toBe(0)
    expect(Array.isArray(account.addresses)).toBe(true)
    expect(typeof account.createdAt).toBe('number')
    expect(account.createdAt).toBeGreaterThan(0)
    expect(typeof account.name).toBe('string')
  })

  it('id is a valid UUID (RFC 4122 format)', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: [],
    })
    expect(account.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('each call generates a unique id', async () => {
    const opts = { svmChainIds: [], nativeChainIds: [] }
    const id1 = (await deriveAllAccounts(MNEMONIC_1, 0, opts)).id
    const id2 = (await deriveAllAccounts(MNEMONIC_1, 0, opts)).id
    expect(id1).not.toBe(id2)
  })

  // ── Address count ──────────────────────────────────────────────────────────
  it('always includes exactly one EVM address', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana', 'eclipse'],
      nativeChainIds: ['qorechain-devnet'],
    })
    const evmAddresses = account.addresses.filter((a) => a.vm === 'evm')
    expect(evmAddresses).toHaveLength(1)
  })

  it('includes one SVM address per svmChainId', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana', 'eclipse', 'sonic'],
      nativeChainIds: [],
    })
    const svmAddresses = account.addresses.filter((a) => a.vm === 'svm')
    expect(svmAddresses).toHaveLength(3)
  })

  it('includes one Native address per nativeChainId', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: ['qorechain-devnet', 'qorechain-testnet'],
    })
    const nativeAddresses = account.addresses.filter((a) => a.vm === 'native')
    expect(nativeAddresses).toHaveLength(2)
  })

  it('total addresses = 1 EVM + N SVM + M Native', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana', 'eclipse'],
      nativeChainIds: ['qorechain-devnet'],
    })
    expect(account.addresses).toHaveLength(4) // 1 EVM + 2 SVM + 1 Native
  })

  it('works with no SVM or Native chains (EVM only)', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: [],
    })
    expect(account.addresses).toHaveLength(1)
    expect(account.addresses[0].vm).toBe('evm')
  })

  // ── Address correctness ────────────────────────────────────────────────────
  it('EVM address matches deriveEvmAccount() output', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, { svmChainIds: [], nativeChainIds: [] })
    const evmEntry = account.addresses.find((a) => a.vm === 'evm')
    const direct = await deriveEvmAccount(MNEMONIC_1, 0)
    expect(evmEntry?.address).toBe(direct.address)
  })

  it('SVM address matches deriveSvmAccount() output', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana'],
      nativeChainIds: [],
    })
    const svmEntry = account.addresses.find((a) => a.vm === 'svm')
    const direct = await deriveSvmAccount(MNEMONIC_1, 0, 'solana')
    expect(svmEntry?.address).toBe(direct.address)
  })

  it('Native address matches deriveNativeAccount() output', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: ['qorechain-devnet'],
    })
    const nativeEntry = account.addresses.find((a) => a.vm === 'native')
    const direct = await deriveNativeAccount(MNEMONIC_1, 0, 'qorechain-devnet')
    expect(nativeEntry?.address).toBe(direct.address)
  })

  // ── Account name ───────────────────────────────────────────────────────────
  it('uses default name "Account 1" for index 0 when no accountName provided', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, { svmChainIds: [], nativeChainIds: [] })
    expect(account.name).toBe('Account 1')
  })

  it('uses default name "Account 3" for index 2', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 2, { svmChainIds: [], nativeChainIds: [] })
    expect(account.name).toBe('Account 3')
  })

  it('uses provided accountName when specified', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: [],
      accountName: 'Hardware Wallet',
    })
    expect(account.name).toBe('Hardware Wallet')
  })

  // ── Account index ─────────────────────────────────────────────────────────
  it('account.index matches the provided accountIndex', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 5, { svmChainIds: [], nativeChainIds: [] })
    expect(account.index).toBe(5)
  })

  // ── Determinism ───────────────────────────────────────────────────────────
  it('EVM address is deterministic across calls', async () => {
    const opts = { svmChainIds: [] as string[], nativeChainIds: [] as string[] }
    const addr1 = (await deriveAllAccounts(MNEMONIC_1, 0, opts)).addresses[0].address
    const addr2 = (await deriveAllAccounts(MNEMONIC_1, 0, opts)).addresses[0].address
    expect(addr1).toBe(addr2)
  })

  it('different mnemonics produce different EVM addresses', async () => {
    const opts = { svmChainIds: [] as string[], nativeChainIds: [] as string[] }
    const addr1 = (await deriveAllAccounts(MNEMONIC_1, 0, opts)).addresses[0].address
    const addr2 = (await deriveAllAccounts(MNEMONIC_2, 0, opts)).addresses[0].address
    expect(addr1).not.toBe(addr2)
  })

  // ── Error handling ─────────────────────────────────────────────────────────
  it('throws INVALID_MNEMONIC for invalid mnemonic', async () => {
    await expect(
      deriveAllAccounts(INVALID_MNEMONIC, 0, { svmChainIds: [], nativeChainIds: [] }),
    ).rejects.toMatchObject({ code: 'INVALID_MNEMONIC' })
  })

  it('throws DERIVATION_FAILED for negative index', async () => {
    await expect(
      deriveAllAccounts(MNEMONIC_1, -1, { svmChainIds: [], nativeChainIds: [] }),
    ).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('throws DERIVATION_FAILED for empty chainId in svmChainIds', async () => {
    await expect(
      deriveAllAccounts(MNEMONIC_1, 0, { svmChainIds: [''], nativeChainIds: [] }),
    ).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('throws DERIVATION_FAILED for empty chainId in nativeChainIds', async () => {
    await expect(
      deriveAllAccounts(MNEMONIC_1, 0, { svmChainIds: [], nativeChainIds: [''] }),
    ).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('throws WalletError instances (not generic Errors)', async () => {
    await expect(
      deriveAllAccounts(INVALID_MNEMONIC, 0, { svmChainIds: [], nativeChainIds: [] }),
    ).rejects.toBeInstanceOf(WalletError)
  })

  // ── SVM chain IDs are preserved in entries ────────────────────────────────
  it('SVM entries have the correct chainId assigned', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: ['solana', 'eclipse'],
      nativeChainIds: [],
    })
    const svmEntries = account.addresses.filter((a) => a.vm === 'svm')
    const chainIds = svmEntries.map((a) => ('chainId' in a ? a.chainId : ''))
    expect(chainIds).toContain('solana')
    expect(chainIds).toContain('eclipse')
  })

  it('Native entries have the correct chainId assigned', async () => {
    const account = await deriveAllAccounts(MNEMONIC_1, 0, {
      svmChainIds: [],
      nativeChainIds: ['qorechain-devnet', 'qorechain-testnet'],
    })
    const nativeEntries = account.addresses.filter((a) => a.vm === 'native')
    const chainIds = nativeEntries.map((a) => a.chainId)
    expect(chainIds).toContain('qorechain-devnet')
  })
})
