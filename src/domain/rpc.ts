/**
 * RPC domain types.
 *
 * Pure TypeScript types — no logic, no imports from outside domain/.
 * Describes the wire-level data returned by blockchain RPC nodes,
 * plus the configuration models for retry and circuit breaker strategies.
 *
 * Separation of concerns:
 *   domain/rpc.ts        — what RPC nodes return (wire format)
 *   domain/transaction.ts — what the wallet constructs locally
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation
 */

import type { VMType } from './chain'

// ─── Block ───────────────────────────────────────────────────────────────────

/**
 * A confirmed (or pending) block as reported by an RPC node.
 *
 * Sprint 2: populated only by tests and NullRpcProvider stubs.
 * Sprint 3: filled from live eth_getBlockByNumber / getBlock RPC calls.
 */
export interface RpcBlock {
  /** Block hash (hex, 0x-prefixed for EVM; base58 for SVM). */
  readonly hash: string
  /** Block height / slot number. Uses bigint to avoid precision loss above 2^53. */
  readonly number: bigint
  /** Hash of the preceding block. */
  readonly parentHash: string
  /** Unix timestamp in seconds when this block was produced. */
  readonly timestamp: number
  /** Number of transactions included in this block. */
  readonly transactionCount: number
  /** Virtual machine this block belongs to. */
  readonly vm: VMType
  /** ChainDefinition.id for the chain that produced this block. */
  readonly chainId: string
}

// ─── Transaction (on-chain) ──────────────────────────────────────────────────

/**
 * Lifecycle state of an on-chain transaction as reported by the RPC node.
 *
 * - 'pending'   — Received by the mempool; not yet included in a block.
 * - 'confirmed' — Included in a finalised block with successful execution.
 * - 'failed'    — Included in a block but execution reverted / errored.
 */
export type RpcTransactionStatus = 'pending' | 'confirmed' | 'failed'

/**
 * On-chain transaction data returned by an RPC node.
 *
 * Distinct from domain/transaction.ts TransactionRequest (which is a local intent)
 * — RpcTransaction represents what is actually recorded on the chain.
 */
export interface RpcTransaction {
  /** Transaction hash (hex, 0x-prefixed for EVM; base58 for SVM). */
  readonly hash: string
  /** Sender address. */
  readonly from: string
  /** Recipient address. null for contract deployments. */
  readonly to: string | null
  /** Value transferred in the chain's native currency smallest unit. */
  readonly value: bigint
  /** Hex-encoded calldata ('0x' for plain value transfers). */
  readonly data: string
  /** Hash of the block this transaction is included in. null if pending. */
  readonly blockHash: string | null
  /** Block number this transaction is included in. null if pending. */
  readonly blockNumber: bigint | null
  /** Index within the block. null if pending. */
  readonly transactionIndex: number | null
  /** Execution result. */
  readonly status: RpcTransactionStatus
  /** Virtual machine for this transaction. */
  readonly vm: VMType
  /** ChainDefinition.id for the chain this transaction is on. */
  readonly chainId: string
}

// ─── Health ──────────────────────────────────────────────────────────────────

/**
 * Availability state of an RPC endpoint.
 *
 * - 'available'   — Endpoint responds within acceptable latency bounds.
 * - 'unavailable' — Endpoint is unreachable or returns consistent errors.
 * - 'degraded'    — Endpoint responds but latency is above threshold.
 * - 'unknown'     — Health has not yet been checked.
 */
export type RpcEndpointStatus = 'available' | 'unavailable' | 'degraded' | 'unknown'

/**
 * Health snapshot for a single RPC provider endpoint.
 *
 * Returned by IRpcProvider.healthCheck() and used by monitoring and
 * circuit breaker logic to decide whether to route traffic to this provider.
 */
export interface RpcHealthReport {
  /** The RPC endpoint URL that was checked. Empty string for NullRpcProvider. */
  readonly endpoint: string
  /** Availability status at time of check. */
  readonly status: RpcEndpointStatus
  /** Round-trip latency in milliseconds. null if the check failed or was not performed. */
  readonly latencyMs: number | null
  /** Unix timestamp (ms) when this health check was performed. */
  readonly lastCheckedAt: number
  /** Unix timestamp (ms) of the most recent successful check. null if never succeeded. */
  readonly lastSuccessAt: number | null
  /** Human-readable error message. null when status is 'available'. */
  readonly errorMessage: string | null
}

// ─── Raw Fee Data ─────────────────────────────────────────────────────────────

/**
 * Raw fee data as reported directly by an RPC node.
 *
 * Distinct from domain/transaction.ts FeeEstimate (which adds priority tiers
 * and is formatted for the UI). RpcFeeData is the wire-level response used to
 * construct FeeEstimate inside a concrete IFeeEstimator implementation.
 *
 * | field               | EVM (EIP-1559)              | SVM / Native       |
 * |---------------------|-----------------------------|--------------------|
 * | baseFeePerGas       | eth_gasPrice base component | null               |
 * | maxPriorityFeePerGas| miner tip per gas           | null               |
 * | gasPrice            | legacy gasPrice fallback    | flat fee (lamports)|
 */
export interface RpcFeeData {
  /**
   * Base fee per gas unit in the native currency's smallest unit.
   * null for SVM and native VM (which use flat fees, not gas-based pricing).
   */
  readonly baseFeePerGas: bigint | null
  /**
   * Validator tip per gas unit (EIP-1559 maxPriorityFeePerGas).
   * null for SVM and native VM.
   */
  readonly maxPriorityFeePerGas: bigint | null
  /**
   * Legacy gas price (pre-EIP-1559) or flat transaction fee (SVM / Native).
   * Always present; use as the fee for non-EIP-1559 VMs.
   */
  readonly gasPrice: bigint
  /** VM type this fee data is for. */
  readonly vm: VMType
  /** ChainDefinition.id this fee data is for. */
  readonly chainId: string
  /** Unix timestamp (ms) when this data was fetched. */
  readonly estimatedAt: number
}

// ─── Retry Strategy ───────────────────────────────────────────────────────────

/**
 * Configuration for the exponential back-off retry strategy.
 *
 * Sprint 2: used by ExponentialBackoffRetry.
 * Sprint 3: injected into RPC-backed providers to handle transient failures.
 */
export interface RetryConfig {
  /**
   * Total number of attempts, including the first one.
   * 1 means no retries; 3 means one initial attempt plus up to 2 retries.
   */
  readonly maxAttempts: number
  /** Delay before the first retry in milliseconds. */
  readonly initialDelayMs: number
  /** Maximum delay between retries in milliseconds (caps exponential growth). */
  readonly maxDelayMs: number
  /**
   * Multiplier applied to the delay after each failed attempt.
   * Example: initialDelayMs=500, backoffMultiplier=2 → 500ms, 1000ms, 2000ms.
   */
  readonly backoffMultiplier: number
  /**
   * Maximum wall-clock time allowed for a single attempt in milliseconds.
   * The attempt is aborted and counted as a failure if it exceeds this duration.
   */
  readonly timeoutMs: number
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

/**
 * Circuit breaker state machine.
 *
 * | state      | behaviour                                                  |
 * |------------|------------------------------------------------------------|
 * | closed     | Requests pass through normally; failures are counted.      |
 * | open       | All requests are rejected immediately (fail-fast).         |
 * | half-open  | A limited probe request is allowed to test recovery.       |
 *              | Success → closed; failure → open again.                    |
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Configuration for the CircuitBreaker.
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures required to trip the breaker from
   * closed to open state.
   */
  readonly failureThreshold: number
  /**
   * Duration in milliseconds the breaker stays open before transitioning
   * to half-open to test recovery.
   */
  readonly recoveryTimeMs: number
  /**
   * Maximum number of probe calls allowed through in half-open state
   * before deciding whether to close or re-open.
   * Sprint 2: always 1 (single probe).
   */
  readonly halfOpenMaxCalls: number
}
