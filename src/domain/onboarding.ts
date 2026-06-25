/**
 * Onboarding domain types.
 *
 * Pure TypeScript types — no logic, no imports from outside domain/.
 * Describes the ephemeral state of the wallet creation / import flow.
 *
 * The mnemonic is NOT represented here — it lives in component-local useState
 * during the generate and verify steps, then is passed directly to vaultService.
 * It never enters this store.
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 * Security: PRIN-SEC-01
 */

import type { WordCount } from './wallet'

// ─── Flow Variants ─────────────────────────────────────────────────────────

/** Whether the user is creating a new wallet or importing an existing one. */
export type OnboardingMode = 'create' | 'import'

// ─── Steps ─────────────────────────────────────────────────────────────────

/**
 * All valid steps in the onboarding flow.
 *
 * Navigation rules (enforced by page-level guards):
 *   setup              → create:generate | import:phrase
 *   create:generate    → create:verify  (only after mnemonic was displayed)
 *   create:verify      → create:password (only after verificationComplete === true)
 *   create:password    → create:complete
 *   create:complete    → /dashboard
 *   import:phrase      → import:password (only after valid mnemonic entered)
 *   import:password    → import:complete
 *   import:complete    → /dashboard
 *
 * Any step that is reached without its prerequisites satisfied redirects to /setup.
 */
export type OnboardingStep =
  | 'setup'
  | 'create:generate'
  | 'create:verify'
  | 'create:password'
  | 'create:complete'
  | 'import:phrase'
  | 'import:password'
  | 'import:complete'

// ─── State ─────────────────────────────────────────────────────────────────

/**
 * OnboardingState — held in onboardingStore (Zustand, NOT persisted).
 *
 * Intentionally lost on page refresh: a refreshed onboarding session
 * must restart from /setup. This prevents partial-state bugs and
 * ensures the mnemonic (in component useState) is never accessible
 * after the user navigates away mid-flow.
 */
export interface OnboardingState {
  /** null until the user chooses Create or Import on /setup */
  readonly mode: OnboardingMode | null
  /** Current step — drives navigation guards in each page */
  readonly step: OnboardingStep
  /** Word count chosen by the user on /setup (12 or 24) */
  readonly wordCount: WordCount
  /** True once the user has completed the word-order verification step */
  readonly verificationComplete: boolean
  /** True once the password has been set (create:password or import:password) */
  readonly passwordSet: boolean
  /**
   * Set after vault creation succeeds in the complete step.
   * Used to initialise walletStore with the new wallet's ID.
   * Never contains key material — only the public wallet UUID.
   */
  readonly newWalletId: string | null
}
