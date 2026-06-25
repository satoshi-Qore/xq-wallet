/**
 * IBalanceProvider — abstraction over on-chain balance queries.
 *
 * Sprint 2: only MockBalanceProvider exists (returns deterministic mock data).
 * Sprint 3: EthersBalanceProvider, SolanaBalanceProvider, and
 *           NativeBalanceProvider will replace MockBalanceProvider by
 *           implementing this interface against real RPC endpoints.
 *
 * Implementations MUST:
 *   - Return amounts in the smallest indivisible unit (wei, lamports, etc.).
 *   - Return zero balances for unknown addresses — never throw for a missing
 *     address.
 *   - Be stateless with respect to cached balances (caching lives above this
 *     layer in the service tier, if needed).
 *
 * Architecture: ARCHITECTURE.md §5.5 — Balance Provider Abstraction
 */

import type { AnyAsset, Balance } from '@/domain/asset'

/**
 * Abstract interface for per-address on-chain balance queries.
 *
 * WalletService depends only on this interface — never on a concrete provider.
 * Swap the implementation in the constructor to switch between mock and live RPC.
 */
export interface IBalanceProvider {
  /**
   * Returns the balance of a single asset at the given address.
   *
   * @param address - On-chain address to query (format is VM-specific).
   * @param asset   - Asset to look up. Must include `id`, `decimals`, and `symbol`.
   * @returns A Balance snapshot with all amounts in the smallest indivisible unit.
   */
  getBalance(address: string, asset: AnyAsset): Promise<Balance>

  /**
   * Returns balances for multiple assets at a single address in one call.
   *
   * Concrete providers are encouraged to batch the underlying RPC requests
   * (e.g. via EVM multicall or Solana `getMultipleAccounts`) where available.
   *
   * @param address - On-chain address to query.
   * @param assets  - Asset definitions to query. May be empty — returns [].
   * @returns Array of { asset, balance } pairs in the same order as `assets`.
   */
  getBalances(
    address: string,
    assets: ReadonlyArray<AnyAsset>,
  ): Promise<ReadonlyArray<{ readonly asset: AnyAsset; readonly balance: Balance }>>
}
