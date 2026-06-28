/**
 * MockFeeEstimator.ts — Deterministic in-memory fee estimator.
 *
 * Returns realistic-looking fee estimates for all three priority tiers
 * without making any RPC calls. Safe to use in unit tests and Sprint 2 UI.
 *
 * Fee values are based on mid-2024 mainnet observations scaled to devnet:
 *   EVM  — EIP-1559 model (baseFee + priorityFee) * gasLimit (21 000 for transfer)
 *   SVM  — Flat lamport fee + optional compute-unit price for priority
 *   Native — QoreChain provisional EVM-style fee model (Sprint 2 placeholder)
 *
 * BigInt() constructor is used throughout (not bigint literals) because the
 * project targets ES2017; bigint literals (0n) require ES2020+.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import type { TransactionRequest, FeeEstimate, Fee, FeePriority } from '@/domain/transaction'
import type { VMType } from '@/domain/chain'
import type { IFeeEstimator } from './IFeeEstimator'

// ─── Mock Fee Tables ─────────────────────────────────────────────────────────
//
// All amounts in the chain native currency smallest unit.
// EVM / Native: wei  (1 ETH / 1 QR = 10^18 wei)
// SVM:          lamports (1 SOL = 10^9 lamports)

interface FeeRow {
  readonly baseFee: bigint
  readonly priorityFee: bigint
  readonly estimatedSeconds: number
}

// EVM: baseFee = gasPrice * 21 000 (standard ETH transfer gas)
//   slow:   10 gwei base   + 1 gwei tip  → 10^10 * 21000 = 210_000_000_000_000
//   normal: 15 gwei base   + 2 gwei tip  → 1.5 * 210_000_000_000_000 = 315_000_000_000_000
//   fast:   20 gwei base   + 5 gwei tip  → 2 * 210_000_000_000_000 = 420_000_000_000_000
const EVM_FEES: Record<FeePriority, FeeRow> = {
  slow: {
    baseFee: BigInt('210000000000000'),
    priorityFee: BigInt('21000000000000'),
    estimatedSeconds: 120,
  },
  normal: {
    baseFee: BigInt('315000000000000'),
    priorityFee: BigInt('42000000000000'),
    estimatedSeconds: 60,
  },
  fast: {
    baseFee: BigInt('420000000000000'),
    priorityFee: BigInt('105000000000000'),
    estimatedSeconds: 15,
  },
}

// SVM: Solana charges a flat 5 000 lamports per signature for base fee.
//   Priority: compute-unit price; only 'fast' tier applies a non-zero CU price.
const SVM_FEES: Record<FeePriority, FeeRow> = {
  slow: {
    baseFee: BigInt('5000'),
    priorityFee: BigInt('0'),
    estimatedSeconds: 15,
  },
  normal: {
    baseFee: BigInt('5000'),
    priorityFee: BigInt('0'),
    estimatedSeconds: 5,
  },
  fast: {
    baseFee: BigInt('5000'),
    priorityFee: BigInt('25000'),
    estimatedSeconds: 2,
  },
}

// Native: Provisional QoreChain fee model (same as EVM until SDK finalises).
const NATIVE_FEES: Record<FeePriority, FeeRow> = {
  slow: {
    baseFee: BigInt('21000000000000'),
    priorityFee: BigInt('2100000000000'),
    estimatedSeconds: 60,
  },
  normal: {
    baseFee: BigInt('42000000000000'),
    priorityFee: BigInt('4200000000000'),
    estimatedSeconds: 30,
  },
  fast: {
    baseFee: BigInt('84000000000000'),
    priorityFee: BigInt('8400000000000'),
    estimatedSeconds: 10,
  },
}

const FEE_TABLE: Record<VMType, Record<FeePriority, FeeRow>> = {
  evm: EVM_FEES,
  svm: SVM_FEES,
  native: NATIVE_FEES,
}

// ─── Native Gas Asset Ids ─────────────────────────────────────────────────────
// Fee amounts are always in the gas token — map from chain id to asset id.
const GAS_ASSET_ID: Record<string, string> = {
  'ethereum-sepolia': 'ethereum-sepolia:native:SEP',
  'qorechain-devnet': 'qorechain-devnet:native:QR',
  'solana-devnet': 'solana-devnet:native:SOL',
}

// ─── MockFeeEstimator ────────────────────────────────────────────────────────

/**
 * Deterministic fee estimator that returns hard-coded mock values.
 *
 * Implements IFeeEstimator — swap for an RPC-backed estimator in Sprint 3.
 */
export class MockFeeEstimator implements IFeeEstimator {
  /**
   * Returns a deterministic FeeEstimate for all three priority tiers.
   *
   * Fee amounts do not depend on the transaction amount or the specific
   * addresses — only on the VM type and chain id.
   *
   * @param request - TransactionRequest to estimate fees for.
   * @returns FeeEstimate with slow, normal, and fast tiers.
   */
  async estimate(request: TransactionRequest): Promise<FeeEstimate> {
    const table = FEE_TABLE[request.vm]
    const gasAssetId = GAS_ASSET_ID[request.chainId] ?? request.assetId

    const buildFee = (priority: FeePriority): Fee => {
      const row = table[priority]
      return {
        priority,
        baseFee: row.baseFee,
        priorityFee: row.priorityFee,
        maxFee: row.baseFee + row.priorityFee,
        estimatedSeconds: row.estimatedSeconds,
      }
    }

    return {
      assetId: gasAssetId,
      vm: request.vm,
      chainId: request.chainId,
      slow: buildFee('slow'),
      normal: buildFee('normal'),
      fast: buildFee('fast'),
      estimatedAt: Date.now(),
    }
  }
}
