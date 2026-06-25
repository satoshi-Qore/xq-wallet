/**
 * steps.ts — Onboarding step navigation guards and metadata.
 *
 * Guards are pure functions that take the current onboarding state and
 * return whether a given step is accessible. Pages use these to enforce
 * the correct progression without duplicating the rules.
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 */

import type { OnboardingMode, OnboardingStep } from '@/domain/onboarding'

// ─── Step Input Shape ──────────────────────────────────────────────────────

/**
 * Minimal state slice needed by the step guard.
 * Matches the shape of OnboardingStore (superset of OnboardingState).
 */
export interface StepGuardInput {
  mode: OnboardingMode | null
  verificationComplete: boolean
  passwordSet: boolean
  completedSteps: readonly OnboardingStep[]
}

// ─── Guard Result ──────────────────────────────────────────────────────────

export interface StepGuardResult {
  /** Whether the user may be on this step */
  allowed: boolean
  /**
   * Where to redirect if not allowed.
   * Equal to targetStep when allowed === true.
   */
  redirectTo: OnboardingStep
}

// ─── Step Guards ───────────────────────────────────────────────────────────

/**
 * Checks whether the user is allowed to navigate to `targetStep` given the
 * current onboarding state. Returns a redirect target if not allowed.
 *
 * Navigation rules (mirrors src/domain/onboarding.ts):
 *   setup              → always allowed
 *   create:generate    → mode must be 'create'
 *   create:verify      → create:generate must be completed
 *   create:password    → verificationComplete must be true
 *   create:complete    → passwordSet must be true
 *   import:phrase      → mode must be 'import'
 *   import:password    → import:phrase must be completed
 *   import:complete    → passwordSet must be true
 */
export function checkStepGuard(targetStep: OnboardingStep, state: StepGuardInput): StepGuardResult {
  const allow = (step: OnboardingStep): StepGuardResult => ({ allowed: true, redirectTo: step })
  const deny = (step: OnboardingStep): StepGuardResult => ({ allowed: false, redirectTo: step })

  if (targetStep === 'setup') return allow('setup')

  // ── Create flow ────────────────────────────────────────────────────────
  if (targetStep === 'create:generate') {
    return state.mode === 'create' ? allow('create:generate') : deny('setup')
  }
  if (targetStep === 'create:verify') {
    if (state.mode !== 'create') return deny('setup')
    if (!state.completedSteps.includes('create:generate')) return deny('create:generate')
    return allow('create:verify')
  }
  if (targetStep === 'create:password') {
    if (state.mode !== 'create') return deny('setup')
    if (!state.completedSteps.includes('create:generate')) return deny('create:generate')
    if (!state.verificationComplete) return deny('create:verify')
    return allow('create:password')
  }
  if (targetStep === 'create:complete') {
    if (state.mode !== 'create') return deny('setup')
    if (!state.passwordSet) return deny('create:password')
    return allow('create:complete')
  }

  // ── Import flow ────────────────────────────────────────────────────────
  if (targetStep === 'import:phrase') {
    return state.mode === 'import' ? allow('import:phrase') : deny('setup')
  }
  if (targetStep === 'import:password') {
    if (state.mode !== 'import') return deny('setup')
    if (!state.completedSteps.includes('import:phrase')) return deny('import:phrase')
    return allow('import:password')
  }
  if (targetStep === 'import:complete') {
    if (state.mode !== 'import') return deny('setup')
    if (!state.passwordSet) return deny('import:password')
    return allow('import:complete')
  }

  return deny('setup')
}

// ─── Step Metadata ─────────────────────────────────────────────────────────

export interface StepMeta {
  key: OnboardingStep
  label: string
  /** 1-based position in the flow (for progress display) */
  position: number
}

export const CREATE_STEPS: StepMeta[] = [
  { key: 'create:generate', label: 'Backup phrase', position: 1 },
  { key: 'create:verify', label: 'Verify', position: 2 },
  { key: 'create:password', label: 'Password', position: 3 },
  { key: 'create:complete', label: 'Complete', position: 4 },
]

export const IMPORT_STEPS: StepMeta[] = [
  { key: 'import:phrase', label: 'Recovery phrase', position: 1 },
  { key: 'import:password', label: 'Password', position: 2 },
  { key: 'import:complete', label: 'Complete', position: 3 },
]

/** Returns the step metadata for a given step key. undefined if not found. */
export function getStepMeta(step: OnboardingStep, flow: 'create' | 'import'): StepMeta | undefined {
  const list = flow === 'create' ? CREATE_STEPS : IMPORT_STEPS
  return list.find((s) => s.key === step)
}
