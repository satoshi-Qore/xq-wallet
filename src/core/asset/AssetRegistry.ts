/**
 * AssetRegistry.ts — Catalogue of known asset definitions.
 *
 * The registry holds asset metadata only (symbol, decimals, contract addresses).
 * On-chain balance queries are delegated to IBalanceProvider.
 *
 * Analogous to ChainRegistry — a singleton-friendly class that is populated at
 * boot time with the default asset set and may be extended at runtime.
 *
 * Architecture: ARCHITECTURE.md §5.5 — Asset Layer
 */

import { WalletError } from '@/domain/errors'
import type { AnyAsset } from '@/domain/asset'
import type { VMType } from '@/domain/chain'

export class AssetRegistry {
  private readonly _assets = new Map<string, AnyAsset>()

  // ─── Mutation ──────────────────────────────────────────────────────────

  /**
   * Registers an asset definition.
   *
   * @param asset - Asset to register. `asset.id` must be unique in the registry.
   * @throws WalletError('ASSET_ALREADY_REGISTERED') if an asset with the same id
   *         is already present. Call `unregister()` first to replace it.
   */
  register(asset: AnyAsset): void {
    if (this._assets.has(asset.id)) {
      throw new WalletError(
        'ASSET_ALREADY_REGISTERED',
        `Asset '${asset.id}' is already registered. Call unregister() first to replace it.`,
      )
    }
    this._assets.set(asset.id, asset)
  }

  /**
   * Removes an asset from the registry.
   *
   * @param id - Asset id to remove.
   * @throws WalletError('ASSET_NOT_FOUND') if no asset with that id is registered.
   */
  unregister(id: string): void {
    if (!this._assets.has(id)) {
      throw new WalletError(
        'ASSET_NOT_FOUND',
        `Cannot unregister '${id}': no asset with that id is registered.`,
      )
    }
    this._assets.delete(id)
  }

  // ─── Queries ───────────────────────────────────────────────────────────

  /**
   * Returns the asset definition for the given id, or `undefined` if not found.
   *
   * @param id - Unique asset id (e.g. `"qorechain-devnet:native:QR"`).
   */
  getById(id: string): AnyAsset | undefined {
    return this._assets.get(id)
  }

  /**
   * Returns the first registered asset whose symbol matches the given value
   * (case-insensitive), or `undefined` if none is found.
   *
   * Symbol look-up is case-insensitive to handle "ETH" vs "eth".
   * When multiple assets share a symbol (e.g. USDC on different chains),
   * the first registered one is returned. Use `getByChain` for unambiguous look-ups.
   *
   * @param symbol - Ticker symbol to search for: "QR", "ETH", "SOL".
   */
  getBySymbol(symbol: string): AnyAsset | undefined {
    const upper = symbol.toUpperCase()
    for (const asset of this._assets.values()) {
      if (asset.symbol.toUpperCase() === upper) return asset
    }
    return undefined
  }

  /**
   * Returns all registered assets for the given chain id.
   *
   * @param chainId - ChainDefinition.id to filter by (e.g. `"qorechain-devnet"`).
   */
  getByChain(chainId: string): AnyAsset[] {
    const result: AnyAsset[] = []
    for (const asset of this._assets.values()) {
      if ('chainId' in asset && asset.chainId === chainId) {
        result.push(asset)
      }
    }
    return result
  }

  /**
   * Returns all registered assets for the given VM.
   *
   * @param vm - Virtual machine type: 'native' | 'evm' | 'svm'.
   */
  getByVM(vm: VMType): AnyAsset[] {
    const result: AnyAsset[] = []
    for (const asset of this._assets.values()) {
      if (asset.vm === vm) result.push(asset)
    }
    return result
  }

  /**
   * Returns all registered assets in insertion order.
   */
  list(): AnyAsset[] {
    return [...this._assets.values()]
  }

  /** Total number of registered assets. */
  get size(): number {
    return this._assets.size
  }
}
