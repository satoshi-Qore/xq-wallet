/**
 * sessionStore.test.ts
 *
 * Tests for useSessionStore: initial state, unlock, lock, recordActivity,
 * selectors, and reset.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore, selectIsUnlocked, selectLastActivityAt } from '../sessionStore'

beforeEach(() => {
  useSessionStore.getState()._reset()
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('sessionStore — initial state', () => {
  it('isUnlocked is false', () => {
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('lastActivityAt is null', () => {
    expect(useSessionStore.getState().lastActivityAt).toBeNull()
  })
})

// ─── unlock() ──────────────────────────────────────────────────────────────

describe('sessionStore — unlock()', () => {
  it('sets isUnlocked to true', () => {
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })

  it('sets lastActivityAt to a recent timestamp', () => {
    const before = Date.now()
    useSessionStore.getState().unlock()
    const { lastActivityAt } = useSessionStore.getState()
    expect(lastActivityAt).not.toBeNull()
    expect(lastActivityAt!).toBeGreaterThanOrEqual(before)
    expect(lastActivityAt!).toBeLessThanOrEqual(Date.now())
  })

  it('calling unlock twice keeps isUnlocked true', () => {
    useSessionStore.getState().unlock()
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })
})

// ─── lock() ────────────────────────────────────────────────────────────────

describe('sessionStore — lock()', () => {
  it('sets isUnlocked to false', () => {
    useSessionStore.getState().unlock()
    useSessionStore.getState().lock()
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('does not clear lastActivityAt', () => {
    useSessionStore.getState().unlock()
    const ts = useSessionStore.getState().lastActivityAt
    useSessionStore.getState().lock()
    expect(useSessionStore.getState().lastActivityAt).toBe(ts)
  })

  it('calling lock on already-locked session is safe', () => {
    expect(() => useSessionStore.getState().lock()).not.toThrow()
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('unlock → lock → unlock cycle is correct', () => {
    useSessionStore.getState().unlock()
    useSessionStore.getState().lock()
    useSessionStore.getState().unlock()
    expect(useSessionStore.getState().isUnlocked).toBe(true)
  })
})

// ─── recordActivity() ──────────────────────────────────────────────────────

describe('sessionStore — recordActivity()', () => {
  it('updates lastActivityAt', () => {
    useSessionStore.getState().unlock()
    const first = useSessionStore.getState().lastActivityAt!
    useSessionStore.getState().recordActivity()
    const second = useSessionStore.getState().lastActivityAt!
    expect(second).toBeGreaterThanOrEqual(first)
  })

  it('can be called without first unlocking', () => {
    expect(() => useSessionStore.getState().recordActivity()).not.toThrow()
    expect(useSessionStore.getState().lastActivityAt).not.toBeNull()
  })
})

// ─── selectors ─────────────────────────────────────────────────────────────

describe('sessionStore — selectors', () => {
  it('selectIsUnlocked returns false initially', () => {
    expect(selectIsUnlocked(useSessionStore.getState())).toBe(false)
  })

  it('selectIsUnlocked returns true after unlock', () => {
    useSessionStore.getState().unlock()
    expect(selectIsUnlocked(useSessionStore.getState())).toBe(true)
  })

  it('selectLastActivityAt returns null initially', () => {
    expect(selectLastActivityAt(useSessionStore.getState())).toBeNull()
  })

  it('selectLastActivityAt returns timestamp after unlock', () => {
    useSessionStore.getState().unlock()
    expect(selectLastActivityAt(useSessionStore.getState())).not.toBeNull()
  })
})

// ─── _reset() ──────────────────────────────────────────────────────────────

describe('sessionStore — _reset()', () => {
  it('resets isUnlocked to false', () => {
    useSessionStore.getState().unlock()
    useSessionStore.getState()._reset()
    expect(useSessionStore.getState().isUnlocked).toBe(false)
  })

  it('resets lastActivityAt to null', () => {
    useSessionStore.getState().unlock()
    useSessionStore.getState()._reset()
    expect(useSessionStore.getState().lastActivityAt).toBeNull()
  })
})
