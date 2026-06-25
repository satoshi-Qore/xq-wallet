/**
 * preferencesStore — user preferences persisted to localStorage.
 * Non-sensitive data only. Never store key material here.
 *
 * Architecture: STATE_MANAGEMENT.md §2.5
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ─────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system'
export type FiatCurrency = 'USD' | 'EUR' | 'GBP'
export type AutoLockMinutes = 5 | 15 | 30 | 60 | 0

export interface PreferencesState {
  /** UI colour scheme preference. 'system' follows OS setting. */
  theme: Theme
  /** Fiat currency for balance display. */
  currency: FiatCurrency
  /** BCP 47 locale string. */
  locale: string
  /** Auto-lock timeout. 0 = never lock. */
  autoLockMinutes: AutoLockMinutes

  // Actions
  setTheme: (theme: Theme) => void
  setCurrency: (currency: FiatCurrency) => void
  setLocale: (locale: string) => void
  setAutoLock: (minutes: AutoLockMinutes) => void
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Defaults
      theme: 'system',
      currency: 'USD',
      locale: 'en-US',
      autoLockMinutes: 15,

      // Actions
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setLocale: (locale) => set({ locale }),
      setAutoLock: (autoLockMinutes) => set({ autoLockMinutes }),
    }),
    {
      name: 'xqw-preferences',
      storage: createJSONStorage(() => {
        // SSR-safe: return a no-op storage on the server
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          }
        }
        return window.localStorage
      }),
      // Only persist safe, non-sensitive fields
      partialize: (state) => ({
        theme: state.theme,
        currency: state.currency,
        locale: state.locale,
        autoLockMinutes: state.autoLockMinutes,
      }),
    },
  ),
)
