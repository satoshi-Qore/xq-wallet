/**
 * securityStore.test.ts
 *
 * Tests for useSecurityStore: initial state, updateAutoLock, selectors,
 * biometric placeholders, and reset.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSecurityStore, selectAutoLockMinutes } from '../securityStore'
import type { AutoLockMinutes } from '../preferencesStore'

beforeEach(() => {
  useSecurityStore.getState()._reset()
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('securityStore — initial state', () => {
  it('autoLockMinutes is 15', () => {
    expect(useSecurityStore.getState().autoLockMinutes).toBe(15)
  })

  it('biometricAvailable is false', () => {
    expect(useSecurityStore.getState().biometricAvailable).toBe(false)
  })

  it('biometricEnabled is false', () => {
    expect(useSecurityStore.getState().biometricEnabled).toBe(false)
  })
})

// ─── updateAutoLock() ──────────────────────────────────────────────────────

describe('securityStore — updateAutoLock()', () => {
  it('updates autoLockMinutes to 5', () => {
    useSecurityStore.getState().updateAutoLock(5)
    expect(useSecurityStore.getState().autoLockMinutes).toBe(5)
  })

  it('updates autoLockMinutes to 30', () => {
    useSecurityStore.getState().updateAutoLock(30)
    expect(useSecurityStore.getState().autoLockMinutes).toBe(30)
  })

  it('updates autoLockMinutes to 60', () => {
    useSecurityStore.getState().updateAutoLock(60)
    expect(useSecurityStore.getState().autoLockMinutes).toBe(60)
  })

  it('accepts 0 (never auto-lock)', () => {
    useSecurityStore.getState().updateAutoLock(0)
    expect(useSecurityStore.getState().autoLockMinutes).toBe(0)
  })

  it('does not change biometric flags', () => {
    useSecurityStore.getState().updateAutoLock(5)
    expect(useSecurityStore.getState().biometricAvailable).toBe(false)
    expect(useSecurityStore.getState().biometricEnabled).toBe(false)
  })
})

// ─── selectors ─────────────────────────────────────────────────────────────

describe('securityStore — selectors', () => {
  it('selectAutoLockMinutes returns 15 initially', () => {
    expect(selectAutoLockMinutes(useSecurityStore.getState())).toBe(15)
  })

  it('selectAutoLockMinutes reflects updateAutoLock', () => {
    useSecurityStore.getState().updateAutoLock(60)
    expect(selectAutoLockMinutes(useSecurityStore.getState())).toBe(60)
  })
})

// ─── _reset() ──────────────────────────────────────────────────────────────

describe('securityStore — _reset()', () => {
  it('restores autoLockMinutes to 15', () => {
    useSecurityStore.getState().updateAutoLock(60)
    useSecurityStore.getState()._reset()
    expect(useSecurityStore.getState().autoLockMinutes).toBe(15)
  })

  it('biometric flags remain false after reset', () => {
    useSecurityStore.getState()._reset()
    expect(useSecurityStore.getState().biometricAvailable).toBe(false)
    expect(useSecurityStore.getState().biometricEnabled).toBe(false)
  })
})

// ─── type safety ───────────────────────────────────────────────────────────

describe('securityStore — type safety', () => {
  it('autoLockMinutes is one of the valid AutoLockMinutes values', () => {
    const valid: AutoLockMinutes[] = [0, 5, 15, 30, 60]
    expect(valid).toContain(useSecurityStore.getState().autoLockMinutes)
  })
})
