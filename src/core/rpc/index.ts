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
