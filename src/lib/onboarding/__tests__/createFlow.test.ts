/**
 * createFlow.test.ts
 *
 * Integration tests for the create-wallet onboarding flow.
 * Tests the coordination between walletStore, onboardingStore, and sessionStore
 * without any DOM rendering — purely through store state.
 *
 * This simulates what the create/page.tsx orchestrates.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWalletStore } from '@/lib/stores/walletStore'
import { useOnboardingStore } from '@/lib/stores/onboardingStore'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { generate } from '@/core/crypto'
import {
  validatePasswordPair,
  checkVerifyAnswers,
  pickVerifyIndices,
  validatePassword,
} from '@/lib/onboarding'

const PASSWORD = 'correcthorse'

// Fast PBKDF2 for all tests
beforeEach(() => {
  useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
  useOnboardingStore.getState()._reset()
  useSessionStore.getState()._reset()
})

// ─── Initial state ─────────────────────────────────────────────────────────

describe('createFlow — initial state after reset', () => {
  it('walletStore: no wallet', () => {
    expect(useWalletStore.getState().wallet).toBeNull()
  })

  it('onboardingStore: no mode', () => {
    expect(useOnboardingStore.getState().mode).toBeNull()
  })

  it('sessionStore: not unlocked', () => {
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })
})

// ─── Mnemonic generation ───────────────────────────────────────────────────

describe('createFlow — mnemonic generation', () => {
  it('generate() returns 12 words for wordCount 12', () => {
    const phrase = generate(12)
    expect(phrase.trim().split(/\s+/).length).toBe(12)
  })

  it('generate() returns 24 words for wordCount 24', () => {
    const phrase = generate(24)
    expect(phrase.trim().split(/\s+/).length).toBe(24)
  })

  it('generate() returns a different phrase on each call', () => {
    const a = generate(12)
    const b = generate(12)
    // Probabilistically cannot collide
    expect(a).not.toBe(b)
  })
})

// ─── Password validation (pre-submit) ─────────────────────────────────────

describe('createFlow — password pre-validation', () => {
  it('validatePassword rejects short passwords', () => {
    expect(validatePassword('short').valid).toBe(false)
  })

  it('validatePasswordPair accepts matching long passwords', () => {
    expect(validatePasswordPair(PASSWORD, PASSWORD).valid).toBe(true)
  })

  it('validatePasswordPair rejects mismatched passwords', () => {
    expect(validatePasswordPair(PASSWORD, PASSWORD + 'x').valid).toBe(false)
  })
})

// ─── Step progression ─────────────────────────────────────────────────────

describe('createFlow — step progression via onboardingStore', () => {
  it('can progress through all create steps', () => {
    const ob = useOnboardingStore.getState()
    ob.setMode('create')
    ob.setStep('create:generate')
    expect(useOnboardingStore.getState().step).toBe('create:generate')

    ob.markStepComplete('create:generate')
    ob.setStep('create:verify')
    expect(useOnboardingStore.getState().step).toBe('create:verify')

    ob.completeVerification()
    ob.markStepComplete('create:verify')
    ob.setStep('create:password')
    expect(useOnboardingStore.getState().step).toBe('create:password')

    ob.setPasswordSet(true)
    ob.markStepComplete('create:password')
    ob.setStep('create:complete')
    expect(useOnboardingStore.getState().step).toBe('create:complete')
  })

  it('completedSteps accumulates correctly', () => {
    const ob = useOnboardingStore.getState()
    ob.setMode('create')
    ob.markStepComplete('create:generate')
    ob.markStepComplete('create:verify')
    const { completedSteps } = useOnboardingStore.getState()
    expect(completedSteps).toContain('create:generate')
    expect(completedSteps).toContain('create:verify')
    expect(completedSteps).not.toContain('create:password')
  })
})

// ─── Vault creation ────────────────────────────────────────────────────────

describe('createFlow — vault creation', () => {
  it('importWallet() succeeds with a generated mnemonic and valid password', async () => {
    const mnemonic = generate(12)
    await useWalletStore.getState().importWallet({ mnemonic, password: PASSWORD })
    expect(useWalletStore.getState().wallet).not.toBeNull()
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('importWallet() sets accounts', async () => {
    const mnemonic = generate(12)
    await useWalletStore.getState().importWallet({ mnemonic, password: PASSWORD })
    expect(useWalletStore.getState().accounts).toHaveLength(1)
  })

  it('importWallet() fails with a weak password', async () => {
    const mnemonic = generate(12)
    await expect(
      useWalletStore.getState().importWallet({ mnemonic, password: 'short' }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('WEAK_PASSWORD')
  })

  it('importWallet() fails with invalid mnemonic', async () => {
    await expect(
      useWalletStore
        .getState()
        .importWallet({ mnemonic: 'not a valid mnemonic at all', password: PASSWORD }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
  })
})

// ─── Verification quiz ─────────────────────────────────────────────────────

describe('createFlow — verification quiz', () => {
  it('correct answers pass checkVerifyAnswers', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const words = mnemonic.split(' ')
    const indices = pickVerifyIndices(words.length, 4)
    const answers: Record<number, string> = {}
    indices.forEach((i) => {
      answers[i] = words[i]
    })
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(true)
  })

  it('wrong answer fails checkVerifyAnswers', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const indices = [0, 3, 7, 11]
    const answers: Record<number, string> = { 0: 'wrong', 3: 'wrong', 7: 'wrong', 11: 'wrong' }
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(false)
  })
})

// ─── Session unlock ────────────────────────────────────────────────────────

describe('createFlow — session unlock after vault creation', () => {
  it('sessionStore.unlock() sets isUnlocked to true', async () => {
    const mnemonic = generate(12)
    await useWalletStore.getState().importWallet({ mnemonic, password: PASSWORD })
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })

  it('sessionStore.lastActivityAt is set after unlock', async () => {
    const mnemonic = generate(12)
    await useWalletStore.getState().importWallet({ mnemonic, password: PASSWORD })
    const before = Date.now()
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().lastActivityAt).toBeGreaterThanOrEqual(before)
  })
})

// ─── Full create flow simulation ───────────────────────────────────────────

describe('createFlow — full end-to-end simulation', () => {
  it('wallet is created, unlocked, and session is active', async () => {
    // Step 1: generate
    const mnemonic = generate(12)
    const ob = useOnboardingStore.getState()
    ob.setMode('create')
    ob.setStep('create:generate')
    ob.markStepComplete('create:generate')

    // Step 2: verify (simulate correct answers)
    const words = mnemonic.split(' ')
    const indices = pickVerifyIndices(words.length, 4)
    const answers: Record<number, string> = {}
    indices.forEach((i) => {
      answers[i] = words[i]
    })
    const verified = checkVerifyAnswers(mnemonic, indices, answers)
    expect(verified).toBe(true)
    ob.completeVerification()
    ob.markStepComplete('create:verify')
    ob.setStep('create:password')

    // Step 3: create wallet (importWallet with the generated mnemonic)
    await useWalletStore.getState().importWallet({ mnemonic, password: PASSWORD })
    ob.setPasswordSet(true)
    ob.markStepComplete('create:password')
    ob.setStep('create:complete')

    // Step 4: unlock session
    useSessionStore.getState().unlock()
    const { setNewWalletId } = useOnboardingStore.getState()
    const walletId = useWalletStore.getState().wallet?.id
    if (walletId) setNewWalletId(walletId)

    // Assertions
    expect(useWalletStore.getState().wallet).not.toBeNull()
    expect(useWalletStore.getState().isLocked).toBe(false)
    expect(useSessionStore.getState().isUnlocked).toBe(true)
    expect(useOnboardingStore.getState().step).toBe('create:complete')
    expect(useOnboardingStore.getState().completedSteps).toHaveLength(3)
    expect(useOnboardingStore.getState().newWalletId).toBe(walletId)
  })
})
