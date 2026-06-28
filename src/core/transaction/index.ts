/**
 * src/core/transaction/index.ts — Public API barrel for the transaction layer.
 *
 * Import from '@/core/transaction' only — never from internal submodules.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

// ─── Builder ────────────────────────────────────────────────────────────────
export { TransactionBuilder } from './TransactionBuilder'

// ─── Validator ──────────────────────────────────────────────────────────────
export { TransactionValidator } from './TransactionValidator'

// ─── Signing Pipeline ───────────────────────────────────────────────────────
export type { ITransactionSigner } from './ITransactionSigner'

// ─── Fee Estimation ─────────────────────────────────────────────────────────
export type { IFeeEstimator } from './IFeeEstimator'
export { MockFeeEstimator } from './MockFeeEstimator'
