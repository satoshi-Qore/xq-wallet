/**
 * RetryStrategy.ts — Exponential back-off retry with per-attempt timeout.
 *
 * Designed to wrap any async operation (future RPC calls, network requests)
 * with configurable retry behaviour. The strategy is stateless — each call
 * to `execute()` starts a fresh attempt counter.
 *
 * Sprint 2: fully implemented and tested; used with NullRpcProvider in Sprint 2
 *           tests to verify the strategy itself. Sprint 3 RPC providers will
 *           instantiate ExponentialBackoffRetry via constructor injection.
 *
 * Design principles:
 *   - The `_sleep` dependency is injectable so tests run at speed without
 *     real millisecond delays (pass `() => Promise.resolve()`).
 *   - Timeout is per-attempt — the total execution time may be up to
 *     `timeoutMs * maxAttempts` in the worst case.
 *   - All delays are capped at `maxDelayMs` to prevent indefinite back-off.
 *   - If all attempts fail, throws WalletError('RPC_TIMEOUT') with the last
 *     error as `internalCause`. Never silently swallows errors.
 *
 * Architecture: ARCHITECTURE.md §5.7.6 — Retry Strategy
 */

import { WalletError } from '@/domain/errors'
import type { RetryConfig } from '@/domain/rpc'

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Sensible default retry configuration for RPC calls.
 *
 * | setting           | value    | rationale                                        |
 * |-------------------|----------|--------------------------------------------------|
 * | maxAttempts       | 3        | Initial attempt + 2 retries covers transient blips|
 * | initialDelayMs    | 500      | Short enough to feel fast, long enough for node   |
 * | maxDelayMs        | 10 000   | 10 s cap prevents cascade under sustained failure  |
 * | backoffMultiplier | 2        | Classic exponential: 500ms → 1s → 2s              |
 * | timeoutMs         | 30 000   | Matches typical RPC node idle-timeout              |
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  timeoutMs: 30_000,
} as const

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Abstraction for retry strategies.
 *
 * Calling code depends on this interface so that different retry strategies
 * (exponential, fixed-interval, immediate) can be swapped without changing
 * provider implementations.
 *
 * @typeParam T - Return type of the wrapped async operation.
 */
export interface IRetryStrategy {
  /**
   * Executes `fn` with retry semantics according to the strategy's config.
   *
   * @param fn - Async operation to attempt. May be called multiple times.
   * @returns The resolved value of `fn` on the first successful attempt.
   * @throws The last error thrown by `fn` if all attempts fail (wrapped as
   *         WalletError('RPC_TIMEOUT') by ExponentialBackoffRetry).
   */
  execute<T>(fn: () => Promise<T>): Promise<T>
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Retry strategy that applies exponential back-off between attempts and
 * enforces a per-attempt timeout via Promise.race.
 *
 * @example
 * ```ts
 * const retry = new ExponentialBackoffRetry({ maxAttempts: 3, initialDelayMs: 500,
 *   maxDelayMs: 5_000, backoffMultiplier: 2, timeoutMs: 10_000 })
 * const block = await retry.execute(() => provider.getLatestBlock())
 * ```
 */
export class ExponentialBackoffRetry implements IRetryStrategy {
  private readonly _config: RetryConfig
  /**
   * Injectable sleep function for test determinism.
   * Production code uses the real setTimeout-backed implementation.
   */
  private readonly _sleep: (ms: number) => Promise<void>

  /**
   * @param config - Retry configuration. Defaults to DEFAULT_RETRY_CONFIG.
   * @param sleep  - Sleep function injected by tests to skip real delays.
   *                 Defaults to a real setTimeout-based implementation.
   */
  constructor(
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    this._config = config
    this._sleep = sleep
  }

  /**
   * Executes `fn`, retrying up to `config.maxAttempts - 1` additional times
   * on failure with exponential back-off between attempts.
   *
   * @param fn - Async operation to execute. Re-invoked on each retry.
   * @returns Resolved value from the first successful invocation of `fn`.
   * @throws WalletError('RPC_TIMEOUT') wrapping the last error if all attempts fail.
   *         Also throws WalletError('RPC_TIMEOUT') if a single attempt exceeds
   *         `config.timeoutMs`.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier, timeoutMs } = this._config
    let lastError: unknown
    let delay = initialDelayMs

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Race the operation against a per-attempt timeout
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new WalletError(
                    'RPC_TIMEOUT',
                    `RPC request timed out after ${timeoutMs}ms (attempt ${attempt}/${maxAttempts}).`,
                  ),
                ),
              timeoutMs,
            ),
          ),
        ])
        return result
      } catch (err) {
        lastError = err
        // Only delay if there are more attempts remaining
        if (attempt < maxAttempts) {
          await this._sleep(delay)
          delay = Math.min(delay * backoffMultiplier, maxDelayMs)
        }
      }
    }

    // All attempts exhausted — surface the last error
    throw new WalletError(
      'RPC_TIMEOUT',
      `All ${maxAttempts} RPC attempt(s) failed. ` +
        'Check the RPC endpoint and network connectivity.',
      lastError,
    )
  }
}
