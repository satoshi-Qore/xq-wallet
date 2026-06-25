/**
 * networkStore.ts — Chain / network selection state.
 *
 * Wraps ChainRegistry to expose the currently selected chain and the list
 * of supported chains as reactive Zustand state.
 *
 * Sprint 2: no RPC, no websockets. Metadata only.
 * Sprint 3: add RPC health status and connection lifecycle here.
 *
 * Architecture: STATE_MANAGEMENT.md §2.3 — networkStore
 */

import { create } from 'zustand'
import type { ChainDefinition } from '@/domain/chain'
import { ChainRegistry, DEFAULT_CHAINS } from '@/core/chain'

// ─── Module-level registry ref ────────────────────────────────────────────

function makeRegistry(): ChainRegistry {
  const reg = new ChainRegistry({ defaultChainId: 'qorechain-devnet' })
  for (const chain of DEFAULT_CHAINS) {
    reg.register(chain)
  }
  return reg
}

let _registry: ChainRegistry = makeRegistry()

const DEFAULT_CHAIN_ID = 'qorechain-devnet'

// ─── Types ─────────────────────────────────────────────────────────────────

interface NetworkState {
  /** ID of the chain the user currently has selected. */
  currentChainId: string
}

export interface NetworkStore extends NetworkState {
  /**
   * Switches the active chain.
   * @throws WalletError('UNSUPPORTED_CHAIN') if chainId is not registered.
   */
  switchChain: (chainId: string) => void
  /** Returns all chains registered in the registry (ordered). */
  supportedChains: () => readonly ChainDefinition[]
  /** Returns the ChainDefinition for the currently selected chain. */
  getCurrentChain: () => ChainDefinition
  /** Test helper — rebuilds the registry and resets state. */
  _reset: () => void
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useNetworkStore = create<NetworkStore>()((set, get) => ({
  currentChainId: DEFAULT_CHAIN_ID,

  switchChain: (chainId) => {
    // Throws WalletError('UNSUPPORTED_CHAIN') if not registered — let it propagate.
    _registry.get(chainId)
    set({ currentChainId: chainId })
  },

  supportedChains: () => _registry.getAll(),

  getCurrentChain: () => _registry.get(get().currentChainId),

  _reset: () => {
    _registry = makeRegistry()
    set({ currentChainId: DEFAULT_CHAIN_ID })
  },
}))

// ─── Selectors ─────────────────────────────────────────────────────────────

export const selectCurrentChainId = (s: NetworkStore): string => s.currentChainId
