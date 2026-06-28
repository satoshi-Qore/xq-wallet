/**
 * JsonRpcClientRegistry — unit tests.
 *
 * Covers: register, unregister, replace, get, has, list, clear, size,
 * duplicate-register guard, unregister-missing guard.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { JsonRpcClientRegistry } from '../JsonRpcClientRegistry'
import { JsonRpcClient } from '../JsonRpcClient'
import { WalletError } from '@/domain/errors'
import type { RpcEndpointMetadata } from '@/domain/rpc'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEndpoint(chainId: string): RpcEndpointMetadata {
  return {
    url: `https://rpc.${chainId}.example.com`,
    chainId,
    providerName: 'TestProvider',
    priority: 1,
    timeoutMs: 5_000,
    weight: 1,
  }
}

const noopFetch = (): Promise<Response> => Promise.resolve({} as Response)

function makeClient(chainId: string): JsonRpcClient {
  return new JsonRpcClient(makeEndpoint(chainId), noopFetch)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JsonRpcClientRegistry', () => {
  let registry: JsonRpcClientRegistry

  beforeEach(() => {
    registry = new JsonRpcClientRegistry()
  })

  // ─── Initial state ───────────────────────────────────────────────────────

  it('starts empty', () => {
    expect(registry.size).toBe(0)
    expect(registry.list()).toHaveLength(0)
  })

  // ─── register() ──────────────────────────────────────────────────────────

  describe('register()', () => {
    it('registers a client', () => {
      registry.register(makeClient('ethereum-sepolia'))
      expect(registry.size).toBe(1)
    })

    it('makes the client retrievable via get()', () => {
      const client = makeClient('ethereum-sepolia')
      registry.register(client)
      expect(registry.get('ethereum-sepolia')).toBe(client)
    })

    it('throws UNSUPPORTED_CHAIN when registering a duplicate chainId', () => {
      registry.register(makeClient('ethereum-sepolia'))
      expect(() => registry.register(makeClient('ethereum-sepolia'))).toThrow(
        expect.objectContaining({ code: 'UNSUPPORTED_CHAIN' }),
      )
    })

    it('allows registering different chains independently', () => {
      registry.register(makeClient('ethereum-sepolia'))
      registry.register(makeClient('solana-devnet'))
      registry.register(makeClient('qorechain-devnet'))
      expect(registry.size).toBe(3)
    })
  })

  // ─── unregister() ────────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('removes a registered client', () => {
      registry.register(makeClient('ethereum-sepolia'))
      registry.unregister('ethereum-sepolia')
      expect(registry.has('ethereum-sepolia')).toBe(false)
      expect(registry.size).toBe(0)
    })

    it('throws UNSUPPORTED_CHAIN for an unknown chainId', () => {
      expect(() => registry.unregister('unknown-chain')).toThrow(
        expect.objectContaining({ code: 'UNSUPPORTED_CHAIN' }),
      )
    })
  })

  // ─── replace() ───────────────────────────────────────────────────────────

  describe('replace()', () => {
    it('registers when chainId is not yet registered', () => {
      registry.replace(makeClient('ethereum-sepolia'))
      expect(registry.has('ethereum-sepolia')).toBe(true)
    })

    it('overwrites an existing client without throwing', () => {
      const first = makeClient('ethereum-sepolia')
      const second = makeClient('ethereum-sepolia')
      registry.register(first)
      registry.replace(second)
      expect(registry.get('ethereum-sepolia')).toBe(second)
    })

    it('does not increase size on overwrite', () => {
      registry.register(makeClient('ethereum-sepolia'))
      registry.replace(makeClient('ethereum-sepolia'))
      expect(registry.size).toBe(1)
    })
  })

  // ─── get() / has() ───────────────────────────────────────────────────────

  describe('get() / has()', () => {
    it('get() returns undefined for unregistered chain', () => {
      expect(registry.get('no-such-chain')).toBeUndefined()
    })

    it('has() returns false for unregistered chain', () => {
      expect(registry.has('no-such-chain')).toBe(false)
    })

    it('has() returns true for registered chain', () => {
      registry.register(makeClient('ethereum-sepolia'))
      expect(registry.has('ethereum-sepolia')).toBe(true)
    })
  })

  // ─── list() ──────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns all registered clients', () => {
      const a = makeClient('ethereum-sepolia')
      const b = makeClient('solana-devnet')
      registry.register(a)
      registry.register(b)
      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list).toContain(a)
      expect(list).toContain(b)
    })

    it('returns a copy — mutating does not affect registry', () => {
      registry.register(makeClient('ethereum-sepolia'))
      const list = registry.list()
      list.pop()
      expect(registry.size).toBe(1)
    })
  })

  // ─── clear() ─────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('empties the registry', () => {
      registry.register(makeClient('ethereum-sepolia'))
      registry.register(makeClient('solana-devnet'))
      registry.clear()
      expect(registry.size).toBe(0)
      expect(registry.list()).toHaveLength(0)
    })
  })

  // ─── WalletError shape ────────────────────────────────────────────────────

  it('register duplicate throws a proper WalletError', () => {
    registry.register(makeClient('ethereum-sepolia'))
    let caught: unknown
    try {
      registry.register(makeClient('ethereum-sepolia'))
    } catch (err) {
      caught = err
    }
    expect(WalletError.isWalletError(caught)).toBe(true)
    if (WalletError.isWalletError(caught)) {
      expect(caught.code).toBe('UNSUPPORTED_CHAIN')
      expect(caught.message).toContain('ethereum-sepolia')
    }
  })
})
