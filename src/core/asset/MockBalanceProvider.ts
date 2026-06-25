/**
 * MockBalanceProvider.ts — Deterministic in-memory balance provider.
 *
 * Used in Sprint 2 (no live RPC connections) and in unit tests.
 *
 * Mock behaviour:
 *   - Known asset ids return a predefined non-zero `available` balance
 *     (one full token in the smallest unit for each default native asset).
 *   - Unknown asset ids return a zero balance without throwing.
 *   - `pending` and `locked` are always 0 (no staking / mempool in Sprint 2).
 *
 * Replaceability: swap the IBalanceProvider injected into WalletService to
 * switch from MockBalanceProvider to a real RPC-backed provider in Sprint 3.
 *
 * BigInt literals require ES2020+; this project targets ES2017 so we use
 * the BigInt() constructor for all bigint values in this file.
 */

import type { AnyAsset, Balance } from '@/domain/asset'
import type { IBalanceProvider } from './IBalanceProvider'

/**
 * Predefined mock available balances keyed by asset id.
 * Amounts are in the asset's smallest indivisible unit.
 *
 * BigInt() constructor is used instead of bigint literals (0n) because the
 * project targets ES2017 and bigint literals require ES2020.
 */
const MOCK_AVAILABLE: Readonly<Record<string, bigint>> = {
  // 1 QR  (18 decimals) = 10^18
  'qorechain-devnet:native:QR': BigInt('1000000000000000000'),
  // 1 SEP (18 decimals) = 10^18
  'ethereum-sepolia:native:SEP': BigInt('1000000000000000000'),
  // 1 SOL (9 decimals) = 10^9
  'solana-devnet:native:SOL': BigInt('1000000000'),
}

const ZERO = BigInt(0)

/**
 * In-memory balance provider that returns deterministic mock data.
 *
 * Implements IBalanceProvider — replaceable with a real RPC provider in Sprint 3.
 */
export class MockBalanceProvider implements IBalanceProvider {
  /**
   * Allows tests to override the mock available balance for a specific asset id.
   * Keys are asset ids; values are the desired `available` amount in smallest unit.
   */
  private readonly _overrides: Map<string, bigint>

  constructor(overrides: Record<string, bigint> = {}) {
    this._overrides = new Map(Object.entries(overrides))
  }

  /**
   * Returns the mock balance for one asset at one address.
   * The address is accepted but ignored — the mock is address-agnostic.
   */
  async getBalance(_address: string, asset: AnyAsset): Promise<Balance> {
    const available = this._overrides.get(asset.id) ?? MOCK_AVAILABLE[asset.id] ?? ZERO
    return {
      available,
      pending: ZERO,
      locked: ZERO,
      decimals: asset.decimals,
      symbol: asset.symbol,
    }
  }

  /**
   * Returns mock balances for multiple assets in a single call.
   * Results are in the same order as the input `assets` array.
   */
  async getBalances(
    _address: string,
    assets: ReadonlyArray<AnyAsset>,
  ): Promise<ReadonlyArray<{ readonly asset: AnyAsset; readonly balance: Balance }>> {
    return assets.map((asset) => {
      const available = this._overrides.get(asset.id) ?? MOCK_AVAILABLE[asset.id] ?? ZERO
      const balance: Balance = {
        available,
        pending: ZERO,
        locked: ZERO,
        decimals: asset.decimals,
        symbol: asset.symbol,
      }
      return { asset, balance }
    })
  }

  /**
   * Convenience factory: creates a MockBalanceProvider with a single asset
   * override. Useful for precise single-asset test assertions.
   *
   * @param assetId   - Asset id to override.
   * @param available - Available balance in smallest unit.
   */
  static withBalance(assetId: string, available: bigint): MockBalanceProvider {
    return new MockBalanceProvider({ [assetId]: available })
  }
}
