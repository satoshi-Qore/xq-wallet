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

// ─── RPC Layer — domain types (re-exported for WalletService consumers) ──────
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
  // JSON-RPC 2.0 wire format (Day 11)
  RpcId,
  RpcRequest,
  RpcErrorPayload,
  RpcSuccessResponse,
  RpcErrorResponse,
  RpcResponse,
  BatchRpcRequest,
  BatchRpcResponse,
  // Endpoint & observability (Day 11)
  RpcEndpointMetadata,
  RpcHealthMetrics,
  RpcMetricsSnapshot,
} from '@/domain/rpc'

// ─── RPC Layer — infrastructure (re-exported for advanced consumers) ──────────
export type { IRpcProvider } from '@/core/rpc/IRpcProvider'
export { NullRpcProvider } from '@/core/rpc/NullRpcProvider'
export { RpcProviderRegistry } from '@/core/rpc/RpcProviderRegistry'
export type { IRetryStrategy } from '@/core/rpc/RetryStrategy'
export { ExponentialBackoffRetry, DEFAULT_RETRY_CONFIG } from '@/core/rpc/RetryStrategy'
export type { ICircuitBreaker } from '@/core/rpc/CircuitBreaker'
export { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '@/core/rpc/CircuitBreaker'
// Transport layer (Day 11)
export type { FetchFn, BatchEntry } from '@/core/rpc/JsonRpcClient'
export { JsonRpcClient, JSON_RPC_ERROR_CODES } from '@/core/rpc/JsonRpcClient'
export { JsonRpcClientRegistry } from '@/core/rpc/JsonRpcClientRegistry'
export { RpcHealthMonitor } from '@/core/rpc/RpcHealthMonitor'
export type { RecordRequestOptions } from '@/core/rpc/RpcMetricsCollector'
export { RpcMetricsCollector } from '@/core/rpc/RpcMetricsCollector'
// Provider interfaces (Day 11)
export type {
  IEvmRpcProvider,
  EvmFeeHistory,
  EvmBlock,
  EvmTransactionReceipt,
  EvmLog,
} from '@/core/rpc/providers/evm'
export type {
  ISolanaRpcProvider,
  SolanaCommitment,
  SolanaAccountData,
  SolanaAccountInfo,
  SolanaBlockhashResult,
  SolanaSignatureStatus,
  SolanaBlock,
} from '@/core/rpc/providers/solana'
export type { IQoreRpcProvider, QoreBlock } from '@/core/rpc/providers/qore'
