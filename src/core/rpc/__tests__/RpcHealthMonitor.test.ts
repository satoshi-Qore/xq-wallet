/**
 * RpcHealthMonitor — unit tests.
 *
 * Covers: initial state, record() mutation, availability score rolling window,
 * consecutive failure tracking, injectable clock for timestamps, reset().
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RpcHealthMonitor } from '../RpcHealthMonitor'

describe('RpcHealthMonitor', () => {
  let monitor: RpcHealthMonitor
  let fakeNow: number

  beforeEach(() => {
    fakeNow = 1_000_000
    monitor = new RpcHealthMonitor(() => fakeNow)
  })

  // ─── Initial state ───────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has null lastResponseTimeMs', () => {
      expect(monitor.getSnapshot().lastResponseTimeMs).toBeNull()
    })

    it('has null lastSuccessAt', () => {
      expect(monitor.getSnapshot().lastSuccessAt).toBeNull()
    })

    it('has null lastFailureAt', () => {
      expect(monitor.getSnapshot().lastFailureAt).toBeNull()
    })

    it('has 0 consecutiveFailures', () => {
      expect(monitor.getSnapshot().consecutiveFailures).toBe(0)
    })

    it('has availabilityScore 1.0 (optimistic default)', () => {
      expect(monitor.getSnapshot().availabilityScore).toBe(1.0)
    })

    it('exposes consecutiveFailures getter directly', () => {
      expect(monitor.consecutiveFailures).toBe(0)
    })

    it('exposes availabilityScore getter directly', () => {
      expect(monitor.availabilityScore).toBe(1.0)
    })
  })

  // ─── record() success ────────────────────────────────────────────────────

  describe('record() success', () => {
    it('updates lastResponseTimeMs', () => {
      monitor.record(true, 42)
      expect(monitor.getSnapshot().lastResponseTimeMs).toBe(42)
    })

    it('updates lastSuccessAt with injected clock', () => {
      fakeNow = 2_000_000
      monitor.record(true, 10)
      expect(monitor.getSnapshot().lastSuccessAt).toBe(2_000_000)
    })

    it('does not update lastFailureAt on success', () => {
      monitor.record(true, 10)
      expect(monitor.getSnapshot().lastFailureAt).toBeNull()
    })

    it('keeps consecutiveFailures at 0 after success', () => {
      monitor.record(true, 10)
      expect(monitor.consecutiveFailures).toBe(0)
    })

    it('resets consecutiveFailures to 0 after failures', () => {
      monitor.record(false, 10)
      monitor.record(false, 10)
      monitor.record(true, 10)
      expect(monitor.consecutiveFailures).toBe(0)
    })

    it('availability score is 1.0 after all successes', () => {
      for (let i = 0; i < 10; i++) monitor.record(true, 10)
      expect(monitor.availabilityScore).toBe(1.0)
    })
  })

  // ─── record() failure ────────────────────────────────────────────────────

  describe('record() failure', () => {
    it('updates lastResponseTimeMs', () => {
      monitor.record(false, 99)
      expect(monitor.getSnapshot().lastResponseTimeMs).toBe(99)
    })

    it('updates lastFailureAt with injected clock', () => {
      fakeNow = 3_000_000
      monitor.record(false, 10)
      expect(monitor.getSnapshot().lastFailureAt).toBe(3_000_000)
    })

    it('does not update lastSuccessAt on failure', () => {
      monitor.record(false, 10)
      expect(monitor.getSnapshot().lastSuccessAt).toBeNull()
    })

    it('increments consecutiveFailures', () => {
      monitor.record(false, 10)
      expect(monitor.consecutiveFailures).toBe(1)
    })

    it('accumulates consecutiveFailures across calls', () => {
      monitor.record(false, 10)
      monitor.record(false, 10)
      monitor.record(false, 10)
      expect(monitor.consecutiveFailures).toBe(3)
    })

    it('availability score is 0.0 after all failures', () => {
      for (let i = 0; i < 10; i++) monitor.record(false, 10)
      expect(monitor.availabilityScore).toBe(0.0)
    })
  })

  // ─── Availability score (rolling window) ─────────────────────────────────

  describe('availability score rolling window', () => {
    it('is 0.5 after equal successes and failures', () => {
      for (let i = 0; i < 5; i++) monitor.record(true, 10)
      for (let i = 0; i < 5; i++) monitor.record(false, 10)
      expect(monitor.availabilityScore).toBe(0.5)
    })

    it('is 0.75 after 3 successes and 1 failure', () => {
      monitor.record(true, 10)
      monitor.record(true, 10)
      monitor.record(true, 10)
      monitor.record(false, 10)
      expect(monitor.availabilityScore).toBe(0.75)
    })

    it('rolls over oldest entries after 100 requests', () => {
      // Fill with 100 successes
      for (let i = 0; i < 100; i++) monitor.record(true, 10)
      expect(monitor.availabilityScore).toBe(1.0)

      // Add 50 failures — oldest 50 successes fall off window
      for (let i = 0; i < 50; i++) monitor.record(false, 10)
      // Window now has 50 successes + 50 failures = 0.5
      expect(monitor.availabilityScore).toBe(0.5)
    })
  })

  // ─── reset() ─────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears lastResponseTimeMs', () => {
      monitor.record(true, 42)
      monitor.reset()
      expect(monitor.getSnapshot().lastResponseTimeMs).toBeNull()
    })

    it('clears lastSuccessAt', () => {
      monitor.record(true, 10)
      monitor.reset()
      expect(monitor.getSnapshot().lastSuccessAt).toBeNull()
    })

    it('clears lastFailureAt', () => {
      monitor.record(false, 10)
      monitor.reset()
      expect(monitor.getSnapshot().lastFailureAt).toBeNull()
    })

    it('resets consecutiveFailures to 0', () => {
      monitor.record(false, 10)
      monitor.record(false, 10)
      monitor.reset()
      expect(monitor.consecutiveFailures).toBe(0)
    })

    it('resets availability score to 1.0 (optimistic)', () => {
      for (let i = 0; i < 10; i++) monitor.record(false, 10)
      monitor.reset()
      expect(monitor.availabilityScore).toBe(1.0)
    })
  })

  // ─── getSnapshot() returns immutable copy ────────────────────────────────

  it('getSnapshot returns new object each call', () => {
    const a = monitor.getSnapshot()
    const b = monitor.getSnapshot()
    expect(a).not.toBe(b)
  })
})
