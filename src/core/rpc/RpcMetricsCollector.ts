/**
 * RpcMetricsCollector.ts — Aggregated request metrics for an RPC endpoint.
 *
 * Tracks cumulative counters (request count, failure count, retry count,
 * timeout count) and computes a running average latency.
 *
 * Used internally by JsonRpcClient; can be consumed by observability
 * dashboards, alerting, and automated provider selection (Sprint 4).
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation (Day 11)
 */

import type { RpcMetricsSnapshot } from '@/domain/rpc'

/** Options for a single recorded request. */
export interface RecordRequestOptions {
  /**
   * Set to true when this request was aborted due to the endpoint timeoutMs.
   * Increments both failureCount and timeoutCount in the snapshot.
   */
  readonly timedOut?: boolean
  /**
   * Set to true when this request is a retry of a previous failed attempt
   * (i.e. the initial attempt had already been counted). Increments retryCount.
   */
  readonly retried?: boolean
}

/**
 * Collects and aggregates request metrics for a single RPC endpoint.
 *
 * All counters start at zero and increase monotonically until reset() is called.
 * averageLatencyMs is computed as a running arithmetic mean over all requests.
 */
export class RpcMetricsCollector {
  private _requestCount = 0
  private _failureCount = 0
  private _totalLatencyMs = 0
  private _latencyCount = 0
  private _retryCount = 0
  private _timeoutCount = 0

  // ─── Mutation ─────────────────────────────────────────────────────────────

  /**
   * Record a completed request (success or failure).
   *
   * @param latencyMs  Round-trip time for this request in milliseconds.
   * @param success    true if the request completed without error.
   * @param options    Additional flags for retry/timeout classification.
   */
  recordRequest(latencyMs: number, success: boolean, options: RecordRequestOptions = {}): void {
    this._requestCount++
    this._totalLatencyMs += latencyMs
    this._latencyCount++

    if (!success) {
      this._failureCount++
    }
    if (options.timedOut === true) {
      this._timeoutCount++
    }
    if (options.retried === true) {
      this._retryCount++
    }
  }

  /** Reset all counters and running averages to zero. */
  reset(): void {
    this._requestCount = 0
    this._failureCount = 0
    this._totalLatencyMs = 0
    this._latencyCount = 0
    this._retryCount = 0
    this._timeoutCount = 0
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /** Returns an immutable snapshot of the current metrics. */
  getSnapshot(): RpcMetricsSnapshot {
    return {
      requestCount: this._requestCount,
      failureCount: this._failureCount,
      averageLatencyMs: this._latencyCount > 0 ? this._totalLatencyMs / this._latencyCount : null,
      retryCount: this._retryCount,
      timeoutCount: this._timeoutCount,
    }
  }

  // ─── Convenience getters (for quick checks without allocating a snapshot) ─

  /** Total number of requests attempted. */
  get requestCount(): number {
    return this._requestCount
  }

  /** Number of requests that resulted in any error. */
  get failureCount(): number {
    return this._failureCount
  }
}
