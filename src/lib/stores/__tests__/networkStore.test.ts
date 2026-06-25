/**
 * networkStore.test.ts
 *
 * Tests for useNetworkStore: initial state, switchChain, supportedChains,
 * getCurrentChain, error propagation, and reset.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useNetworkStore, selectCurrentChainId } from '../networkStore'
import { WalletError } from '@/domain/errors'

beforeEach(() => {
  useNetworkStore.getState()._reset()
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('networkStore — initial state', () => {
  it('currentChainId is qorechain-devnet', () => {
    expect(useNetworkStore.getState().currentChainId).toBe('qorechain-devnet')
  })
})

// ─── supportedChains() ─────────────────────────────────────────────────────

describe('networkStore — supportedChains()', () => {
  it('returns exactly 3 chains', () => {
    expect(useNetworkStore.getState().supportedChains()).toHaveLength(3)
  })

  it('includes qorechain-devnet', () => {
    const ids = useNetworkStore
      .getState()
      .supportedChains()
      .map((c) => c.id)
    expect(ids).toContain('qorechain-devnet')
  })

  it('includes ethereum-sepolia', () => {
    const ids = useNetworkStore
      .getState()
      .supportedChains()
      .map((c) => c.id)
    expect(ids).toContain('ethereum-sepolia')
  })

  it('includes solana-devnet', () => {
    const ids = useNetworkStore
      .getState()
      .supportedChains()
      .map((c) => c.id)
    expect(ids).toContain('solana-devnet')
  })

  it('returned array is frozen', () => {
    expect(Object.isFrozen(useNetworkStore.getState().supportedChains())).toBe(true)
  })

  it('covers all three VM types', () => {
    const vms = new Set(
      useNetworkStore
        .getState()
        .supportedChains()
        .map((c) => c.vm),
    )
    expect(vms.has('native')).toBe(true)
    expect(vms.has('evm')).toBe(true)
    expect(vms.has('svm')).toBe(true)
  })
})

// ─── getCurrentChain() ─────────────────────────────────────────────────────

describe('networkStore — getCurrentChain()', () => {
  it('returns qorechain-devnet definition by default', () => {
    const chain = useNetworkStore.getState().getCurrentChain()
    expect(chain.id).toBe('qorechain-devnet')
  })

  it('default chain has vm: native', () => {
    expect(useNetworkStore.getState().getCurrentChain().vm).toBe('native')
  })
})

// ─── switchChain() ─────────────────────────────────────────────────────────

describe('networkStore — switchChain()', () => {
  it('switches to ethereum-sepolia', () => {
    useNetworkStore.getState().switchChain('ethereum-sepolia')
    expect(useNetworkStore.getState().currentChainId).toBe('ethereum-sepolia')
  })

  it('getCurrentChain() reflects the new chain after switch', () => {
    useNetworkStore.getState().switchChain('ethereum-sepolia')
    expect(useNetworkStore.getState().getCurrentChain().vm).toBe('evm')
  })

  it('switches to solana-devnet', () => {
    useNetworkStore.getState().switchChain('solana-devnet')
    expect(useNetworkStore.getState().getCurrentChain().vm).toBe('svm')
  })

  it('throws WalletError for unknown chain id', () => {
    expect(() => useNetworkStore.getState().switchChain('does-not-exist')).toThrow(WalletError)
  })

  it('error code is UNSUPPORTED_CHAIN for unknown chain', () => {
    try {
      useNetworkStore.getState().switchChain('unknown')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('currentChainId is unchanged after a failed switch', () => {
    expect(() => useNetworkStore.getState().switchChain('invalid')).toThrow()
    expect(useNetworkStore.getState().currentChainId).toBe('qorechain-devnet')
  })

  it('can cycle through all three chains', () => {
    useNetworkStore.getState().switchChain('ethereum-sepolia')
    useNetworkStore.getState().switchChain('solana-devnet')
    useNetworkStore.getState().switchChain('qorechain-devnet')
    expect(useNetworkStore.getState().currentChainId).toBe('qorechain-devnet')
  })
})

// ─── selectCurrentChainId ──────────────────────────────────────────────────

describe('networkStore — selectCurrentChainId', () => {
  it('returns initial chain id', () => {
    expect(selectCurrentChainId(useNetworkStore.getState())).toBe('qorechain-devnet')
  })

  it('reflects chain switch', () => {
    useNetworkStore.getState().switchChain('ethereum-sepolia')
    expect(selectCurrentChainId(useNetworkStore.getState())).toBe('ethereum-sepolia')
  })
})

// ─── _reset() ──────────────────────────────────────────────────────────────

describe('networkStore — _reset()', () => {
  it('restores currentChainId to qorechain-devnet', () => {
    useNetworkStore.getState().switchChain('solana-devnet')
    useNetworkStore.getState()._reset()
    expect(useNetworkStore.getState().currentChainId).toBe('qorechain-devnet')
  })

  it('supportedChains() still returns 3 chains after reset', () => {
    useNetworkStore.getState()._reset()
    expect(useNetworkStore.getState().supportedChains()).toHaveLength(3)
  })
})
