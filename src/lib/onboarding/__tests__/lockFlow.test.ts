/**
 * lockFlow.test.ts
 *
 * Integration tests for the lock/unlock flow:
 * - Lock wallet (walletStore + sessionStore)
 * - Unlock with correct password
 * - Unlock with wrong password (error propagation)
 * - Session activity tracking
 * - Security: isLocked stays true on wrong password
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWalletStore } from '@/lib/stores/walletStore'
import { useSessionStore } from '@/lib/stores/sessionStore'

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'correcthorse'
const WRONG_PASSWORD = 'completely-wrong-password'

beforeEach(() => {
  useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
  useSessionStore.getState()._reset()
})

// ─── Setup helpers ─────────────────────────────────────────────────────────

async function setupUnlockedWallet() {
  await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
  useSessionStore.getState().unlock()
}

// ─── Initial lock state ────────────────────────────────────────────────────

describe('lockFlow — initial state', () => {
  it('walletStore: no wallet, isLocked true', () => {
    expect(useWalletStore.getState().wallet).toBeNull()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('sessionStore: isUnlocked false, lastActivityAt null', () => {
    expect(useSessionStore.getState().isUnlocked).toBe(false)
    expect(useSessionStore.getState().lastActivityAt).toBeNull()
  })
})

// ─── Lock wallet ──────────────────────────────────────────────────────────

describe('lockFlow — locking', () => {
  it('walletStore.lockWallet() sets isLocked to true', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('sessionStore.lock() sets isUnlocked to false', async () => {
    await setupUnlockedWallet()
    useSessionStore.getState().lock()
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('locking preserves wallet metadata (accounts remain)', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    useSessionStore.getState().lock()
    expect(useWalletStore.getState().wallet).not.toBeNull()
    expect(useWalletStore.getState().accounts).toHaveLength(1)
  })

  it('locking does not clear lastActivityAt in sessionStore', async () => {
    await setupUnlockedWallet()
    const ts = useSessionStore.getState().lastActivityAt
    useSessionStore.getState().lock()
    expect(useSessionStore.getState().lastActivityAt).toBe(ts)
  })
})

// ─── Unlock with correct password ─────────────────────────────────────────

describe('lockFlow — unlock with correct password', () => {
  it('unlockWallet() with correct password sets isLocked false', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('sessionStore.unlock() sets isUnlocked after wallet unlock', async () => {
    await setupUnlockedWallet()
    useSessionStore.getState().lock()
    useWalletStore.getState().lockWallet()
    await useWalletStore.getState().unlockWallet(PASSWORD)
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })

  it('walletStore.error is null after successful unlock', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().error).toBeNull()
  })

  it('unlock → lock → unlock cycle maintains correct state', async () => {
    await setupUnlockedWallet()

    useWalletStore.getState().lockWallet()
    useSessionStore.getState().lock()
    expect(useWalletStore.getState().isLocked).toBe(true)
    expect(useSessionStore.getState().isUnlocked).toBe(false)

    await useWalletStore.getState().unlockWallet(PASSWORD)
    useSessionStore.getState().unlock()
    expect(useWalletStore.getState().isLocked).toBe(false)
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })
})

// ─── Unlock with wrong password ────────────────────────────────────────────

describe('lockFlow — unlock with wrong password', () => {
  it('unlockWallet() with wrong password throws', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
  })

  it('error code is INCORRECT_PASSWORD', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('INCORRECT_PASSWORD')
  })

  it('isLocked remains true after failed unlock', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
    expect(useWalletStore.getState().isLocked).toBe(true)
  })

  it('sessionStore remains locked after failed wallet unlock', async () => {
    await setupUnlockedWallet()
    useSessionStore.getState().lock()
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
    // sessionStore was not called since walletStore threw
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('subsequent correct unlock succeeds after a failed attempt', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    // Wrong password
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
    // Correct password
    await useWalletStore.getState().unlockWallet(PASSWORD)
    expect(useWalletStore.getState().isLocked).toBe(false)
    expect(useWalletStore.getState().error).toBeNull()
  })
})

// ─── Error clearing ────────────────────────────────────────────────────────

describe('lockFlow — error clearing', () => {
  it('clearError() removes the INCORRECT_PASSWORD error', async () => {
    await setupUnlockedWallet()
    useWalletStore.getState().lockWallet()
    await expect(useWalletStore.getState().unlockWallet(WRONG_PASSWORD)).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('INCORRECT_PASSWORD')
    useWalletStore.getState().clearError()
    expect(useWalletStore.getState().error).toBeNull()
  })
})

// ─── Activity tracking ─────────────────────────────────────────────────────

describe('lockFlow — activity tracking', () => {
  it('recordActivity() updates lastActivityAt', async () => {
    await setupUnlockedWallet()
    const first = useSessionStore.getState().lastActivityAt!
    useSessionStore.getState().recordActivity()
    expect(useSessionStore.getState().lastActivityAt!).toBeGreaterThanOrEqual(first)
  })
})
