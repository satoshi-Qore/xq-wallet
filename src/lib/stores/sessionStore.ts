/**
 * sessionStore.ts — UI-level lock / session state.
 *
 * Tracks whether the user's session is active (unlocked) and records the
 * timestamp of last activity for auto-lock timer support.
 *
 * This store is intentionally separate from walletStore:
 *   - walletStore tracks cryptographic lock state (via WalletService)
 *   - sessionStore tracks UI session state and activity timestamps
 *
 * The lock screen coordinator (to be built in Sprint 2 Days 6–8) is
 * responsible for keeping these two stores in sync.
 *
 * No persistence. Resets on page reload by design.
 *
 * Architecture: STATE_MANAGEMENT.md §2.4 — sessionStore
 */

import { create } from 'zustand'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SessionState {
  /** True when the user has an active unlocked session. */
  isUnlocked: boolean
  /** Unix timestamp (ms) of the last recorded user activity. null if never active. */
  lastActivityAt: number | null
}

export interface SessionStore extends SessionState {
  /** Mark the session as unlocked and record the current timestamp. */
  unlock: () => void
  /** Mark the session as locked. Does not clear lastActivityAt. */
  lock: () => void
  /** Update lastActivityAt to now (call on user interaction for auto-lock). */
  recordActivity: () => void
  /** Test helper — resets to initial state. */
  _reset: () => void
}

const INITIAL_SESSION_STATE: SessionState = {
  isUnlocked: false,
  lastActivityAt: null,
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionStore>()((set) => ({
  ...INITIAL_SESSION_STATE,

  unlock: () => set({ isUnlocked: true, lastActivityAt: Date.now() }),
  lock: () => set({ isUnlocked: false }),
  recordActivity: () => set({ lastActivityAt: Date.now() }),
  _reset: () => set({ ...INITIAL_SESSION_STATE }),
}))

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectIsUnlocked = (s: SessionStore): boolean => s.isUnlocked
export const selectLastActivityAt = (s: SessionStore): number | null => s.lastActivityAt
