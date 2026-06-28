/**
 * CircuitBreaker.ts — Three-state circuit breaker (Closed / Open / Half-Open).
 *
 * Protects downstream RPC providers from being overwhelmed during sustained
 * failure periods. When the breaker is Open, calls fail immediately without
 * hitting the network — this reduces cascade failures and gives the RPC node
 * time to recover.
 *
 * State machine:
 *
 *   [closed] ──(failures ≥ threshold)──▶ [open] ──(recoveryTime elapsed)──▶ [half-open]
 *      ▲                                                                           │
 *      └──────────────────────(probe succeeds)────────────────────────────────────┘
 *                                         │
 *                              (probe fails)
 *                                         │
 *                                    [open] ◀─────────────────────────────────────┘
 *
 * Sprint 2: fully implemented and tested with an injectable clock (`_now`)
 *           so tests run deterministically without real millisecond delays.
 * Sprint 3: inject into RpcProvider wrapper classes.
 *
 * Architecture: ARCHITECTURE.md §5.7.7 — Circuit Breaker
 */

import { WalletError } from '@/domain/errors'
import type { CircuitBreakerConfig, CircuitBreakerState } from '@/domain/rpc'

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Sensible default circuit breaker configuration for RPC calls.
 *
 * | setting          | value   | rationale                                      |
 * |------------------|---------|------------------------------------------------|
 * | failureThreshold | 5       | Tolerates brief blips; trips on sustained fail  |
 * | recoveryTimeMs   | 30 000  | 30 s window lets the RPC node stabilise         |
 * | halfOpenMaxCalls | 1       | Single probe minimises traffic to a sick node   |
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  halfOpenMaxCalls: 1,
} as const

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Abstraction for a circuit breaker.
 *
 * Calling code (RPC provider wrappers) depends on this interface so that
 * alternative circuit-breaker algorithms can be swapped without changing the
 * provider implementation.
 */
export interface ICircuitBreaker {
  /** Current state of the circuit. */
  readonly state: CircuitBreakerState

  /**
   * Executes `fn` if the circuit is closed or in probe position (half-open).
   *
   * @param fn - The operation to protect.
   * @returns Resolved value of `fn`.
   * @throws WalletError('RPC_CIRCUIT_OPEN') immediately when the circuit is open.
   * @throws The original error from `fn` when `fn` fails (and records the failure).
   */
  execute<T>(fn: () => Promise<T>): Promise<T>

  /**
   * Forces the circuit to closed state and resets the failure counter.
   * Used after a successful manual health check or administrative override.
   */
  reset(): void

  /**
   * Forces the circuit to open state immediately, bypassing the threshold.
   * Used when an operator or monitoring system detects a node is unhealthy.
   */
  trip(): void
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Three-state circuit breaker implementation.
 *
 * @example
 * ```ts
 * const breaker = new CircuitBreaker({ failureThreshold: 5, recoveryTimeMs: 30_000, halfOpenMaxCalls: 1 })
 * const block = await breaker.execute(() => provider.getLatestBlock())
 * ```
 */
export class CircuitBreaker implements ICircuitBreaker {
  private _state: CircuitBreakerState = 'closed'
  private _failureCount = 0
  private _nextRetryAt: number | null = null
  private readonly _config: CircuitBreakerConfig
  /**
   * Injectable clock for test determinism.
   * Tests advance time by setting `_now` to return a future timestamp.
   */
  private readonly _now: () => number

  /**
   * @param config - Circuit breaker configuration. Defaults to DEFAULT_CIRCUIT_BREAKER_CONFIG.
   * @param now    - Clock function injected by tests to control perceived time.
   *                 Defaults to `Date.now`.
   */
  constructor(
    config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
    now: () => number = () => Date.now(),
  ) {
    this._config = config
    this._now = now
  }

  // ─── State accessors ──────────────────────────────────────────────────

  /** @inheritdoc */
  get state(): CircuitBreakerState {
    // Lazily transition from open to half-open when recovery time has elapsed
    if (this._state === 'open' && this._nextRetryAt !== null && this._now() >= this._nextRetryAt) {
      this._state = 'half-open'
    }
    return this._state
  }

  // ─── Core execution ───────────────────────────────────────────────────

  /**
   * Executes `fn` with circuit-breaker protection.
   *
   * - **closed**: `fn` runs normally. Failures increment the counter; on
   *   threshold, the circuit opens.
   * - **open**: throws WalletError('RPC_CIRCUIT_OPEN') without calling `fn`.
   * - **half-open**: allows a single probe call. Success closes the circuit;
   *   failure re-opens it with a fresh recovery timer.
   *
   * @param fn - Async operation to protect.
   * @throws WalletError('RPC_CIRCUIT_OPEN') when state is 'open'.
   * @throws The error thrown by `fn` (after recording the failure).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.state // triggers lazy half-open transition

    if (currentState === 'open') {
      throw new WalletError(
        'RPC_CIRCUIT_OPEN',
        `Circuit breaker is open for this provider. ` +
          `Retrying in ${this._msUntilRetry()}ms. ` +
          'Use reset() to force-close or wait for the recovery window.',
      )
    }

    try {
      const result = await fn()
      this._onSuccess()
      return result
    } catch (err) {
      this._onFailure()
      throw err
    }
  }

  // ─── Manual control ───────────────────────────────────────────────────

  /**
   * Forces the circuit to closed state and resets all counters.
   *
   * @inheritdoc
   */
  reset(): void {
    this._state = 'closed'
    this._failureCount = 0
    this._nextRetryAt = null
  }

  /**
   * Forces the circuit to open state, starting the recovery timer immediately.
   *
   * @inheritdoc
   */
  trip(): void {
    this._state = 'open'
    this._nextRetryAt = this._now() + this._config.recoveryTimeMs
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private _onSuccess(): void {
    this._state = 'closed'
    this._failureCount = 0
    this._nextRetryAt = null
  }

  private _onFailure(): void {
    this._failureCount++
    if (this._failureCount >= this._config.failureThreshold || this._state === 'half-open') {
      this._state = 'open'
      this._nextRetryAt = this._now() + this._config.recoveryTimeMs
    }
  }

  private _msUntilRetry(): number {
    if (this._nextRetryAt === null) return 0
    return Math.max(0, this._nextRetryAt - this._now())
  }
}
