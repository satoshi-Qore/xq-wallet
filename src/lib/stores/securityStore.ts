/**
 * securityStore.ts — Security preferences state.
 *
 * Holds user-configurable security settings. Intentionally kept separate from
 * preferencesStore so that security-critical settings can be audited in isolation.
 *
 * biometricAvailable and biometricEnabled are placeholders for Sprint 3+ when
 * platform biometric APIs (WebAuthn / Touch ID) are integrated. They are
 * typed here so the UI can safely reference them without branching on undefined.
 *
 * No persistence. No browser APIs. No platform calls.
 *
 * Architecture: STATE_MANAGEMENT.md §2.5 — securityStore
 */

import { create } from 'zustand'
import type { AutoLockMinutes } from './preferencesStore'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SecurityState {
  /** Auto-lock timeout in minutes. 0 = never lock automatically. */
  autoLockMinutes: AutoLockMinutes
  /**
   * Placeholder — whether the current device supports biometric authentication.
   * Always false in Sprint 2. Updated in Sprint 3 when WebAuthn is integrated.
   */
  biometricAvailable: boolean
  /**
   * Placeholder — whether the user has opted in to biometric unlock.
   * Always false in Sprint 2.
   */
  biometricEnabled: boolean
}

export interface SecurityStore extends SecurityState {
  updateAutoLock: (minutes: AutoLockMinutes) => void
  /** Test helper — resets to initial state. */
  _reset: () => void
}

const INITIAL_SECURITY_STATE: SecurityState = {
  autoLockMinutes: 15,
  biometricAvailable: false,
  biometricEnabled: false,
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useSecurityStore = create<SecurityStore>()((set) => ({
  ...INITIAL_SECURITY_STATE,

  updateAutoLock: (minutes) => set({ autoLockMinutes: minutes }),
  _reset: () => set({ ...INITIAL_SECURITY_STATE }),
}))

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectAutoLockMinutes = (s: SecurityStore): AutoLockMinutes => s.autoLockMinutes
