/**
 * src/core/wallet/index.ts — Public API barrel export.
 *
 * Consumers import from '@/core/wallet' only — never from internal submodules.
 * Adapter internals (EvmAddressAdapter, SvmAddressAdapter, NativeAddressAdapter)
 * are intentionally NOT exported here: they are implementation details.
 */

// ─── Public Derivation Functions ───────────────────────────────────────────
export {
  deriveEvmAccount,
  deriveSvmAccount,
  deriveNativeAccount,
  deriveAllAccounts,
} from './derive'

export type { DeriveAllAccountsOptions } from './derive'

// ─── Path Utilities ────────────────────────────────────────────────────────
export {
  evmPath,
  svmPath,
  nativePath,
  assertValidAccountIndex,
  EVM_COIN_TYPE,
  SVM_COIN_TYPE,
  NATIVE_COIN_TYPE,
} from './paths'

// ─── Wallet Engine ─────────────────────────────────────────────────────────
export { WalletService } from './WalletService'
export type {
  WalletServiceOptions,
  CreateWalletOptions,
  ImportWalletOptions,
  CreateWalletResult,
} from './WalletService'

// ─── Chain Adapter Types (re-exported for WalletService consumers) ─────────
// SignResult and VerifyParams are returned/accepted by WalletService.signMessage
// and WalletService.verifySignature. Re-exported here so callers only need
// one import path: '@/core/wallet'.
export type { SignResult, VerifyParams } from '@/core/chain/adapters'

// ─── Asset Layer (re-exported for WalletService consumers) ─────────────────
// Types returned by WalletService.getAsset / listAssets / getBalance / getPortfolio.
export type { AnyAsset, Balance, Portfolio, PortfolioEntry } from '@/domain/asset'

// ─── Transaction Layer (re-exported for WalletService consumers) ─────────────
// Types accepted/returned by WalletService transaction methods.
export type { CreateTransactionParams } from './WalletService'
export type {
  TransactionRequest,
  TransactionType,
  TransactionStatus,
  SigningPayload,
  SigningAlgorithm,
  SignedTransaction,
  FeePriority,
  Fee,
  FeeEstimate,
  TransactionValidationResult,
  TransactionValidationError,
  TransactionValidationField,
} from '@/domain/transaction'
// ─── RPC Layer (re-exported for WalletService consumers) ─────────────────────
// Domain types returned by WalletService RPC methods.
export type {
  RpcBlock,
  RpcTransaction,
  RpcTransactionStatus,
  RpcEndpointStatus,
  RpcHealthReport,
  RpcFeeData,
  RetryConfig,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from '@/domain/rpc'
// RPC infrastructure types for advanced consumers (e.g., Sprint 3 provider injection).
export type { IRpcProvider } from '@/core/rpc/IRpcProvider'
export { NullRpcProvider } from '@/core/rpc/NullRpcProvider'
export { RpcProviderRegistry } from '@/core/rpc/RpcProviderRegistry'
export type { IRetryStrategy } from '@/core/rpc/RetryStrategy'
export { ExponentialBackoffRetry, DEFAULT_RETRY_CONFIG } from '@/core/rpc/RetryStrategy'
export type { ICircuitBreaker } from '@/core/rpc/CircuitBreaker'
export { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '@/core/rpc/CircuitBreaker'
