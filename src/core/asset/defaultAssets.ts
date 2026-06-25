/**
 * defaultAssets.ts — Pre-registered asset definitions for Sprint 2 devnet chains.
 *
 * One NativeAsset per enabled chain definition. Symbols and decimals here MUST
 * stay in sync with the corresponding ChainDefinition.nativeCurrency values in
 * src/core/chain/definitions/.
 *
 * Sprint 3: this list grows when fungible-token and NFT support is added.
 */

import type { NativeAsset } from '@/domain/asset'
import { AssetRegistry } from './AssetRegistry'

/**
 * QoreChain Devnet native token.
 * Synced with qorechain-devnet.ts — nativeCurrency.symbol = "QR", decimals = 18.
 */
export const QR_DEVNET: NativeAsset = {
  id: 'qorechain-devnet:native:QR',
  type: 'native',
  symbol: 'QR',
  name: 'QoreChain Token',
  decimals: 18,
  vm: 'native',
  chainId: 'qorechain-devnet',
  logoKey: 'qorechain',
}

/**
 * Ethereum Sepolia native token (Sepolia Ether).
 * Synced with ethereum-sepolia.ts — nativeCurrency.symbol = "SEP", decimals = 18.
 */
export const SEP_SEPOLIA: NativeAsset = {
  id: 'ethereum-sepolia:native:SEP',
  type: 'native',
  symbol: 'SEP',
  name: 'Sepolia Ether',
  decimals: 18,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  logoKey: 'ethereum',
}

/**
 * Solana Devnet native token.
 * Synced with solana-devnet.ts — nativeCurrency.symbol = "SOL", decimals = 9.
 */
export const SOL_DEVNET: NativeAsset = {
  id: 'solana-devnet:native:SOL',
  type: 'native',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  vm: 'svm',
  chainId: 'solana-devnet',
  logoKey: 'solana',
}

/** All default Sprint 2 assets, in registration order. */
export const DEFAULT_ASSETS: readonly NativeAsset[] = [QR_DEVNET, SEP_SEPOLIA, SOL_DEVNET]

/**
 * Creates an AssetRegistry pre-populated with the three default devnet native assets.
 *
 * This is the default asset registry used by WalletService when the caller does
 * not inject a custom one.
 */
export function createDefaultAssetRegistry(): AssetRegistry {
  const registry = new AssetRegistry()
  for (const asset of DEFAULT_ASSETS) {
    registry.register(asset)
  }
  return registry
}
