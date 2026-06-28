/**
 * RpcProviderRegistry.test.ts
 *
 * Covers: register, unregister, get, has, list, replace, clear, size.
 */

import { describe, it, expect } from 'vitest'
import { RpcProviderRegistry } from '../RpcProviderRegistry'
import { NullRpcProvider } from '../NullRpcProvider'
import { WalletError } from '@/domain/errors'
import type { IRpcProvider } from '../IRpcProvider'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EVM = new NullRpcProvider('evm', 'ethereum-sepolia')
const SVM = new NullRpcProvider('svm', 'solana-devnet')
const NATIVE = new NullRpcProvider('native', 'qorechain-devnet')

function freshRegistry(): RpcProviderRegistry {
  return new RpcProviderRegistry()
}

// ─── register ─────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.register', () => {
  it('registers a provider and increments size', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    expect(reg.size).toBe(1)
    expect(reg.has('ethereum-sepolia')).toBe(true)
  })

  it('registers multiple providers', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.register(SVM)
    reg.register(NATIVE)
    expect(reg.size).toBe(3)
  })

  it('throws UNSUPPORTED_CHAIN when registering a duplicate chainId', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    let err: unknown
    try {
      reg.register(new NullRpcProvider('evm', 'ethereum-sepolia'))
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('UNSUPPORTED_CHAIN')
      expect(err.message).toContain('ethereum-sepolia')
    }
  })
})

// ─── unregister ───────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.unregister', () => {
  it('removes a registered provider', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.unregister('ethereum-sepolia')
    expect(reg.has('ethereum-sepolia')).toBe(false)
    expect(reg.size).toBe(0)
  })

  it('throws UNSUPPORTED_CHAIN when chainId is not registered', () => {
    const reg = freshRegistry()
    let err: unknown
    try {
      reg.unregister('unknown-chain')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('allows re-registration after unregister', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.unregister('ethereum-sepolia')
    reg.register(EVM)
    expect(reg.size).toBe(1)
  })
})

// ─── get ──────────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.get', () => {
  it('returns the registered provider', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    const result = reg.get('ethereum-sepolia')
    expect(result).toBe(EVM)
  })

  it('returns undefined for unregistered chainId', () => {
    const reg = freshRegistry()
    expect(reg.get('unknown-chain')).toBeUndefined()
  })

  it('returns the correct provider when multiple are registered', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.register(SVM)
    reg.register(NATIVE)
    expect(reg.get('solana-devnet')).toBe(SVM)
    expect(reg.get('qorechain-devnet')).toBe(NATIVE)
  })
})

// ─── has ──────────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.has', () => {
  it('returns true for registered chainId', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    expect(reg.has('ethereum-sepolia')).toBe(true)
  })

  it('returns false for unregistered chainId', () => {
    const reg = freshRegistry()
    expect(reg.has('ethereum-sepolia')).toBe(false)
  })
})

// ─── replace ──────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.replace', () => {
  it('inserts when no provider is registered', () => {
    const reg = freshRegistry()
    reg.replace(EVM)
    expect(reg.has('ethereum-sepolia')).toBe(true)
    expect(reg.size).toBe(1)
  })

  it('overwrites an existing provider without throwing', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    const newProvider = new NullRpcProvider('evm', 'ethereum-sepolia')
    reg.replace(newProvider)
    expect(reg.get('ethereum-sepolia')).toBe(newProvider)
    expect(reg.size).toBe(1)
  })

  it('does not increment size on replacement', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.replace(new NullRpcProvider('evm', 'ethereum-sepolia'))
    expect(reg.size).toBe(1)
  })
})

// ─── list ─────────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.list', () => {
  it('returns empty array when empty', () => {
    expect(freshRegistry().list()).toEqual([])
  })

  it('returns all registered providers in insertion order', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.register(SVM)
    reg.register(NATIVE)
    const list = reg.list()
    expect(list).toHaveLength(3)
    expect(list[0]).toBe(EVM)
    expect(list[1]).toBe(SVM)
    expect(list[2]).toBe(NATIVE)
  })

  it('returns a copy — mutation does not affect the registry', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    const list = reg.list()
    list.push(SVM as IRpcProvider)
    expect(reg.size).toBe(1)
  })
})

// ─── clear ────────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.clear', () => {
  it('removes all providers', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.register(SVM)
    reg.clear()
    expect(reg.size).toBe(0)
    expect(reg.list()).toEqual([])
  })

  it('clears an already-empty registry without throwing', () => {
    expect(() => freshRegistry().clear()).not.toThrow()
  })
})

// ─── size ─────────────────────────────────────────────────────────────────────

describe('RpcProviderRegistry.size', () => {
  it('starts at 0', () => {
    expect(freshRegistry().size).toBe(0)
  })

  it('increments on register', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    expect(reg.size).toBe(1)
    reg.register(SVM)
    expect(reg.size).toBe(2)
  })

  it('decrements on unregister', () => {
    const reg = freshRegistry()
    reg.register(EVM)
    reg.unregister('ethereum-sepolia')
    expect(reg.size).toBe(0)
  })
})
