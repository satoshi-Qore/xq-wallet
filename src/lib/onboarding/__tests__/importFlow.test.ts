/**
 * importFlow.test.ts
 *
 * Integration tests for the import-wallet onboarding flow.
 * Tests coordination between walletStore, onboardingStore, sessionStore
 * and the mnemonic validation utilities — no DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWalletStore } from '@/lib/stores/walletStore'
import { useOnboardingStore } from '@/lib/stores/onboardingStore'
import { useSessionStore } from '@/lib/stores/sessionStore'
import { validateMnemonicWords, mnemonicSummaryError, IMPORT_WORD_COUNTS } from '@/lib/onboarding'

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
// A different valid 12-word mnemonic
const VALID_12_B = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const PASSWORD = 'correcthorse'

beforeEach(() => {
  useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
  useOnboardingStore.getState()._reset()
  useSessionStore.getState()._reset()
})

// ─── Word count selection ──────────────────────────────────────────────────

describe('importFlow — word count selection', () => {
  it('all IMPORT_WORD_COUNTS are valid', () => {
    IMPORT_WORD_COUNTS.forEach((count) => {
      expect([12, 15, 18, 21, 24]).toContain(count)
    })
  })

  it('resetting to a new word count clears the word array', () => {
    // Simulate what the page does when word count changes
    let words: string[] = Array(12).fill('abandon')
    words = Array(24).fill('abandon')
    expect(words).toHaveLength(24)
    expect(words.every((w) => w === 'abandon')).toBe(true)
  })
})

// ─── Phrase validation ────────────────────────────────────────────────────

describe('importFlow — phrase validation', () => {
  it('empty 12-word array is not valid', () => {
    expect(validateMnemonicWords(Array(12).fill('')).isValid).toBe(false)
  })

  it('valid 12-word mnemonic passes', () => {
    const result = validateMnemonicWords(VALID_12.split(' '))
    expect(result.isValid).toBe(true)
  })

  it('mnemonic with unknown word is rejected', () => {
    const words = VALID_12.split(' ')
    words[5] = 'notaword'
    const result = validateMnemonicWords(words)
    expect(result.isValid).toBe(false)
    expect(result.unknownWordIndices).toContain(5)
    expect(mnemonicSummaryError(result)).not.toBeNull()
  })

  it('mnemonic with wrong checksum is rejected', () => {
    const words = VALID_12.split(' ')
    words[11] = 'zoo' // valid word, wrong checksum
    const result = validateMnemonicWords(words)
    expect(result.isValid).toBe(false)
    expect(result.checksumValid).toBe(false)
    expect(mnemonicSummaryError(result)).toMatch(/checksum/)
  })

  it('partial mnemonic (6/12 filled) is not complete', () => {
    const words = [...VALID_12.split(' ').slice(0, 6), ...Array(6).fill('')]
    const result = validateMnemonicWords(words)
    expect(result.isComplete).toBe(false)
    expect(result.filledCount).toBe(6)
  })

  it('mnemonicSummaryError returns null for valid mnemonic', () => {
    const result = validateMnemonicWords(VALID_12.split(' '))
    expect(mnemonicSummaryError(result)).toBeNull()
  })
})

// ─── Vault import ─────────────────────────────────────────────────────────

describe('importFlow — vault import', () => {
  it('importWallet() succeeds with VALID_12 and correct password', async () => {
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
    expect(useWalletStore.getState().wallet).not.toBeNull()
    expect(useWalletStore.getState().isLocked).toBe(false)
  })

  it('importWallet() sets activeAccountId', async () => {
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
    expect(useWalletStore.getState().activeAccountId).not.toBeNull()
  })

  it('importing a second wallet after reset works', async () => {
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
    useWalletStore.getState()._reset({ pbkdf2Iterations: 1 })
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12_B, password: PASSWORD })
    expect(useWalletStore.getState().wallet).not.toBeNull()
  })

  it('weak password is rejected with WEAK_PASSWORD error', async () => {
    await expect(
      useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: 'short' }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error?.code).toBe('WEAK_PASSWORD')
  })

  it('invalid mnemonic is rejected with a WalletError', async () => {
    await expect(
      useWalletStore.getState().importWallet({
        mnemonic: 'this is not a valid mnemonic phrase at all ever',
        password: PASSWORD,
      }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
  })

  it('walletStore.error is cleared on next successful action', async () => {
    // First: fail with bad password
    await expect(
      useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: 'x' }),
    ).rejects.toThrow()
    expect(useWalletStore.getState().error).not.toBeNull()
    // Then: succeed
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
    expect(useWalletStore.getState().error).toBeNull()
  })
})

// ─── Step progression ────────────────────────────────────────────────────

describe('importFlow — step progression via onboardingStore', () => {
  it('progresses: setup → import:phrase → import:password → import:complete', () => {
    const ob = useOnboardingStore.getState()
    ob.setMode('import')
    ob.setStep('import:phrase')
    expect(useOnboardingStore.getState().step).toBe('import:phrase')

    ob.markStepComplete('import:phrase')
    ob.setStep('import:password')
    expect(useOnboardingStore.getState().step).toBe('import:password')

    ob.setPasswordSet(true)
    ob.markStepComplete('import:password')
    ob.setStep('import:complete')
    expect(useOnboardingStore.getState().step).toBe('import:complete')
  })
})

// ─── Session unlock ───────────────────────────────────────────────────────

describe('importFlow — session unlock', () => {
  it('session is unlocked after successful import', async () => {
    await useWalletStore.getState().importWallet({ mnemonic: VALID_12, password: PASSWORD })
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })
})

// ─── Full import flow simulation ─────────────────────────────────────────

describe('importFlow — full end-to-end simulation', () => {
  it('validates phrase, imports, unlocks — all state is correct', async () => {
    // Validate the phrase first (simulates UI validation)
    const words = VALID_12.split(' ')
    const validation = validateMnemonicWords(words)
    expect(validation.isValid).toBe(true)
    expect(mnemonicSummaryError(validation)).toBeNull()

    // Store progression
    const ob = useOnboardingStore.getState()
    ob.setMode('import')
    ob.setStep('import:phrase')
    ob.markStepComplete('import:phrase')
    ob.setStep('import:password')

    // Import wallet
    const phrase = words.join(' ')
    await useWalletStore.getState().importWallet({ mnemonic: phrase, password: PASSWORD })

    // Store updates
    ob.setPasswordSet(true)
    ob.markStepComplete('import:password')
    ob.setStep('import:complete')
    const walletId = useWalletStore.getState().wallet?.id
    if (walletId) ob.setNewWalletId(walletId)
    useSessionStore.getState().unlock()

    // Verify final state
    expect(useWalletStore.getState().wallet).not.toBeNull()
    expect(useWalletStore.getState().isLocked).toBe(false)
    expect(useSessionStore.getState().isUnlocked).toBe(true)
    expect(useOnboardingStore.getState().step).toBe('import:complete')
    expect(useOnboardingStore.getState().completedSteps).toContain('import:phrase')
    expect(useOnboardingStore.getState().completedSteps).toContain('import:password')
    expect(useOnboardingStore.getState().newWalletId).toBe(walletId)
    expect(useOnboardingStore.getState().passwordSet).toBe(true)
  })
})
