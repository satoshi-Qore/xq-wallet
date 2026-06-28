/**
 * RpcMetricsCollector — unit tests.
 *
 * Covers: initial state, recordRequest() mutations (success, failure, retry,
 * timeout), averageLatencyMs computation, reset().
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RpcMetricsCollector } from '../RpcMetricsCollector'

describe('RpcMetricsCollector', () => {
  let collector: RpcMetricsCollector

  beforeEach(() => {
    collector = new RpcMetricsCollector()
  })

  // ─── Initial state ───────────────────────────────────────────────────────

  describe('initial state', () => {
    it('requestCount is 0', () => {
      expect(collector.getSnapshot().requestCount).toBe(0)
    })

    it('failureCount is 0', () => {
      expect(collector.getSnapshot().failureCount).toBe(0)
    })

    it('averageLatencyMs is null', () => {
      expect(collector.getSnapshot().averageLatencyMs).toBeNull()
    })

    it('retryCount is 0', () => {
      expect(collector.getSnapshot().retryCount).toBe(0)
    })

    it('timeoutCount is 0', () => {
      expect(collector.getSnapshot().timeoutCount).toBe(0)
    })

    it('exposes requestCount getter', () => {
      expect(collector.requestCount).toBe(0)
    })

    it('exposes failureCount getter', () => {
      expect(collector.failureCount).toBe(0)
    })
  })

  // ─── recordRequest() success ─────────────────────────────────────────────

  describe('recordRequest() success', () => {
    it('increments requestCount', () => {
      collector.recordRequest(10, true)
      expect(collector.getSnapshot().requestCount).toBe(1)
    })

    it('does not increment failureCount', () => {
      collector.recordRequest(10, true)
      expect(collector.getSnapshot().failureCount).toBe(0)
    })

    it('sets averageLatencyMs to the single request latency', () => {
      collector.recordRequest(42, true)
      expect(collector.getSnapshot().averageLatencyMs).toBe(42)
    })

    it('computes average latency over multiple requests', () => {
      collector.recordRequest(100, true)
      collector.recordRequest(200, true)
      // average = (100 + 200) / 2 = 150
      expect(collector.getSnapshot().averageLatencyMs).toBe(150)
    })

    it('does not increment retryCount unless retried flag set', () => {
      collector.recordRequest(10, true)
      expect(collector.getSnapshot().retryCount).toBe(0)
    })

    it('does not increment timeoutCount unless timedOut flag set', () => {
      collector.recordRequest(10, true)
      expect(collector.getSnapshot().timeoutCount).toBe(0)
    })
  })

  // ─── recordRequest() failure ─────────────────────────────────────────────

  describe('recordRequest() failure', () => {
    it('increments requestCount', () => {
      collector.recordRequest(10, false)
      expect(collector.getSnapshot().requestCount).toBe(1)
    })

    it('increments failureCount', () => {
      collector.recordRequest(10, false)
      expect(collector.getSnapshot().failureCount).toBe(1)
    })

    it('includes failure latency in averageLatencyMs', () => {
      collector.recordRequest(80, false)
      expect(collector.getSnapshot().averageLatencyMs).toBe(80)
    })
  })

  // ─── Retry flag ──────────────────────────────────────────────────────────

  describe('retried option', () => {
    it('increments retryCount when retried: true', () => {
      collector.recordRequest(10, true, { retried: true })
      expect(collector.getSnapshot().retryCount).toBe(1)
    })

    it('accumulates retryCount', () => {
      collector.recordRequest(10, false, { retried: true })
      collector.recordRequest(10, true, { retried: true })
      expect(collector.getSnapshot().retryCount).toBe(2)
    })

    it('does not increment timeoutCount for retried', () => {
      collector.recordRequest(10, false, { retried: true })
      expect(collector.getSnapshot().timeoutCount).toBe(0)
    })
  })

  // ─── Timeout flag ─────────────────────────────────────────────────────────

  describe('timedOut option', () => {
    it('increments timeoutCount when timedOut: true', () => {
      collector.recordRequest(10_000, false, { timedOut: true })
      expect(collector.getSnapshot().timeoutCount).toBe(1)
    })

    it('accumulates timeoutCount', () => {
      collector.recordRequest(10_000, false, { timedOut: true })
      collector.recordRequest(10_000, false, { timedOut: true })
      expect(collector.getSnapshot().timeoutCount).toBe(2)
    })

    it('also increments failureCount for timed-out requests', () => {
      collector.recordRequest(10_000, false, { timedOut: true })
      expect(collector.getSnapshot().failureCount).toBe(1)
    })
  })

  // ─── Mixed scenario ──────────────────────────────────────────────────────

  it('tracks mixed success/failure/retry/timeout correctly', () => {
    collector.recordRequest(50, true) // success
    collector.recordRequest(200, false, { timedOut: true }) // timeout
    collector.recordRequest(30, true, { retried: true }) // retry success
    collector.recordRequest(10, false) // plain failure

    const snap = collector.getSnapshot()
    expect(snap.requestCount).toBe(4)
    expect(snap.failureCount).toBe(2) // timeout + plain failure
    expect(snap.retryCount).toBe(1)
    expect(snap.timeoutCount).toBe(1)
    expect(snap.averageLatencyMs).toBe((50 + 200 + 30 + 10) / 4)
  })

  // ─── reset() ─────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('resets requestCount to 0', () => {
      collector.recordRequest(10, true)
      collector.reset()
      expect(collector.getSnapshot().requestCount).toBe(0)
    })

    it('resets failureCount to 0', () => {
      collector.recordRequest(10, false)
      collector.reset()
      expect(collector.getSnapshot().failureCount).toBe(0)
    })

    it('resets averageLatencyMs to null', () => {
      collector.recordRequest(10, true)
      collector.reset()
      expect(collector.getSnapshot().averageLatencyMs).toBeNull()
    })

    it('resets retryCount to 0', () => {
      collector.recordRequest(10, true, { retried: true })
      collector.reset()
      expect(collector.getSnapshot().retryCount).toBe(0)
    })

    it('resets timeoutCount to 0', () => {
      collector.recordRequest(10, false, { timedOut: true })
      collector.reset()
      expect(collector.getSnapshot().timeoutCount).toBe(0)
    })
  })

  // ─── getSnapshot() ────────────────────────────────────────────────────────

  it('getSnapshot returns new object each call', () => {
    const a = collector.getSnapshot()
    const b = collector.getSnapshot()
    expect(a).not.toBe(b)
  })
})
