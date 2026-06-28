/**
 * WalletService — JSON-RPC client registry integration tests (Day 11).
 *
 * Verifies that WalletService correctly wires the JsonRpcClientRegistry:
 *   - Default empty registry when no option is provided.
 *   - Injected registry is used (not a fresh one).
 *   - getJsonRpcClient() returns the registered client or undefined.
 *   - registerJsonRpcClient() delegates to the registry.
 *   - replaceJsonRpcClient() allows upserts.
 *   - UNSUPPORTED_CHAIN is thrown for duplicate registration.
 */

import { describe, it, expect } from 'vitest'
import { WalletService } from '../WalletService'
import { JsonRpcClient } from '@/core/rpc/JsonRpcClient'
import { JsonRpcClientRegistry } from '@/core/rpc/JsonRpcClientRegistry'
import { WalletError } from '@/domain/errors'
import type { RpcEndpointMetadata } from '@/domain/rpc'
import type { FetchFn } from '@/core/rpc/JsonRpcClient'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAST_OPTIONS = { pbkdf2Iterations: 1 } as const

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

const noopFetch: FetchFn = () => Promise.resolve({} as Response)

function makeClient(chainId: string): JsonRpcClient {
  return new JsonRpcClient(makeEndpoint(chainId), noopFetch)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WalletService — JSON-RPC client registry', () => {
  // ─── Default (empty) registry ────────────────────────────────────────────

  describe('default empty registry', () => {
    it('getJsonRpcClient returns undefined for unregistered chain', () => {
      const svc = new WalletService(FAST_OPTIONS)
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBeUndefined()
    })

    it('starts with no clients registered', () => {
      const svc = new WalletService(FAST_OPTIONS)
      // No easy way to check size without exposing registry; verify via get
      expect(svc.getJsonRpcClient('any-chain')).toBeUndefined()
    })
  })

  // ─── Injected registry ───────────────────────────────────────────────────

  describe('injected jsonRpcClientRegistry', () => {
    it('uses the injected registry', () => {
      const client = makeClient('ethereum-sepolia')
      const registry = new JsonRpcClientRegistry()
      registry.register(client)

      const svc = new WalletService({ ...FAST_OPTIONS, jsonRpcClientRegistry: registry })
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBe(client)
    })

    it('returns undefined for chains not in the injected registry', () => {
      const registry = new JsonRpcClientRegistry()
      registry.register(makeClient('ethereum-sepolia'))

      const svc = new WalletService({ ...FAST_OPTIONS, jsonRpcClientRegistry: registry })
      expect(svc.getJsonRpcClient('solana-devnet')).toBeUndefined()
    })
  })

  // ─── registerJsonRpcClient() ──────────────────────────────────────────────

  describe('registerJsonRpcClient()', () => {
    it('makes the client retrievable via getJsonRpcClient()', () => {
      const svc = new WalletService(FAST_OPTIONS)
      const client = makeClient('ethereum-sepolia')
      svc.registerJsonRpcClient(client)
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBe(client)
    })

    it('throws UNSUPPORTED_CHAIN on duplicate registration', () => {
      const svc = new WalletService(FAST_OPTIONS)
      svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))
      expect(() => svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))).toThrow(
        expect.objectContaining({ code: 'UNSUPPORTED_CHAIN' }),
      )
    })

    it('allows registering multiple distinct chains', () => {
      const svc = new WalletService(FAST_OPTIONS)
      svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))
      svc.registerJsonRpcClient(makeClient('solana-devnet'))
      svc.registerJsonRpcClient(makeClient('qorechain-devnet'))
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBeDefined()
      expect(svc.getJsonRpcClient('solana-devnet')).toBeDefined()
      expect(svc.getJsonRpcClient('qorechain-devnet')).toBeDefined()
    })
  })

  // ─── replaceJsonRpcClient() ───────────────────────────────────────────────

  describe('replaceJsonRpcClient()', () => {
    it('registers when no client exists (upsert)', () => {
      const svc = new WalletService(FAST_OPTIONS)
      const client = makeClient('ethereum-sepolia')
      svc.replaceJsonRpcClient(client)
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBe(client)
    })

    it('overwrites an existing client without throwing', () => {
      const svc = new WalletService(FAST_OPTIONS)
      svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))
      const newClient = makeClient('ethereum-sepolia')
      svc.replaceJsonRpcClient(newClient)
      expect(svc.getJsonRpcClient('ethereum-sepolia')).toBe(newClient)
    })
  })

  // ─── WalletError shape ────────────────────────────────────────────────────

  it('duplicate registerJsonRpcClient throws a proper WalletError', () => {
    const svc = new WalletService(FAST_OPTIONS)
    svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))
    let caught: unknown
    try {
      svc.registerJsonRpcClient(makeClient('ethereum-sepolia'))
    } catch (err) {
      caught = err
    }
    expect(WalletError.isWalletError(caught)).toBe(true)
    if (WalletError.isWalletError(caught)) {
      expect(caught.code).toBe('UNSUPPORTED_CHAIN')
    }
  })
})
