/**
 * RpcProviderRegistry.ts — Registry of IRpcProvider instances keyed by chainId.
 *
 * Analogous to ChainRegistry (core/chain/ChainRegistry.ts) and
 * AssetRegistry (core/asset/AssetRegistry.ts) — a typed Map with lifecycle
 * methods designed for both server-side singletons and test-scoped instances.
 *
 * Sprint 2: pre-populated with NullRpcProvider for each of the 3 devnet chains.
 * Sprint 3: replace entries with concrete providers (EthersRpcProvider, etc.)
 *           via `registry.replace(provider)` without changing any calling code.
 *
 * Key design choices:
 *   - One provider per chainId (the registry is a 1:1 map).
 *   - Future multi-provider support (load balancing, failover) belongs to Sprint 4.
 *     The `list()` method returns all current providers to enable upstream routing.
 *   - `get()` returns `undefined` on a miss — callers that require a provider
 *     must handle the undefined case (typically by throwing RPC_NOT_CONNECTED).
 *   - `replace()` updates without needing an explicit `unregister()` first,
 *     making provider hot-swapping ergonomic in tests and Sprint 3 setup code.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation
 */

import { WalletError } from '@/domain/errors'
import type { IRpcProvider } from './IRpcProvider'

/**
 * Registry that holds one {@link IRpcProvider} per chain (identified by chainId).
 *
 * Sprint 2 default is seeded by WalletService with NullRpcProvider instances.
 * Tests and Sprint 3 bootstrap code may construct and populate independent
 * registries without affecting any global state.
 */
export class RpcProviderRegistry {
  private readonly _providers = new Map<string, IRpcProvider>()

  // ─── Mutation ──────────────────────────────────────────────────────────

  /**
   * Registers an RPC provider.
   *
   * @param provider - Provider to register. `provider.chainId` must be unique.
   * @throws WalletError('UNSUPPORTED_CHAIN') if a provider for that chainId is
   *         already registered. Use `replace()` to overwrite an existing entry.
   */
  register(provider: IRpcProvider): void {
    if (this._providers.has(provider.chainId)) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `An RPC provider for chain '${provider.chainId}' is already registered. ` +
          'Call replace() to overwrite an existing entry.',
      )
    }
    this._providers.set(provider.chainId, provider)
  }

  /**
   * Removes the provider registered for the given chainId.
   *
   * @param chainId - ChainDefinition.id of the provider to remove.
   * @throws WalletError('UNSUPPORTED_CHAIN') if no provider is registered for that chainId.
   */
  unregister(chainId: string): void {
    if (!this._providers.has(chainId)) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `Cannot unregister RPC provider for chain '${chainId}': none is registered.`,
      )
    }
    this._providers.delete(chainId)
  }

  /**
   * Atomically replaces the provider for the given chainId.
   *
   * Unlike `unregister()` + `register()`, this is a single operation — safe
   * to call whether or not a provider is currently registered.
   *
   * @param provider - New provider. The existing provider for
   *                   `provider.chainId`, if any, is discarded.
   */
  replace(provider: IRpcProvider): void {
    this._providers.set(provider.chainId, provider)
  }

  /**
   * Removes all registered providers.
   *
   * Primarily used in test teardown to reset registry state between tests.
   */
  clear(): void {
    this._providers.clear()
  }

  // ─── Queries ───────────────────────────────────────────────────────────

  /**
   * Returns the provider registered for the given chainId,
   * or `undefined` if none is registered.
   *
   * @param chainId - ChainDefinition.id to look up.
   */
  get(chainId: string): IRpcProvider | undefined {
    return this._providers.get(chainId)
  }

  /**
   * Returns whether a provider is registered for the given chainId.
   *
   * @param chainId - ChainDefinition.id to test.
   */
  has(chainId: string): boolean {
    return this._providers.has(chainId)
  }

  /**
   * Returns all registered providers in insertion order.
   *
   * Intended for health-monitoring dashboards and future load-balancer code
   * that needs to inspect or iterate over all available providers.
   */
  list(): IRpcProvider[] {
    return [...this._providers.values()]
  }

  /** Total number of registered providers. */
  get size(): number {
    return this._providers.size
  }
}
