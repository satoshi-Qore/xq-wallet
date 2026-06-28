/**
 * JsonRpcClientRegistry.ts — Registry of JsonRpcClient instances, keyed by chainId.
 *
 * Provides the same lifecycle semantics as RpcProviderRegistry:
 *   register()  — add a client; throws if the chainId is already registered.
 *   unregister()— remove a client; throws if the chainId is not registered.
 *   replace()   — upsert; never throws.
 *   get()       — returns the client or undefined.
 *   has() / list() / clear() / size — standard map operations.
 *
 * WalletService holds an instance of this registry (injected or default-empty)
 * so Sprint 3 providers can register their JsonRpcClient instances without
 * changing any calling code.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation (Day 11)
 */

import { WalletError } from '@/domain/errors'
import { JsonRpcClient } from './JsonRpcClient'

/**
 * Maps chainId strings to their corresponding JsonRpcClient instances.
 *
 * One client per chain is enforced by register(); use replace() for upserts.
 */
export class JsonRpcClientRegistry {
  private readonly _clients = new Map<string, JsonRpcClient>()

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Register a new client for its endpoint's chainId.
   *
   * @throws WalletError('UNSUPPORTED_CHAIN') if a client for that chainId is
   *         already registered. Use replace() to overwrite an existing entry.
   */
  register(client: JsonRpcClient): void {
    const { chainId } = client.endpoint
    if (this._clients.has(chainId)) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `A JSON-RPC client for chain '${chainId}' is already registered. ` +
          'Use replace() to overwrite an existing entry.',
      )
    }
    this._clients.set(chainId, client)
  }

  /**
   * Remove the client for the given chainId.
   *
   * @throws WalletError('UNSUPPORTED_CHAIN') if no client is registered for
   *         that chainId.
   */
  unregister(chainId: string): void {
    if (!this._clients.has(chainId)) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `No JSON-RPC client registered for chain '${chainId}'.`,
      )
    }
    this._clients.delete(chainId)
  }

  /**
   * Register or replace the client for its endpoint's chainId (upsert).
   * Never throws — use this when idempotent registration is desired.
   */
  replace(client: JsonRpcClient): void {
    this._clients.set(client.endpoint.chainId, client)
  }

  /** Remove all registered clients. */
  clear(): void {
    this._clients.clear()
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  /**
   * Retrieve the client for the given chainId.
   * Returns undefined if no client is registered for that chain.
   */
  get(chainId: string): JsonRpcClient | undefined {
    return this._clients.get(chainId)
  }

  /** Returns true if a client is registered for the given chainId. */
  has(chainId: string): boolean {
    return this._clients.has(chainId)
  }

  /**
   * Returns a shallow copy of all registered clients.
   * Mutating the returned array does not affect the registry.
   */
  list(): JsonRpcClient[] {
    return [...this._clients.values()]
  }

  /** Number of registered clients. */
  get size(): number {
    return this._clients.size
  }
}
