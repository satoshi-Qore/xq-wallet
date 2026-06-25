/**
 * ChainRegistry.ts — Registry of all supported chain definitions.
 *
 * Single source of truth for chain configuration per PRIN-ARCH-05.
 * All chain metadata is read from here — never hardcoded in components, stores,
 * or hooks.
 *
 * Sprint 2: static definitions only, no network access.
 * Sprint 3: dynamic registration when the user adds a custom RPC.
 */

import { WalletError } from '@/domain/errors'
import type { ChainDefinition } from '@/domain/chain'
import type { ChainRegistryOptions } from './types'

export class ChainRegistry {
  private readonly _chains = new Map<string, ChainDefinition>()
  private readonly _defaultChainId: string | undefined

  constructor(options: ChainRegistryOptions = {}) {
    this._defaultChainId = options.defaultChainId
  }

  // ─── Mutation ────────────────────────────────────────────────────────────

  /**
   * Adds a chain definition to the registry.
   *
   * @throws WalletError('CHAIN_ALREADY_REGISTERED') if a chain with the same id
   *         is already registered. Call unregister() first to replace it.
   */
  register(definition: ChainDefinition): void {
    if (this._chains.has(definition.id)) {
      throw new WalletError(
        'CHAIN_ALREADY_REGISTERED',
        `Chain '${definition.id}' is already registered. Call unregister() first to replace it.`,
      )
    }
    this._chains.set(definition.id, definition)
  }

  /**
   * Removes a chain definition from the registry.
   *
   * @throws WalletError('UNSUPPORTED_CHAIN') if no chain with that id is registered.
   */
  unregister(id: string): void {
    if (!this._chains.has(id)) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `Cannot unregister '${id}': no chain with that id is registered.`,
      )
    }
    this._chains.delete(id)
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  /**
   * Returns the chain definition for the given id.
   *
   * @throws WalletError('UNSUPPORTED_CHAIN') if not registered.
   */
  get(id: string): ChainDefinition {
    const chain = this._chains.get(id)
    if (!chain) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `Chain '${id}' is not registered. Call register() with a ChainDefinition first.`,
      )
    }
    return chain
  }

  /**
   * Returns all registered chain definitions in registration order.
   * The returned array is frozen — mutations do not affect the registry.
   */
  getAll(): readonly ChainDefinition[] {
    return Object.freeze([...this._chains.values()])
  }

  /**
   * Returns the default chain definition.
   *
   * If defaultChainId was provided in the constructor, that chain is returned.
   * Otherwise the first registered chain is returned.
   *
   * @throws WalletError('UNSUPPORTED_CHAIN') if no chains are registered,
   *         or if defaultChainId was set but is not registered.
   */
  getDefault(): ChainDefinition {
    if (this._chains.size === 0) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        'No chains are registered. Call register() with at least one ChainDefinition.',
      )
    }
    if (this._defaultChainId !== undefined) {
      return this.get(this._defaultChainId)
    }
    // Map preserves insertion order; size > 0 is guaranteed above
    for (const chain of this._chains.values()) {
      return chain
    }
    // Unreachable — satisfies TypeScript control-flow analysis
    throw new WalletError('UNSUPPORTED_CHAIN', 'No chains are registered.')
  }

  /**
   * Returns true if a chain with the given id is registered.
   * Never throws.
   */
  exists(id: string): boolean {
    return this._chains.has(id)
  }

  /** Number of currently registered chains. */
  get size(): number {
    return this._chains.size
  }
}
