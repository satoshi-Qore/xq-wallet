/**
 * IFeeEstimator.ts — Abstraction over transaction fee estimation.
 *
 * Sprint 2: MockFeeEstimator returns deterministic hard-coded values.
 * Sprint 3: RPC-backed estimators (EthersGasPriceEstimator,
 *           SolanaFeeEstimator, NativeFeeEstimator) will query live nodes.
 *
 * WalletService depends only on this interface — the concrete estimator is
 * swapped via the WalletServiceOptions.feeEstimator constructor argument.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import type { TransactionRequest, FeeEstimate } from '@/domain/transaction'

/**
 * Abstract interface for transaction fee estimation.
 *
 * Implementations must return amounts in the chain's native currency
 * smallest unit (wei, lamports, QR smallest unit). No floats.
 */
export interface IFeeEstimator {
  /**
   * Estimates transaction fees for all three priority tiers.
   *
   * @param request - The transaction to estimate fees for. The estimate may
   *                  vary based on transaction type and asset (e.g. ERC-20
   *                  transfers cost more gas than native transfers).
   * @returns A FeeEstimate covering slow, normal, and fast priority tiers.
   */
  estimate(request: TransactionRequest): Promise<FeeEstimate>
}
