/**
 * core/rpc — Network & RPC Foundation barrel.
 *
 * Re-exports all public RPC abstractions, implementations, and utilities.
 * Consumers import from '@/core/rpc' rather than from individual files.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation
 */

// ─── Provider abstraction ─────────────────────────────────────────────────────
export type { IRpcProvider } from './IRpcProvider'

// ─── Null implementation (Sprint 2 default) ───────────────────────────────────
export { NullRpcProvider } from './NullRpcProvider'

// ─── Registry ─────────────────────────────────────────────────────────────────
export { RpcProviderRegistry } from './RpcProviderRegistry'

// ─── Retry strategy ───────────────────────────────────────────────────────────
export type { IRetryStrategy } from './RetryStrategy'
export { ExponentialBackoffRetry, DEFAULT_RETRY_CONFIG } from './RetryStrategy'

// ─── Circuit breaker ─────────────────────────────────────────────────────────
export type { ICircuitBreaker } from './CircuitBreaker'
export { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './CircuitBreaker'

// ─── JSON-RPC 2.0 transport (Day 11) ─────────────────────────────────────────
export type { FetchFn, BatchEntry } from './JsonRpcClient'
export { JsonRpcClient, JSON_RPC_ERROR_CODES } from './JsonRpcClient'
export { JsonRpcClientRegistry } from './JsonRpcClientRegistry'

// ─── Health & metrics monitoring (Day 11) ────────────────────────────────────
export { RpcHealthMonitor } from './RpcHealthMonitor'
export type { RecordRequestOptions } from './RpcMetricsCollector'
export { RpcMetricsCollector } from './RpcMetricsCollector'

// ─── Chain-specific provider interfaces (Day 11) ─────────────────────────────
export type {
  IEvmRpcProvider,
  EvmFeeHistory,
  EvmBlock,
  EvmTransactionReceipt,
  EvmLog,
} from './providers/evm'
export type {
  ISolanaRpcProvider,
  SolanaCommitment,
  SolanaAccountData,
  SolanaAccountInfo,
  SolanaBlockhashResult,
  SolanaSignatureStatus,
  SolanaBlock,
} from './providers/solana'
export type { IQoreRpcProvider, QoreBlock } from './providers/qore'
