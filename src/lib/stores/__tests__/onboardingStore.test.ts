/**
 * onboardingStore.test.ts
 *
 * Tests for useOnboardingStore: initial state, setMode, setStep,
 * setWordCount, completeVerification, setPasswordSet, setNewWalletId,
 * markStepComplete, onboarding progression, selectors, and reset.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useOnboardingStore,
  selectOnboardingStep,
  selectOnboardingMode,
  selectCompletedSteps,
} from '../onboardingStore'

beforeEach(() => {
  useOnboardingStore.getState()._reset()
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('onboardingStore — initial state', () => {
  it('mode is null', () => {
    expect(useOnboardingStore.getState().mode).toBeNull()
  })

  it('step is setup', () => {
    expect(useOnboardingStore.getState().step).toBe('setup')
  })

  it('wordCount is 12', () => {
    expect(useOnboardingStore.getState().wordCount).toBe(12)
  })

  it('verificationComplete is false', () => {
    expect(useOnboardingStore.getState().verificationComplete).toBe(false)
  })

  it('passwordSet is false', () => {
    expect(useOnboardingStore.getState().passwordSet).toBe(false)
  })

  it('newWalletId is null', () => {
    expect(useOnboardingStore.getState().newWalletId).toBeNull()
  })

  it('completedSteps is an empty array', () => {
    expect(useOnboardingStore.getState().completedSteps).toHaveLength(0)
  })
})

// ─── setMode() ─────────────────────────────────────────────────────────────

describe('onboardingStore — setMode()', () => {
  it('sets mode to create', () => {
    useOnboardingStore.getState().setMode('create')
    expect(useOnboardingStore.getState().mode).toBe('create')
  })

  it('sets mode to import', () => {
    useOnboardingStore.getState().setMode('import')
    expect(useOnboardingStore.getState().mode).toBe('import')
  })

  it('changing mode does not reset step', () => {
    useOnboardingStore.getState().setStep('create:generate')
    useOnboardingStore.getState().setMode('import')
    expect(useOnboardingStore.getState().step).toBe('create:generate')
  })
})

// ─── setStep() ─────────────────────────────────────────────────────────────

describe('onboardingStore — setStep()', () => {
  it('advances to create:generate', () => {
    useOnboardingStore.getState().setStep('create:generate')
    expect(useOnboardingStore.getState().step).toBe('create:generate')
  })

  it('advances to create:verify', () => {
    useOnboardingStore.getState().setStep('create:verify')
    expect(useOnboardingStore.getState().step).toBe('create:verify')
  })

  it('advances to import:phrase', () => {
    useOnboardingStore.getState().setStep('import:phrase')
    expect(useOnboardingStore.getState().step).toBe('import:phrase')
  })
})

// ─── setWordCount() ────────────────────────────────────────────────────────

describe('onboardingStore — setWordCount()', () => {
  it('changes wordCount to 24', () => {
    useOnboardingStore.getState().setWordCount(24)
    expect(useOnboardingStore.getState().wordCount).toBe(24)
  })

  it('can set back to 12', () => {
    useOnboardingStore.getState().setWordCount(24)
    useOnboardingStore.getState().setWordCount(12)
    expect(useOnboardingStore.getState().wordCount).toBe(12)
  })
})

// ─── completeVerification() ────────────────────────────────────────────────

describe('onboardingStore — completeVerification()', () => {
  it('sets verificationComplete to true', () => {
    useOnboardingStore.getState().completeVerification()
    expect(useOnboardingStore.getState().verificationComplete).toBe(true)
  })

  it('calling twice keeps it true', () => {
    useOnboardingStore.getState().completeVerification()
    useOnboardingStore.getState().completeVerification()
    expect(useOnboardingStore.getState().verificationComplete).toBe(true)
  })
})

// ─── setPasswordSet() ──────────────────────────────────────────────────────

describe('onboardingStore — setPasswordSet()', () => {
  it('sets passwordSet to true', () => {
    useOnboardingStore.getState().setPasswordSet(true)
    expect(useOnboardingStore.getState().passwordSet).toBe(true)
  })

  it('can set back to false', () => {
    useOnboardingStore.getState().setPasswordSet(true)
    useOnboardingStore.getState().setPasswordSet(false)
    expect(useOnboardingStore.getState().passwordSet).toBe(false)
  })
})

// ─── setNewWalletId() ──────────────────────────────────────────────────────

describe('onboardingStore — setNewWalletId()', () => {
  it('sets newWalletId', () => {
    useOnboardingStore.getState().setNewWalletId('wallet-uuid-123')
    expect(useOnboardingStore.getState().newWalletId).toBe('wallet-uuid-123')
  })

  it('can be updated', () => {
    useOnboardingStore.getState().setNewWalletId('first')
    useOnboardingStore.getState().setNewWalletId('second')
    expect(useOnboardingStore.getState().newWalletId).toBe('second')
  })
})

// ─── markStepComplete() ────────────────────────────────────────────────────

describe('onboardingStore — markStepComplete()', () => {
  it('adds a step to completedSteps', () => {
    useOnboardingStore.getState().markStepComplete('setup')
    expect(useOnboardingStore.getState().completedSteps).toContain('setup')
  })

  it('does not add duplicate steps', () => {
    useOnboardingStore.getState().markStepComplete('setup')
    useOnboardingStore.getState().markStepComplete('setup')
    expect(useOnboardingStore.getState().completedSteps).toHaveLength(1)
  })

  it('tracks multiple different steps', () => {
    useOnboardingStore.getState().markStepComplete('setup')
    useOnboardingStore.getState().markStepComplete('create:generate')
    expect(useOnboardingStore.getState().completedSteps).toHaveLength(2)
  })

  it('preserves insertion order', () => {
    useOnboardingStore.getState().markStepComplete('setup')
    useOnboardingStore.getState().markStepComplete('create:generate')
    const steps = useOnboardingStore.getState().completedSteps
    expect(steps[0]).toBe('setup')
    expect(steps[1]).toBe('create:generate')
  })
})

// ─── onboarding progression ────────────────────────────────────────────────

describe('onboardingStore — create flow progression', () => {
  it('progresses through the full create flow', () => {
    const store = useOnboardingStore.getState()

    store.setMode('create')
    store.markStepComplete('setup')

    store.setStep('create:generate')
    store.setWordCount(12)

    store.setStep('create:verify')
    store.completeVerification()
    store.markStepComplete('create:generate')

    store.setStep('create:password')
    store.setPasswordSet(true)
    store.markStepComplete('create:verify')

    store.setStep('create:complete')
    store.setNewWalletId('new-wallet-id')
    store.markStepComplete('create:password')

    const s = useOnboardingStore.getState()
    expect(s.mode).toBe('create')
    expect(s.step).toBe('create:complete')
    expect(s.verificationComplete).toBe(true)
    expect(s.passwordSet).toBe(true)
    expect(s.newWalletId).toBe('new-wallet-id')
    expect(s.completedSteps).toHaveLength(4)
  })
})

describe('onboardingStore — import flow progression', () => {
  it('progresses through the full import flow', () => {
    const store = useOnboardingStore.getState()

    store.setMode('import')
    store.markStepComplete('setup')

    store.setStep('import:phrase')
    store.markStepComplete('import:phrase')

    store.setStep('import:password')
    store.setPasswordSet(true)
    store.markStepComplete('import:password')

    store.setStep('import:complete')
    store.setNewWalletId('imported-wallet-id')

    const s = useOnboardingStore.getState()
    expect(s.mode).toBe('import')
    expect(s.step).toBe('import:complete')
    expect(s.passwordSet).toBe(true)
    expect(s.newWalletId).toBe('imported-wallet-id')
    expect(s.completedSteps).toHaveLength(3)
  })
})

// ─── selectors ─────────────────────────────────────────────────────────────

describe('onboardingStore — selectors', () => {
  it('selectOnboardingStep returns setup initially', () => {
    expect(selectOnboardingStep(useOnboardingStore.getState())).toBe('setup')
  })

  it('selectOnboardingMode returns null initially', () => {
    expect(selectOnboardingMode(useOnboardingStore.getState())).toBeNull()
  })

  it('selectCompletedSteps returns empty array initially', () => {
    expect(selectCompletedSteps(useOnboardingStore.getState())).toHaveLength(0)
  })

  it('selectors reflect state changes', () => {
    useOnboardingStore.getState().setMode('create')
    useOnboardingStore.getState().setStep('create:generate')
    useOnboardingStore.getState().markStepComplete('setup')
    expect(selectOnboardingMode(useOnboardingStore.getState())).toBe('create')
    expect(selectOnboardingStep(useOnboardingStore.getState())).toBe('create:generate')
    expect(selectCompletedSteps(useOnboardingStore.getState())).toHaveLength(1)
  })
})

// ─── state isolation ───────────────────────────────────────────────────────

describe('onboardingStore — state isolation', () => {
  it('_reset() restores all fields to initial values', () => {
    const store = useOnboardingStore.getState()
    store.setMode('create')
    store.setStep('create:generate')
    store.setWordCount(24)
    store.completeVerification()
    store.setPasswordSet(true)
    store.setNewWalletId('some-id')
    store.markStepComplete('setup')
    store._reset()

    const s = useOnboardingStore.getState()
    expect(s.mode).toBeNull()
    expect(s.step).toBe('setup')
    expect(s.wordCount).toBe(12)
    expect(s.verificationComplete).toBe(false)
    expect(s.passwordSet).toBe(false)
    expect(s.newWalletId).toBeNull()
    expect(s.completedSteps).toHaveLength(0)
  })
})
