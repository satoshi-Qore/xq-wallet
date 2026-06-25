/**
 * Barrel export for all Zustand stores.
 * Import stores from here, not from their individual files.
 *
 * Import pattern:
 *   import { useWalletStore, selectActiveAccount } from '@/lib/stores'
 */

// ─── Sprint 1 stores (persisted) ───────────────────────────────────────────
export { usePreferencesStore } from './preferencesStore'
export type { PreferencesState, FiatCurrency, AutoLockMinutes } from './preferencesStore'

export { useUIStore } from './uiStore'
export type { UIState, Toast, ToastVariant, ModalId } from './uiStore'

// ─── Sprint 2 stores (memory only) ─────────────────────────────────────────
export {
  useWalletStore,
  selectWallet,
  selectAccounts,
  selectActiveAccount,
  selectIsLocked,
  selectWalletError,
} from './walletStore'
export type { WalletStore } from './walletStore'

export { useNetworkStore, selectCurrentChainId } from './networkStore'
export type { NetworkStore } from './networkStore'

export { useSessionStore, selectIsUnlocked, selectLastActivityAt } from './sessionStore'
export type { SessionStore } from './sessionStore'

export { useSecurityStore, selectAutoLockMinutes } from './securityStore'
export type { SecurityStore } from './securityStore'

export {
  useOnboardingStore,
  selectOnboardingStep,
  selectOnboardingMode,
  selectCompletedSteps,
} from './onboardingStore'
export type { OnboardingStore } from './onboardingStore'
