/**
 * preferencesStore — non-sensitive user preferences persisted to localStorage.
 *
 * Theme is intentionally NOT stored here.
 * next-themes is the single source of truth for theme (via ThemeProvider).
 * Storing theme in two places causes conflicts when the Settings page is built.
 *
 * Architecture: STATE_MANAGEMENT.md §2.5
 * P1-02: Removed theme/Theme/setTheme — next-themes owns theme state.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ─────────────────────────────────────────────────────────────────

export type FiatCurrency = 'USD' | 'EUR' | 'GBP'
export type AutoLockMinutes = 5 | 15 | 30 | 60 | 0

export interface PreferencesState {
  /** Fiat currency for balance display. */
  currency: FiatCurrency
  /** BCP 47 locale string. */
  locale: string
  /** Auto-lock timeout in minutes. 0 = never lock. */
  autoLockMinutes: AutoLockMinutes

  // Actions
  setCurrency: (currency: FiatCurrency) => void
  setLocale: (locale: string) => void
  setAutoLock: (minutes: AutoLockMinutes) => void
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Defaults
      currency: 'USD',
      locale: 'en-US',
      autoLockMinutes: 15,

      // Actions
      setCurrency: (currency) => set({ currency }),
      setLocale: (locale) => set({ locale }),
      setAutoLock: (autoLockMinutes) => set({ autoLockMinutes }),
    }),
    {
      name: 'xqw-preferences',
      storage: createJSONStorage(() => {
        // SSR-safe: no-op storage on the server
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          }
        }
        return window.localStorage
      }),
      // Explicitly list persisted fields — action functions are excluded
      partialize: (state) => ({
        currency: state.currency,
        locale: state.locale,
        autoLockMinutes: state.autoLockMinutes,
      }),
    },
  ),
)
