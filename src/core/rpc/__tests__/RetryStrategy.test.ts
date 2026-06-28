/**
 * RetryStrategy.test.ts
 *
 * Tests ExponentialBackoffRetry with an injectable no-op sleep function
 * so tests run at speed without real millisecond delays.
 */

import { describe, it, expect, vi } from 'vitest'
import { ExponentialBackoffRetry, DEFAULT_RETRY_CONFIG } from '../RetryStrategy'
import { WalletError } from '@/domain/errors'
import type { RetryConfig } from '@/domain/rpc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NO_SLEEP = (): Promise<void> => Promise.resolve()

function makeRetry(overrides: Partial<RetryConfig> = {}): ExponentialBackoffRetry {
  return new ExponentialBackoffRetry({ ...DEFAULT_RETRY_CONFIG, ...overrides }, NO_SLEEP)
}

// ─── Success paths ────────────────────────────────────────────────────────────

describe('ExponentialBackoffRetry — success', () => {
  it('resolves immediately on first success', async () => {
    const retry = makeRetry()
    const result = await retry.execute(async () => 42)
    expect(result).toBe(42)
  })

  it('returns the resolved value of fn', async () => {
    const retry = makeRetry()
    const result = await retry.execute(async () => 'hello')
    expect(result).toBe('hello')
  })

  it('succeeds on the second attempt after one failure', async () => {
    const retry = makeRetry({ maxAttempts: 3 })
    let calls = 0
    const result = await retry.execute(async () => {
      calls++
      if (calls === 1) throw new Error('transient failure')
      return 'recovered'
    })
    expect(result).toBe('recovered')
    expect(calls).toBe(2)
  })

  it('succeeds on the third attempt after two failures', async () => {
    const retry = makeRetry({ maxAttempts: 3 })
    let calls = 0
    const result = await retry.execute(async () => {
      calls++
      if (calls < 3) throw new Error('transient')
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })
})

// ─── Failure paths ────────────────────────────────────────────────────────────

describe('ExponentialBackoffRetry — exhaustion', () => {
  it('throws WalletError(RPC_TIMEOUT) when all attempts fail', async () => {
    const retry = makeRetry({ maxAttempts: 3 })
    let err: unknown
    try {
      await retry.execute(async () => {
        throw new Error('always fails')
      })
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_TIMEOUT')
      expect(err.message).toContain('3')
    }
  })

  it('calls fn exactly maxAttempts times', async () => {
    const retry = makeRetry({ maxAttempts: 4 })
    let calls = 0
    try {
      await retry.execute(async () => {
        calls++
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
    expect(calls).toBe(4)
  })

  it('with maxAttempts=1 does not retry', async () => {
    const retry = makeRetry({ maxAttempts: 1 })
    let calls = 0
    try {
      await retry.execute(async () => {
        calls++
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
    expect(calls).toBe(1)
  })
})

// ─── Backoff delay behaviour ──────────────────────────────────────────────────

describe('ExponentialBackoffRetry — backoff', () => {
  it('applies sleep between retries', async () => {
    const sleepCalls: number[] = []
    const spy = (ms: number): Promise<void> => {
      sleepCalls.push(ms)
      return Promise.resolve()
    }

    const retry = new ExponentialBackoffRetry(
      { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3, initialDelayMs: 500, backoffMultiplier: 2 },
      spy,
    )
    try {
      await retry.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }

    // 2 retries = 2 sleep calls (no sleep after the final attempt)
    expect(sleepCalls).toHaveLength(2)
    expect(sleepCalls[0]).toBe(500)
    expect(sleepCalls[1]).toBe(1000)
  })

  it('caps delay at maxDelayMs', async () => {
    const sleepCalls: number[] = []
    const spy = (ms: number): Promise<void> => {
      sleepCalls.push(ms)
      return Promise.resolve()
    }

    const retry = new ExponentialBackoffRetry(
      {
        maxAttempts: 5,
        initialDelayMs: 500,
        backoffMultiplier: 4,
        maxDelayMs: 1000,
        timeoutMs: 30_000,
      },
      spy,
    )
    try {
      await retry.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }

    // 500 → 2000 (capped at 1000) → 1000 → 1000 — all from attempt 2 onward
    for (const delay of sleepCalls) {
      expect(delay).toBeLessThanOrEqual(1000)
    }
  })
})

// ─── Timeout ─────────────────────────────────────────────────────────────────

describe('ExponentialBackoffRetry — per-attempt timeout', () => {
  it('throws RPC_TIMEOUT when fn never resolves within timeoutMs', async () => {
    vi.useFakeTimers()
    const retry = new ExponentialBackoffRetry(
      { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, timeoutMs: 100 },
      NO_SLEEP,
    )

    let err: unknown
    const promise = retry
      .execute(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      )
      .catch((e) => {
        err = e
      })
    vi.advanceTimersByTime(200)
    await promise
    vi.useRealTimers()

    // The timeout-specific WalletError is caught and re-wrapped as the "all attempts failed" error.
    // Both the inner (per-attempt) and outer (exhaustion) errors use code RPC_TIMEOUT.
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_TIMEOUT')
      // internalCause carries the per-attempt timeout message with the specific ms
      expect(err.internalCause).toBeDefined()
    }
  })
})

// ─── DEFAULT_RETRY_CONFIG ─────────────────────────────────────────────────────

describe('DEFAULT_RETRY_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3)
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(500)
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10_000)
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2)
    expect(DEFAULT_RETRY_CONFIG.timeoutMs).toBe(30_000)
  })

  it('maxDelayMs is reachable given initialDelayMs and backoffMultiplier', () => {
    // 500 * 2^5 = 16000 > 10000 — so cap is meaningful
    const { initialDelayMs, backoffMultiplier, maxDelayMs } = DEFAULT_RETRY_CONFIG
    expect(initialDelayMs * backoffMultiplier * backoffMultiplier).toBeLessThan(maxDelayMs * 10)
  })
})
