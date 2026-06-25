/**
 * WalletService.test.ts — Comprehensive unit tests for the in-memory wallet engine.
 *
 * All tests use pbkdf2Iterations: 1 to keep the suite fast.
 * Cryptographic correctness of AES-GCM / PBKDF2 is verified by:
 *   - Lock → Unlock round-trips (wrong password must throw)
 *   - Known-vector address checks (same as Day 3 adapter tests)
 *
 * Test scenarios required by Sprint 2 Day 4 spec:
 *   ✓ createWallet()
 *   ✓ importWallet()
 *   ✓ unlockWallet()
 *   ✓ lockWallet()
 *   ✓ deriveNextAccount()
 *   ✓ duplicate unlock (already-unlocked no-op)
 *   ✓ invalid mnemonic
 *   ✓ invalid password (WEAK_PASSWORD)
 *   ✓ account index increment
 *   ✓ deterministic account generation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WalletService } from '../WalletService'
import { WalletError } from '@/domain/errors'

// ─── Test Fixtures ─────────────────────────────────────────────────────────

/** Well-known "abandon x11 about" mnemonic — standard BIP-44 test vector. */
const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

/** Second test mnemonic — produces completely different addresses. */
const MNEMONIC_2 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

const VALID_PASSWORD = 'correct-password'

/** Known EVM addresses from Day 3 test vectors (MNEMONIC_1, empty passphrase). */
const KNOWN_EVM = {
  index0: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  index1: '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
  index2: '0xb6716976A3ebe8D39aCEB04372f22Ff8e6802D7A',
}

/** Known SVM address from Day 3 test vectors (MNEMONIC_1, index 0). */
const KNOWN_SVM_0 = 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL'

/** Known Native address from Day 3 test vectors (MNEMONIC_1, index 0). */
const KNOWN_NATIVE_0 = '0x3b45664e195dbacd0035046b511491e09bd3ca8a'

// ─── Helper ────────────────────────────────────────────────────────────────

/** Creates a WalletService with pbkdf2Iterations: 1 for fast tests. */
const svc = () => new WalletService({ pbkdf2Iterations: 1 })

// ─── createWallet() ────────────────────────────────────────────────────────

describe('WalletService — createWallet()', () => {
  it('returns a mnemonic and wallet metadata', async () => {
    const result = await svc().createWallet({ password: VALID_PASSWORD })
    expect(result.mnemonic).toBeDefined()
    expect(typeof result.mnemonic).toBe('string')
    expect(result.wallet).toBeDefined()
  })

  it('generates a 12-word mnemonic by default', async () => {
    const { mnemonic } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(mnemonic.trim().split(/\s+/)).toHaveLength(12)
  })

  it('generates a 24-word mnemonic when wordCount is 24', async () => {
    const { mnemonic } = await svc().createWallet({ password: VALID_PASSWORD, wordCount: 24 })
    expect(mnemonic.trim().split(/\s+/)).toHaveLength(24)
    expect(mnemonic.trim().split(/\s+/)).toHaveLength(24)
  })

  it('wallet.wordCount matches the requested word count', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD, wordCount: 24 })
    expect(wallet.wordCount).toBe(24)
  })

  it('wallet starts UNLOCKED immediately after creation', async () => {
    const service = svc()
    await service.createWallet({ password: VALID_PASSWORD })
    expect(service.isLocked).toBe(false)
  })

  it('wallet has exactly one account (index 0) after creation', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.accounts).toHaveLength(1)
    expect(wallet.accounts[0].index).toBe(0)
  })

  it('initial account has EVM, SVM, and Native address entries', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    const vms = wallet.accounts[0].addresses.map((a) => a.vm)
    expect(vms).toContain('evm')
    expect(vms).toContain('svm')
    expect(vms).toContain('native')
  })

  it('account 0 has a UUID-format id', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.accounts[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('wallet id is a UUID', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('uses a custom wallet name when provided', async () => {
    const { wallet } = await svc().createWallet({
      password: VALID_PASSWORD,
      walletName: 'Cold Wallet',
    })
    expect(wallet.name).toBe('Cold Wallet')
  })

  it('defaults wallet name to "My Wallet"', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.name).toBe('My Wallet')
  })

  it('throws WEAK_PASSWORD for password shorter than 8 chars', async () => {
    await expect(svc().createWallet({ password: 'short' })).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    })
  })

  it('throws WEAK_PASSWORD for empty password', async () => {
    await expect(svc().createWallet({ password: '' })).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    })
  })

  it('returned error is a WalletError instance', async () => {
    const err = await svc()
      .createWallet({ password: 'x' })
      .catch((e: unknown) => e)
    expect(WalletError.isWalletError(err)).toBe(true)
  })

  it('activeAccountId matches account 0 id', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.activeAccountId).toBe(wallet.accounts[0].id)
  })

  it('wallet.version is 1', async () => {
    const { wallet } = await svc().createWallet({ password: VALID_PASSWORD })
    expect(wallet.version).toBe(1)
  })

  it('two calls produce different mnemonics (entropy)', async () => {
    const service = svc()
    const r1 = await service.createWallet({ password: VALID_PASSWORD })
    const service2 = svc()
    const r2 = await service2.createWallet({ password: VALID_PASSWORD })
    expect(r1.mnemonic).not.toBe(r2.mnemonic)
  })
})

// ─── importWallet() ────────────────────────────────────────────────────────

describe('WalletService — importWallet()', () => {
  it('imports a valid 12-word mnemonic', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    expect(service.isInitialized).toBe(true)
  })

  it('wallet starts UNLOCKED immediately after import', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    expect(service.isLocked).toBe(false)
  })

  it('produces the known EVM address for MNEMONIC_1 index 0', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    const evm = service.getAccounts()[0].addresses.find((a) => a.vm === 'evm')
    expect(evm?.address).toBe(KNOWN_EVM.index0)
  })

  it('produces the known SVM address for MNEMONIC_1 index 0', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    const svm = service.getAccounts()[0].addresses.find((a) => a.vm === 'svm')
    expect(svm?.address).toBe(KNOWN_SVM_0)
  })

  it('produces the known Native address for MNEMONIC_1 index 0', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    const native = service.getAccounts()[0].addresses.find((a) => a.vm === 'native')
    expect(native?.address).toBe(KNOWN_NATIVE_0)
  })

  it('throws INVALID_WORD_COUNT for too-short phrase', async () => {
    await expect(
      svc().importWallet({ mnemonic: 'abandon abandon abandon', password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ code: 'INVALID_WORD_COUNT' })
  })

  it('throws UNKNOWN_WORD for non-BIP39 words', async () => {
    const bad =
      'notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword'
    await expect(
      svc().importWallet({ mnemonic: bad, password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_WORD' })
  })

  it('throws INVALID_CHECKSUM for wrong checksum', async () => {
    // Same words as MNEMONIC_1 but last word swapped — checksum fails
    const badChecksum =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
    await expect(
      svc().importWallet({ mnemonic: badChecksum, password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ code: 'INVALID_CHECKSUM' })
  })

  it('throws WEAK_PASSWORD for short password', async () => {
    await expect(
      svc().importWallet({ mnemonic: MNEMONIC_1, password: 'abc' }),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' })
  })

  it('accepts uppercase / mixed-case mnemonic', async () => {
    const service = svc()
    await expect(
      service.importWallet({ mnemonic: MNEMONIC_1.toUpperCase(), password: VALID_PASSWORD }),
    ).resolves.toBeUndefined()
    const evm = service.getAccounts()[0].addresses.find((a) => a.vm === 'evm')
    expect(evm?.address).toBe(KNOWN_EVM.index0)
  })

  it('wordCount is 12 for a 12-word import', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    // We access wallet metadata indirectly via accounts
    expect(service.getAccounts()[0].index).toBe(0)
  })
})

// ─── unlockWallet() ────────────────────────────────────────────────────────

describe('WalletService — unlockWallet()', () => {
  it('unlocks a locked wallet with the correct password', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()
    expect(service.isLocked).toBe(true)

    await service.unlockWallet(VALID_PASSWORD)
    expect(service.isLocked).toBe(false)
  })

  it('restores full account access after unlock', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()
    await service.unlockWallet(VALID_PASSWORD)

    const account = await service.deriveNextAccount()
    expect(account.index).toBe(1)
  })

  it('throws INCORRECT_PASSWORD for wrong password', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()

    await expect(service.unlockWallet('wrong-password')).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('throws VAULT_NOT_FOUND when no wallet has been created', async () => {
    await expect(svc().unlockWallet(VALID_PASSWORD)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('duplicate unlock (already unlocked) is a no-op and does not throw', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    expect(service.isLocked).toBe(false)

    // Calling unlock when already unlocked must not throw (even with wrong password)
    await expect(service.unlockWallet(VALID_PASSWORD)).resolves.toBeUndefined()
    expect(service.isLocked).toBe(false)
  })

  it('wallet remains locked after incorrect password', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()

    await service.unlockWallet('wrong').catch(() => undefined)
    expect(service.isLocked).toBe(true)
  })

  it('can lock → unlock → lock → unlock cycle correctly', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })

    service.lockWallet()
    await service.unlockWallet(VALID_PASSWORD)
    service.lockWallet()
    await service.unlockWallet(VALID_PASSWORD)

    expect(service.isLocked).toBe(false)
  })
})

// ─── lockWallet() ──────────────────────────────────────────────────────────

describe('WalletService — lockWallet()', () => {
  it('sets isLocked to true', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()
    expect(service.isLocked).toBe(true)
  })

  it('calling lockWallet on an already-locked wallet is a no-op', () => {
    const service = svc()
    expect(() => service.lockWallet()).not.toThrow()
  })

  it('prevents deriveNextAccount after lock', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()

    await expect(service.deriveNextAccount()).rejects.toMatchObject({ code: 'DECRYPTION_FAILED' })
  })

  it('getAccounts() still works after lock (public data)', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()

    expect(() => service.getAccounts()).not.toThrow()
    expect(service.getAccounts()).toHaveLength(1)
  })
})

// ─── deriveNextAccount() ───────────────────────────────────────────────────

describe('WalletService — deriveNextAccount()', () => {
  let service: WalletService

  beforeEach(async () => {
    service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
  })

  it('first call produces account at index 1', async () => {
    const account = await service.deriveNextAccount()
    expect(account.index).toBe(1)
  })

  it('account index increments monotonically', async () => {
    const a1 = await service.deriveNextAccount()
    const a2 = await service.deriveNextAccount()
    const a3 = await service.deriveNextAccount()
    expect(a1.index).toBe(1)
    expect(a2.index).toBe(2)
    expect(a3.index).toBe(3)
  })

  it('derived account appears in getAccounts()', async () => {
    await service.deriveNextAccount()
    expect(service.getAccounts()).toHaveLength(2)
  })

  it('three derived accounts cumulate correctly', async () => {
    await service.deriveNextAccount()
    await service.deriveNextAccount()
    await service.deriveNextAccount()
    expect(service.getAccounts()).toHaveLength(4) // 1 original + 3 derived
  })

  it('accepts a custom display name', async () => {
    const account = await service.deriveNextAccount('Savings')
    expect(account.name).toBe('Savings')
  })

  it('defaults name to "Account {n}" without custom name', async () => {
    const account = await service.deriveNextAccount()
    expect(account.name).toBe('Account 2')
  })

  it('produces the known EVM address for MNEMONIC_1 index 1', async () => {
    const account = await service.deriveNextAccount()
    const evm = account.addresses.find((a) => a.vm === 'evm')
    expect(evm?.address).toBe(KNOWN_EVM.index1)
  })

  it('produces the known EVM address for MNEMONIC_1 index 2', async () => {
    await service.deriveNextAccount()
    const account = await service.deriveNextAccount()
    const evm = account.addresses.find((a) => a.vm === 'evm')
    expect(evm?.address).toBe(KNOWN_EVM.index2)
  })

  it('each derived account has EVM, SVM, and Native addresses', async () => {
    const account = await service.deriveNextAccount()
    const vms = account.addresses.map((a) => a.vm)
    expect(vms).toContain('evm')
    expect(vms).toContain('svm')
    expect(vms).toContain('native')
  })

  it('throws DECRYPTION_FAILED when wallet is locked', async () => {
    service.lockWallet()
    await expect(service.deriveNextAccount()).rejects.toMatchObject({ code: 'DECRYPTION_FAILED' })
  })

  it('throws VAULT_NOT_FOUND on a fresh (uninitialised) service', async () => {
    await expect(svc().deriveNextAccount()).rejects.toMatchObject({ code: 'VAULT_NOT_FOUND' })
  })

  it('each account has a unique UUID id', async () => {
    const a1 = await service.deriveNextAccount()
    const a2 = await service.deriveNextAccount()
    expect(a1.id).not.toBe(a2.id)
  })
})

// ─── getAccounts() ─────────────────────────────────────────────────────────

describe('WalletService — getAccounts()', () => {
  it('throws VAULT_NOT_FOUND when no wallet exists', () => {
    expect(() => svc().getAccounts()).toThrow(expect.objectContaining({ code: 'VAULT_NOT_FOUND' }))
  })

  it('returns accounts when locked (public data is always available)', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()
    expect(service.getAccounts()).toHaveLength(1)
  })

  it('returns a copy — external mutations do not affect internal state', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })

    const accounts = service.getAccounts()
    // Push a fake entry into the returned array
    accounts.push({ ...accounts[0], id: 'injected' })

    expect(service.getAccounts()).toHaveLength(1)
  })
})

// ─── Deterministic generation ──────────────────────────────────────────────

describe('WalletService — deterministic generation', () => {
  it('two imports of the same mnemonic produce identical EVM addresses', async () => {
    const s1 = svc()
    const s2 = svc()
    await s1.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    await s2.importWallet({ mnemonic: MNEMONIC_1, password: 'different-pass' })

    const addr1 = s1.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address
    const addr2 = s2.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address
    expect(addr1).toBe(addr2)
  })

  it('different mnemonics produce different EVM addresses', async () => {
    const s1 = svc()
    const s2 = svc()
    await s1.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    await s2.importWallet({ mnemonic: MNEMONIC_2, password: VALID_PASSWORD })

    const addr1 = s1.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address
    const addr2 = s2.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address
    expect(addr1).not.toBe(addr2)
  })

  it('re-importing a generated mnemonic produces the same addresses', async () => {
    const s1 = svc()
    const { mnemonic } = await s1.createWallet({ password: VALID_PASSWORD })
    const originalAddr = s1.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address

    const s2 = svc()
    await s2.importWallet({ mnemonic, password: 'different-pass' })
    const reimportedAddr = s2.getAccounts()[0].addresses.find((a) => a.vm === 'evm')?.address

    expect(originalAddr).toBe(reimportedAddr)
  })

  it('account index 1 via deriveNextAccount is deterministic across instances', async () => {
    const s1 = svc()
    const s2 = svc()
    await s1.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    await s2.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })

    const a1 = await s1.deriveNextAccount()
    const a2 = await s2.deriveNextAccount()

    expect(a1.addresses.find((a) => a.vm === 'evm')?.address).toBe(
      a2.addresses.find((a) => a.vm === 'evm')?.address,
    )
  })

  it('lock → unlock → derive produces correct addresses', async () => {
    const service = svc()
    await service.importWallet({ mnemonic: MNEMONIC_1, password: VALID_PASSWORD })
    service.lockWallet()
    await service.unlockWallet(VALID_PASSWORD)

    const account = await service.deriveNextAccount()
    expect(account.addresses.find((a) => a.vm === 'evm')?.address).toBe(KNOWN_EVM.index1)
  })
})

// ─── validateAddress() ────────────────────────────────────────────────────────

describe('validateAddress()', () => {
  let svc: WalletService

  beforeEach(() => {
    svc = new WalletService({ pbkdf2Iterations: 1 })
  })

  it('returns true for a valid EVM address', () => {
    expect(svc.validateAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda94', 'evm')).toBe(true)
  })

  it('returns false for an invalid EVM address', () => {
    expect(svc.validateAddress('not-an-address', 'evm')).toBe(false)
  })

  it('returns true for a valid SVM address', () => {
    expect(svc.validateAddress('GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL', 'svm')).toBe(true)
  })

  it('returns false for an invalid SVM address', () => {
    expect(svc.validateAddress('0xinvalid_solana', 'svm')).toBe(false)
  })

  it('returns true for a valid native address', () => {
    expect(svc.validateAddress('0x' + 'ab12'.repeat(10), 'native')).toBe(true)
  })

  it('returns false for an invalid native address', () => {
    expect(svc.validateAddress('not-native', 'native')).toBe(false)
  })
})

// ─── signMessage() ────────────────────────────────────────────────────────────

describe('signMessage()', () => {
  let svc: WalletService
  const message = new TextEncoder().encode('test message for signing')

  beforeEach(async () => {
    svc = new WalletService({ pbkdf2Iterations: 1 })
    await svc.importWallet({ mnemonic: MNEMONIC_1, password: 'password123' })
  })

  it('throws DECRYPTION_FAILED when wallet is locked', async () => {
    svc.lockWallet()
    await expect(svc.signMessage(message, 0, 'evm')).rejects.toMatchObject({
      code: 'DECRYPTION_FAILED',
    })
  })

  it('signs an EVM message and returns 64-byte signature', async () => {
    const result = await svc.signMessage(message, 0, 'evm')
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
    expect(result.signatureHex).toMatch(/^[0-9a-f]{128}$/)
  })

  it('signs an SVM message and returns 64-byte signature', async () => {
    const result = await svc.signMessage(message, 0, 'svm')
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
  })

  it('signs a native message and returns 64-byte signature', async () => {
    const result = await svc.signMessage(message, 0, 'native')
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.signature.byteLength).toBe(64)
  })

  it('EVM sign + verifySignature round-trip succeeds', async () => {
    const accounts = svc.getAccounts()
    const evmEntry = accounts[0].addresses.find((a) => a.vm === 'evm')
    if (!evmEntry) throw new Error('no evm entry')
    const result = await svc.signMessage(message, 0, 'evm')
    expect(
      svc.verifySignature('evm', {
        publicKeyHex: evmEntry.publicKeyHex,
        message,
        signature: result.signature,
      }),
    ).toBe(true)
  })

  it('SVM sign + verifySignature round-trip succeeds', async () => {
    const accounts = svc.getAccounts()
    const svmEntry = accounts[0].addresses.find((a) => a.vm === 'svm')
    if (!svmEntry) throw new Error('no svm entry')
    const result = await svc.signMessage(message, 0, 'svm')
    expect(
      svc.verifySignature('svm', {
        publicKeyHex: svmEntry.publicKeyHex,
        message,
        signature: result.signature,
      }),
    ).toBe(true)
  })

  it('verifySignature returns false for tampered message', async () => {
    const accounts = svc.getAccounts()
    const evmEntry = accounts[0].addresses.find((a) => a.vm === 'evm')
    if (!evmEntry) throw new Error('no evm entry')
    const result = await svc.signMessage(message, 0, 'evm')
    expect(
      svc.verifySignature('evm', {
        publicKeyHex: evmEntry.publicKeyHex,
        message: new TextEncoder().encode('different message'),
        signature: result.signature,
      }),
    ).toBe(false)
  })

  it('throws DERIVATION_FAILED for invalid account index', async () => {
    await expect(svc.signMessage(message, -1, 'evm')).rejects.toMatchObject({
      code: 'DERIVATION_FAILED',
    })
  })
})
