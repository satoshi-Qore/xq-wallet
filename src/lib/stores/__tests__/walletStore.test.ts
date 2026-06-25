/**
 * walletStore.test.ts
 *
 * Tests for useWalletStore: initial state, createWallet, importWallet,
 * unlockWallet, lockWallet, deriveNextAccount, setActiveAccount, clearError,
 * selectors, error propagation, and reset.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useWalletStore,
  selectWallet,
  selectAccounts,
  selectActiveAccount,
  selectIsLocked,
  selectWalletError,
} from '../walletStore'
import { WalletError } from '@/domain/errors'

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'correcthorse'

// Fast PBKDF2 for tests
beforeEach(() => {
  useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('walletStore — initial state', () => {
  it('wallet is null', () => {
    expect(useWalletStore.getState().wallet).toBeNull()
  })

  it('accounts is an empty array', () => {
    expect(useWalletStore.getState().accounts).toHaveLength(0)
  })

  it('activeAccountId is null', () => {
    expect(useWalletStore.getState().activeAccountId).toBeNull()
  })

  it('isLocked is true', () => {
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('isLoading is false', () => {
    expect(useWalletStore.getState().isLoading).toBe(false)
  })

  it('error is null', () => {
    expect(useWalletStore.getState().error).toBeNull()
  })
})

// ─── createWallet() ────────────────────────────────────────────────────────

describe('walletStore — createWallet()', () => {
  it('wallet is non-null after creation', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(useWalletStore.getState().wallet).not.toBeNull()
  })

  it('wallet name defaults to My Wallet', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(useWalletStore.getState().wallet?.name).toBe('My Wallet')
  })

  it('wallet name is set from options', async () => {
    await useWalletStore.getState().createWallet({
      password: PASSWORD,
      walletName: 'Primary',
    })
    expect(useWalletStore.getState().wallet?.name).toBe('Primary')
  })

  it('accounts has exactly one entry', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(useWalletStore.getState().accounts).toHaveLength(1)
  })

  it('isLocked is false immediately after creation', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('activeAccountId is set to account 0 id', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    const { activeAccountId, accounts } = useWalletStore.getState()
    expect(activeAccountId).toBe(accounts[0]?.id)
  })

  it('returns a mnemonic of at least 12 words', async () => {
    const result = await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(result.mnemonic.trim().split(/\s+/).length).toBeGreaterThanOrEqual(12)
  })

  it('isLoading is false after successful creation', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    expect(useWalletStore.getState().isLoading).toBe(false)
  })

  it('sets error and isLoading:false on WEAK_PASSWORD', async () => {
    await expect(useWalletStore.getState().createWallet({ password: 'short' })).rejects.toThrow()
    const { error, isLoading } = useWalletStore.getState()
    expect(error?.code).toBe('WEAK_PASSWORD')
    expect(isLoading).toBe(false)
  })

  it('error is a WalletError instance', async () => {
    await expect(useWalletStore.getState().createWallet({ password: 'x' })).rejects.toThrow()
    expect(useWalletStore.getState().error).toBeInstanceOf(WalletError)
  })
})

// ─── importWallet() ────────────────────────────────────────────────────────

describe('walletStore — importWallet()', () => {
  it('wallet is non-null after import', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    expect(useWalletStore.getState().wallet).not.toBeNull()
  })

  it('accounts has exactly one entry', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    expect(useWalletStore.getState().accounts).toHaveLength(1)
  })

  it('isLocked is false after import', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('activeAccountId matches account 0', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    const { activeAccountId, accounts } = useWalletStore.getState()
    expect(activeAccountId).toBe(accounts[0]?.id)
  })

  it('sets error on invalid mnemonic', async () => {
    await expect(
      useWalletStore.getState().importWallet({
        mnemonic: 'not a valid mnemonic phrase at all ever',
        password: PASSWORD,
      }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
  })

  it('error code is WEAK_PASSWORD on short password', async () => {
    await expect(
      useWalletStore.getState().importWallet({
        mnemonic: MNEMONIC_1,
        password: 'short',
      }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('WEAK_PASSWORD')
  })

  it('isLoading is false after failed import', async () => {
    await expect(
      useWalletStore.getState().importWallet({ mnemonic: MNEMONIC_1, password: 'x' }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().isLoading).toBe(false)
  })
})

// ─── unlockWallet() + lockWallet() ─────────────────────────────────────────

describe('walletStore — unlockWallet() / lockWallet()', () => {
  beforeEach(async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    useWalletStore.getState().lockWallet()
  })

  it('lockWallet() sets isLocked to true', () => {
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('unlockWallet() with correct password sets isLocked to false', async () => {
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('accounts remain accessible after unlock', async () => {
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().accounts).toHaveLength(1)
  })

  it('error code is INCORRECT_PASSWORD on wrong password', async () => {
    await expect(useWalletStore.getState().unlockWallet('wrongpassword123')).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('INCORRECT_PASSWORD')
  })

  it('isLocked remains true after failed unlock', async () => {
    await expect(useWalletStore.getState().unlockWallet('wrongpassword123')).rejects.toThrow()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('lock → unlock → lock cycle works correctly', async () => {
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().isLocked).toBe(false)
    useWalletStore.getState().lockWallet()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })
})

// ─── deriveNextAccount() ───────────────────────────────────────────────────

describe('walletStore — deriveNextAccount()', () => {
  beforeEach(async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
  })

  it('accounts length increases to 2', async () => {
    await useWalletStore.getState().deriveNextAccount()
    expect(useWalletStore.getState().accounts).toHaveLength(2)
  })

  it('new account has index 1', async () => {
    const account = await useWalletStore.getState().deriveNextAccount()
    expect(account.index).toBe(1)
  })

  it('returns account with custom name', async () => {
    const account = await useWalletStore.getState().deriveNextAccount('Trading')
    expect(account.name).toBe('Trading')
  })

  it('wallet metadata is updated after derivation', async () => {
    await useWalletStore.getState().deriveNextAccount()
    expect(useWalletStore.getState().wallet?.accounts).toHaveLength(2)
  })

  it('sets error and throws when wallet is locked', async () => {
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().deriveNextAccount()).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
  })

  it('isLoading is false after successful derivation', async () => {
    await useWalletStore.getState().deriveNextAccount()
    expect(useWalletStore.getState().isLoading).toBe(false)
  })
})

// ─── setActiveAccount() ────────────────────────────────────────────────────

describe('walletStore — setActiveAccount()', () => {
  it('updates activeAccountId', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    const account1 = await useWalletStore.getState().deriveNextAccount()
    useWalletStore.getState().setActiveAccount(account1.id)
    expect(useWalletStore.getState().activeAccountId).toBe(account1.id)
  })
})

// ─── clearError() ──────────────────────────────────────────────────────────

describe('walletStore — clearError()', () => {
  it('clears a set error', async () => {
    await expect(useWalletStore.getState().createWallet({ password: 'x' })).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
    useWalletStore.getState().clearError()
    expect(useWalletStore.getState().error).toBeNull()
  })

  it('is safe to call when error is already null', () => {
    expect(() => useWalletStore.getState().clearError()).not.toThrow()
  })
})

// ─── selectors ─────────────────────────────────────────────────────────────

describe('walletStore — selectors', () => {
  it('selectWallet returns null before creation', () => {
    expect(selectWallet(useWalletStore.getState())).toBeNull()
  })

  it('selectAccounts returns empty array before creation', () => {
    expect(selectAccounts(useWalletStore.getState())).toHaveLength(0)
  })

  it('selectActiveAccount returns null before creation', () => {
    expect(selectActiveAccount(useWalletStore.getState())).toBeNull()
  })

  it('selectActiveAccount returns account 0 after import', async () => {
    await useWalletStore.getState().importWallet({
      mnemonic: MNEMONIC_1,
      password: PASSWORD,
    })
    const active = selectActiveAccount(useWalletStore.getState())
    expect(active?.index).toBe(0)
  })

  it('selectIsLocked returns true initially', () => {
    expect(selectIsLocked(useWalletStore.getState())).toBe(true)
  })

  it('selectWalletError returns null initially', () => {
    expect(selectWalletError(useWalletStore.getState())).toBeNull()
  })
})

// ─── _reset() ──────────────────────────────────────────────────────────────

describe('walletStore — _reset()', () => {
  it('clears wallet to null', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    useWalletStore.getState()._reset()
    expect(useWalletStore.getState().wallet).toBeNull()
  })

  it('clears accounts to empty array', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    useWalletStore.getState()._reset()
    expect(useWalletStore.getState().accounts).toHaveLength(0)
  })

  it('resets isLocked to true', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    useWalletStore.getState()._reset()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('new wallet can be created after reset', async () => {
    await useWalletStore.getState().createWallet({ password: PASSWORD })
    useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
    await expect(
      useWalletStore.getState().createWallet({ password: PASSWORD }),
    ).resolves.toBeDefined()
  })
})
