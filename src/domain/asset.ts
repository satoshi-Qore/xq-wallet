/**
 * Asset domain types.
 *
 * Pure TypeScript types — no logic, no imports from outside domain/.
 * Defines the asset catalogue model used by AssetRegistry and IBalanceProvider.
 *
 * Architecture: ARCHITECTURE.md §4 — Domain Models
 */

import type { VMType } from './chain'

// ─── Asset Types ────────────────────────────────────────────────────────────

/** Discriminator for the asset union. */
export type AssetType = 'native' | 'token' | 'nft'

/**
 * Fields shared by all asset types.
 *
 * Assets contain metadata only — no on-chain state or balance data.
 * Balances are fetched separately via IBalanceProvider.
 */
export interface Asset {
  /**
   * Stable unique identifier, scoped to chain and type.
   * Convention: `"${chainId}:native:${symbol}"` for native assets,
   *             `"${chainId}:token:${contractAddress}"` for fungible tokens,
   *             `"${chainId}:nft:${contractAddress}:${tokenId}"` for NFTs.
   */
  readonly id: string
  /** Asset category — used as the discriminant for the AnyAsset union */
  readonly type: AssetType
  /** Ticker symbol: "ETH", "QR", "SOL", "USDC" */
  readonly symbol: string
  /** Full display name: "Sepolia Ether", "QoreChain Token", "Solana" */
  readonly name: string
  /**
   * Decimal places used when formatting amounts for display.
   * EVM standard: 18. Solana: 9. QoreChain native: 18 (provisional).
   * NFTs: always 0 (non-fungible; indivisible).
   */
  readonly decimals: number
  /** Virtual machine this asset lives on */
  readonly vm: VMType
  /**
   * Key into the asset logo CDN sprite.
   * Empty string when no logo is available.
   */
  readonly logoKey: string
}

/**
 * A chain's intrinsic gas token (QR, SEP, SOL).
 *
 * Native assets are not deployed via a contract — they are built into the chain.
 * One NativeAsset exists per enabled ChainDefinition.
 */
export interface NativeAsset extends Asset {
  readonly type: 'native'
  /** ChainDefinition.id this token is native to. */
  readonly chainId: string
}

/**
 * A fungible token deployed on a specific chain (ERC-20, SPL, native VM token).
 *
 * Sprint 2: metadata only — no on-chain reads.
 */
export interface TokenAsset extends Asset {
  readonly type: 'token'
  /** The chain the token contract is deployed on. */
  readonly chainId: string
  /**
   * Contract or program address.
   * EVM: EIP-55 checksummed 0x… address.
   * SVM: base58-encoded 32-byte program ID.
   * Native: TBD by QoreChain SDK (Sprint 3).
   */
  readonly contractAddress: string
}

/**
 * A non-fungible token (ERC-721, ERC-1155, Metaplex).
 *
 * NFTs always have decimals = 0 (indivisible).
 * Sprint 2: metadata only — no on-chain reads.
 */
export interface NFTAsset extends Asset {
  readonly type: 'nft'
  /** The chain the NFT collection contract is deployed on. */
  readonly chainId: string
  /** Collection contract address (same encoding rules as TokenAsset.contractAddress). */
  readonly contractAddress: string
  /**
   * Token ID within the collection.
   * String type accommodates EVM uint256 IDs without precision loss.
   */
  readonly tokenId: string
}

/** Discriminated union over all asset types. */
export type AnyAsset = NativeAsset | TokenAsset | NFTAsset

// ─── Balance ────────────────────────────────────────────────────────────────

/**
 * On-chain balance for a single asset at a single address.
 *
 * All amounts are in the asset's smallest indivisible unit — no floating point.
 * Use `decimals` to convert to a human-readable display value:
 *   displayValue = Number(available) / 10 ** decimals
 *
 * | field     | meaning                                                          |
 * |-----------|------------------------------------------------------------------|
 * | available | Confirmed, spendable balance in smallest unit                    |
 * | pending   | Incoming balance not yet confirmed (0 if chain lacks the concept)|
 * | locked    | Staked or protocol-locked (0 in Sprint 2 — no staking support)  |
 * | decimals  | Copied from the asset; drives display formatting                 |
 * | symbol    | Copied from the asset for self-contained display                 |
 */
export interface Balance {
  /** Confirmed, spendable balance in the asset's smallest unit. */
  readonly available: bigint
  /** Unconfirmed incoming balance (0n when the chain has no mempool concept). */
  readonly pending: bigint
  /** Staked or protocol-locked balance (0n in Sprint 2). */
  readonly locked: bigint
  /** Decimal places — duplicated from Asset for self-contained display rendering. */
  readonly decimals: number
  /** Ticker symbol — duplicated from Asset for self-contained display rendering. */
  readonly symbol: string
}

// ─── Portfolio ──────────────────────────────────────────────────────────────

/**
 * A single entry in a portfolio: one asset at one address.
 */
export interface PortfolioEntry {
  /** Asset definition (metadata) */
  readonly asset: AnyAsset
  /** Balance snapshot at the time of the portfolio fetch */
  readonly balance: Balance
  /** The on-chain address these balances were queried for */
  readonly address: string
}

/**
 * Portfolio snapshot for one wallet account at a point in time.
 *
 * No fiat conversion is applied in Sprint 2.
 * Sprint 3 will add a `totalValueUsd` field once a price-feed abstraction exists.
 */
export interface Portfolio {
  /** Stable wallet ID — from WalletMetadata.id */
  readonly walletId: string
  /** BIP-44 account index — from AccountMetadata.index */
  readonly accountIndex: number
  /** Asset balances across all enabled VMs and chains for this account */
  readonly entries: ReadonlyArray<PortfolioEntry>
  /** Convenience count: equals entries.length */
  readonly totalAssets: number
  /** Unix timestamp (ms) when this snapshot was collected */
  readonly updatedAt: number
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/** Narrows AnyAsset to NativeAsset. */
export function isNativeAsset(asset: AnyAsset): asset is NativeAsset {
  return asset.type === 'native'
}

/** Narrows AnyAsset to TokenAsset. */
export function isTokenAsset(asset: AnyAsset): asset is TokenAsset {
  return asset.type === 'token'
}

/** Narrows AnyAsset to NFTAsset. */
export function isNFTAsset(asset: AnyAsset): asset is NFTAsset {
  return asset.type === 'nft'
}
