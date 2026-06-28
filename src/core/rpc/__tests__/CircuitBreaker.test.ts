/**
 * CircuitBreaker.test.ts
 *
 * Tests the three-state circuit breaker with an injectable clock so
 * state transitions can be forced without real millisecond delays.
 */

import { describe, it, expect } from 'vitest'
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../CircuitBreaker'
import { WalletError } from '@/domain/errors'
import type { CircuitBreakerConfig } from '@/domain/rpc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBreaker(
  overrides: Partial<CircuitBreakerConfig> = {},
  now: () => number = () => Date.now(),
): CircuitBreaker {
  return new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...overrides }, now)
}

/** Trigger `count` consecutive failures on `breaker`. */
async function fail(breaker: CircuitBreaker, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('CircuitBreaker — initial state', () => {
  it('starts in closed state', () => {
    expect(makeBreaker().state).toBe('closed')
  })
})

// ─── Closed → Open transition ─────────────────────────────────────────────────

describe('CircuitBreaker — closed to open', () => {
  it('opens after failureThreshold consecutive failures', async () => {
    const breaker = makeBreaker({ failureThreshold: 3 })
    await fail(breaker, 3)
    expect(breaker.state).toBe('open')
  })

  it('stays closed when failures are below threshold', async () => {
    const breaker = makeBreaker({ failureThreshold: 5 })
    await fail(breaker, 4)
    expect(breaker.state).toBe('closed')
  })

  it('resets failure count on success and does not open', async () => {
    const breaker = makeBreaker({ failureThreshold: 3 })
    await fail(breaker, 2)
    await breaker.execute(async () => 'ok') // resets counter
    await fail(breaker, 2) // 2 more failures — total 4 but counter was reset
    expect(breaker.state).toBe('closed')
  })
})

// ─── Open state ───────────────────────────────────────────────────────────────

describe('CircuitBreaker — open state', () => {
  it('throws RPC_CIRCUIT_OPEN when open', async () => {
    const breaker = makeBreaker({ failureThreshold: 1 })
    await fail(breaker, 1)
    expect(breaker.state).toBe('open')

    let err: unknown
    try {
      await breaker.execute(async () => 'should not reach')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_CIRCUIT_OPEN')
    }
  })

  it('does not call fn when open', async () => {
    const breaker = makeBreaker({ failureThreshold: 1 })
    await fail(breaker, 1)

    let called = false
    try {
      await breaker.execute(async () => {
        called = true
        return 'x'
      })
    } catch {
      /* expected */
    }
    expect(called).toBe(false)
  })
})

// ─── Open → Half-Open transition ─────────────────────────────────────────────

describe('CircuitBreaker — open to half-open', () => {
  it('transitions to half-open after recoveryTimeMs', async () => {
    let currentTime = 0
    const breaker = makeBreaker({ failureThreshold: 1, recoveryTimeMs: 1000 }, () => currentTime)

    await fail(breaker, 1)
    expect(breaker.state).toBe('open')

    currentTime = 1001 // advance past recovery window
    expect(breaker.state).toBe('half-open')
  })

  it('stays open before recoveryTimeMs has elapsed', async () => {
    let currentTime = 0
    const breaker = makeBreaker({ failureThreshold: 1, recoveryTimeMs: 1000 }, () => currentTime)

    await fail(breaker, 1)
    currentTime = 999 // just before recovery window
    expect(breaker.state).toBe('open')
  })
})

// ─── Half-Open transitions ────────────────────────────────────────────────────

describe('CircuitBreaker — half-open', () => {
  function makeHalfOpenBreaker(): CircuitBreaker {
    let t = 0
    const breaker = makeBreaker({ failureThreshold: 1, recoveryTimeMs: 1000 }, () => t)
    // Manually trip into open, then advance time to half-open
    breaker.trip()
    t = 1001
    return breaker
  }

  it('closes on successful probe call', async () => {
    const breaker = makeHalfOpenBreaker()
    expect(breaker.state).toBe('half-open')
    await breaker.execute(async () => 'probe success')
    expect(breaker.state).toBe('closed')
  })

  it('re-opens on failed probe call', async () => {
    const breaker = makeHalfOpenBreaker()
    expect(breaker.state).toBe('half-open')
    try {
      await breaker.execute(async () => {
        throw new Error('probe failure')
      })
    } catch {
      /* expected */
    }
    expect(breaker.state).toBe('open')
  })
})

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('CircuitBreaker — reset', () => {
  it('forces closed from open state', async () => {
    const breaker = makeBreaker({ failureThreshold: 1 })
    await fail(breaker, 1)
    expect(breaker.state).toBe('open')
    breaker.reset()
    expect(breaker.state).toBe('closed')
  })

  it('allows execution to proceed after reset', async () => {
    const breaker = makeBreaker({ failureThreshold: 1 })
    await fail(breaker, 1)
    breaker.reset()
    const result = await breaker.execute(async () => 'after reset')
    expect(result).toBe('after reset')
  })

  it('resets failure count so threshold must be reached again', async () => {
    const breaker = makeBreaker({ failureThreshold: 3 })
    await fail(breaker, 2)
    breaker.reset()
    await fail(breaker, 2) // 2 more failures — still below threshold
    expect(breaker.state).toBe('closed')
  })
})

// ─── trip() ──────────────────────────────────────────────────────────────────

describe('CircuitBreaker — trip', () => {
  it('immediately opens a closed circuit', () => {
    const breaker = makeBreaker()
    expect(breaker.state).toBe('closed')
    breaker.trip()
    expect(breaker.state).toBe('open')
  })

  it('rejects calls immediately after trip()', async () => {
    const breaker = makeBreaker()
    breaker.trip()
    let err: unknown
    try {
      await breaker.execute(async () => 'x')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_CIRCUIT_OPEN')
    }
  })

  it('starts recovery timer on trip()', async () => {
    let t = 0
    const breaker = makeBreaker({ failureThreshold: 5, recoveryTimeMs: 500 }, () => t)
    breaker.trip()
    expect(breaker.state).toBe('open')
    t = 501
    expect(breaker.state).toBe('half-open')
  })
})

// ─── DEFAULT_CIRCUIT_BREAKER_CONFIG ──────────────────────────────────────────

describe('DEFAULT_CIRCUIT_BREAKER_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5)
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.recoveryTimeMs).toBe(30_000)
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxCalls).toBe(1)
  })
})
