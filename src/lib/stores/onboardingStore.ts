/**
 * onboardingStore.ts — Onboarding flow state.
 *
 * Tracks which step the user is on during wallet creation or import.
 * Ephemeral: intentionally lost on page refresh. A refreshed mid-flow
 * session must restart at /setup.
 *
 * Follows the OnboardingState shape from the domain layer (src/domain/onboarding.ts)
 * and adds completedSteps for navigation guard enforcement.
 *
 * No persistence. No browser APIs. No mnemonic stored here (SEC-01).
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 */

import { create } from 'zustand'
import type { OnboardingMode, OnboardingStep } from '@/domain/onboarding'
import type { WordCount } from '@/domain/wallet'

// ─── Types ─────────────────────────────────────────────────────────────────

interface OnboardingState {
  mode: OnboardingMode | null
  step: OnboardingStep
  wordCount: WordCount
  verificationComplete: boolean
  passwordSet: boolean
  newWalletId: string | null
  /** Steps the user has successfully completed, in order. Used by navigation guards. */
  completedSteps: readonly OnboardingStep[]
}

export interface OnboardingStore extends OnboardingState {
  setMode: (mode: OnboardingMode) => void
  setStep: (step: OnboardingStep) => void
  setWordCount: (wordCount: WordCount) => void
  completeVerification: () => void
  setPasswordSet: (value: boolean) => void
  setNewWalletId: (id: string) => void
  /** Records a step as completed. Idempotent — duplicate calls are ignored. */
  markStepComplete: (step: OnboardingStep) => void
  /** Test helper — resets to initial state. */
  _reset: () => void
}

const INITIAL_ONBOARDING_STATE: OnboardingState = {
  mode: null,
  step: 'setup',
  wordCount: 12,
  verificationComplete: false,
  passwordSet: false,
  newWalletId: null,
  completedSteps: [],
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingStore>()((set, get) => ({
  ...INITIAL_ONBOARDING_STATE,

  setMode: (mode) => set({ mode }),
  setStep: (step) => set({ step }),
  setWordCount: (wordCount) => set({ wordCount }),
  completeVerification: () => set({ verificationComplete: true }),
  setPasswordSet: (value) => set({ passwordSet: value }),
  setNewWalletId: (id) => set({ newWalletId: id }),

  markStepComplete: (step) => {
    const current = get().completedSteps
    if (!current.includes(step)) {
      set({ completedSteps: [...current, step] })
    }
  },

  _reset: () => set({ ...INITIAL_ONBOARDING_STATE }),
}))

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectOnboardingStep = (s: OnboardingStore): OnboardingStep => s.step
export const selectOnboardingMode = (s: OnboardingStore): OnboardingMode | null => s.mode
export const selectCompletedSteps = (s: OnboardingStore): readonly OnboardingStep[] =>
  s.completedSteps
