/**
 * RpcHealthMonitor.ts — Per-endpoint health tracking.
 *
 * Maintains a rolling window of recent request outcomes to compute an
 * availability score and tracks timestamps for last success/failure.
 *
 * Used internally by JsonRpcClient; can also be used standalone for
 * health dashboard logic.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation (Day 11)
 */

import type { RpcHealthMetrics } from '@/domain/rpc'

// Rolling window size for availability score calculation.
// 100 requests gives a responsive but noise-resistant score.
const WINDOW_SIZE = 100

/**
 * Tracks health metrics for a single RPC endpoint using a rolling window.
 *
 * The availability score is computed as:
 *   successCount / windowSize  over the last WINDOW_SIZE requests.
 * Returns 1.0 (optimistic) when no requests have been recorded yet.
 *
 * Injectable clock (`_now`) enables deterministic unit tests.
 */
export class RpcHealthMonitor {
  private _lastResponseTimeMs: number | null = null
  private _lastSuccessAt: number | null = null
  private _lastFailureAt: number | null = null
  private _consecutiveFailures = 0

  /** Circular rolling window — true = success, false = failure. */
  private readonly _window: boolean[] = []

  /**
   * @param _now  Injectable clock function (defaults to Date.now).
   *              Pass a controlled clock in tests for deterministic timestamps.
   */
  constructor(private readonly _now: () => number = () => Date.now()) {}

  // ─── Mutation ─────────────────────────────────────────────────────────────

  /**
   * Record the outcome of a completed request.
   *
   * @param success       true if the request succeeded; false if it failed.
   * @param responseTimeMs  Round-trip time in milliseconds.
   */
  record(success: boolean, responseTimeMs: number): void {
    const now = this._now()
    this._lastResponseTimeMs = responseTimeMs

    if (success) {
      this._lastSuccessAt = now
      this._consecutiveFailures = 0
    } else {
      this._lastFailureAt = now
      this._consecutiveFailures++
    }

    this._window.push(success)
    if (this._window.length > WINDOW_SIZE) {
      this._window.shift()
    }
  }

  /** Reset all metrics to their initial state (e.g. after reconnection). */
  reset(): void {
    this._lastResponseTimeMs = null
    this._lastSuccessAt = null
    this._lastFailureAt = null
    this._consecutiveFailures = 0
    this._window.length = 0
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /** Returns an immutable snapshot of the current health metrics. */
  getSnapshot(): RpcHealthMetrics {
    return {
      lastResponseTimeMs: this._lastResponseTimeMs,
      lastSuccessAt: this._lastSuccessAt,
      lastFailureAt: this._lastFailureAt,
      consecutiveFailures: this._consecutiveFailures,
      availabilityScore: this._computeScore(),
    }
  }

  /** Number of consecutive failed requests since the last success. */
  get consecutiveFailures(): number {
    return this._consecutiveFailures
  }

  /**
   * Availability score in the range [0.0, 1.0].
   * Returns 1.0 if no requests have been recorded yet (optimistic default).
   */
  get availabilityScore(): number {
    return this._computeScore()
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _computeScore(): number {
    if (this._window.length === 0) return 1.0
    const successCount = this._window.filter((s) => s).length
    return successCount / this._window.length
  }
}
