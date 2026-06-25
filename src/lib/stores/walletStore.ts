/**
 * walletStore.ts — Wallet session state.
 *
 * Thin reactive wrapper around WalletService. Mirrors the service's public state
 * into Zustand so React components can subscribe to changes without holding a
 * service reference directly.
 *
 * Key invariant (SEC-01): the mnemonic never enters this store.
 * createWallet() returns it in-band to the caller, who must show it once
 * and discard it. It is not stored here.
 *
 * Architecture: STATE_MANAGEMENT.md §2.2 — walletStore
 */

import { create } from 'zustand'
import { WalletError } from '@/domain/errors'
import type { WalletMetadata, AccountMetadata } from '@/domain/wallet'
import {
  WalletService,
  type WalletServiceOptions,
  type CreateWalletOptions,
  type ImportWalletOptions,
  type CreateWalletResult,
} from '@/core/wallet'

// ─── Module-level service ref ──────────────────────────────────────────────
// Held outside Zustand state so it is not part of the reactive diff.
// Swapped by _reset() to allow test isolation.

let _service: WalletService = new WalletService()

// ─── Types ─────────────────────────────────────────────────────────────────

interface WalletState {
  /** Public wallet metadata. null until a wallet is created or imported. */
  wallet: WalletMetadata | null
  /** All derived accounts for the current wallet. */
  accounts: AccountMetadata[]
  /** ID of the account currently selected in the UI. */
  activeAccountId: string | null
  /** Mirrors WalletService.isLocked. */
  isLocked: boolean
  /** True while an async vault operation (create/import/unlock/derive) is in flight. */
  isLoading: boolean
  /** Last WalletError thrown by any action. Cleared by clearError() or the next action. */
  error: WalletError | null
}

export interface WalletStore extends WalletState {
  createWallet: (options: CreateWalletOptions) => Promise<CreateWalletResult>
  importWallet: (options: ImportWalletOptions) => Promise<void>
  unlockWallet: (password: string) => Promise<void>
  lockWallet: () => void
  deriveNextAccount: (name?: string) => Promise<AccountMetadata>
  setActiveAccount: (accountId: string) => void
  clearError: () => void
  /** Test helper — replaces the WalletService instance and resets all state. */
  _reset: (serviceOptions?: WalletServiceOptions) => void
}

const INITIAL_STATE: WalletState = {
  wallet: null,
  accounts: [],
  activeAccountId: null,
  isLocked: true,
  isLoading: false,
  error: null,
}

function toWalletError(err: unknown): WalletError {
  return WalletError.isWalletError(err)
    ? err
    : new WalletError('UNKNOWN', err instanceof Error ? err.message : String(err), err)
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useWalletStore = create<WalletStore>()((set) => ({
  ...INITIAL_STATE,

  createWallet: async (options) => {
    set({ isLoading: true, error: null })
    try {
      const result = await _service.createWallet(options)
      set({
        wallet: result.wallet,
        accounts: _service.getAccounts(),
        activeAccountId: result.wallet.activeAccountId,
        isLocked: false,
        isLoading: false,
      })
      return result
    } catch (err) {
      set({ isLoading: false, error: toWalletError(err) })
      throw err
    }
  },

  importWallet: async (options) => {
    set({ isLoading: true, error: null })
    try {
      await _service.importWallet(options)
      const accounts = _service.getAccounts()
      set({
        wallet: _service.wallet,
        accounts,
        activeAccountId: accounts[0]?.id ?? null,
        isLocked: false,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false, error: toWalletError(err) })
      throw err
    }
  },

  unlockWallet: async (password) => {
    set({ isLoading: true, error: null })
    try {
      await _service.unlockWallet(password)
      set({ isLocked: false, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: toWalletError(err) })
      throw err
    }
  },

  lockWallet: () => {
    _service.lockWallet()
    set({ isLocked: true })
  },

  deriveNextAccount: async (name) => {
    set({ isLoading: true, error: null })
    try {
      const account = await _service.deriveNextAccount(name)
      set({
        accounts: _service.getAccounts(),
        wallet: _service.wallet,
        isLoading: false,
      })
      return account
    } catch (err) {
      set({ isLoading: false, error: toWalletError(err) })
      throw err
    }
  },

  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

  clearError: () => set({ error: null }),

  _reset: (serviceOptions) => {
    _service = new WalletService(serviceOptions)
    set({ ...INITIAL_STATE })
  },
}))

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectWallet = (s: WalletStore): WalletMetadata | null => s.wallet
export const selectAccounts = (s: WalletStore): AccountMetadata[] => s.accounts
export const selectActiveAccount = (s: WalletStore): AccountMetadata | null =>
  s.accounts.find((a) => a.id === s.activeAccountId) ?? null
export const selectIsLocked = (s: WalletStore): boolean => s.isLocked
export const selectWalletError = (s: WalletStore): WalletError | null => s.error
