/**
 * AdapterFactory.test.ts — Unit tests for the AdapterFactory.
 *
 * Verifies that getAdapter() returns the correct adapter for each VMType,
 * that returned adapters are singletons (same reference on repeated calls),
 * and that an unsupported VM string throws WalletError('UNSUPPORTED_VM').
 */

import { describe, it, expect } from 'vitest'
import { getAdapter } from '../AdapterFactory'
import { EvmChainAdapter } from '../EvmChainAdapter'
import { SvmChainAdapter } from '../SvmChainAdapter'
import { NativeChainAdapter } from '../NativeChainAdapter'
import { WalletError } from '@/domain/errors'

// ─── getAdapter() ─────────────────────────────────────────────────────────

describe('getAdapter()', () => {
  it('returns an EvmChainAdapter for "evm"', () => {
    expect(getAdapter('evm')).toBeInstanceOf(EvmChainAdapter)
  })

  it('returns an SvmChainAdapter for "svm"', () => {
    expect(getAdapter('svm')).toBeInstanceOf(SvmChainAdapter)
  })

  it('returns a NativeChainAdapter for "native"', () => {
    expect(getAdapter('native')).toBeInstanceOf(NativeChainAdapter)
  })

  it('returns the same singleton instance on repeated calls', () => {
    expect(getAdapter('evm')).toBe(getAdapter('evm'))
    expect(getAdapter('svm')).toBe(getAdapter('svm'))
    expect(getAdapter('native')).toBe(getAdapter('native'))
  })

  it('each VM returns a distinct instance', () => {
    expect(getAdapter('evm')).not.toBe(getAdapter('svm'))
    expect(getAdapter('svm')).not.toBe(getAdapter('native'))
    expect(getAdapter('evm')).not.toBe(getAdapter('native'))
  })

  it('adapter.vm matches the requested VMType', () => {
    expect(getAdapter('evm').vm).toBe('evm')
    expect(getAdapter('svm').vm).toBe('svm')
    expect(getAdapter('native').vm).toBe('native')
  })

  it('throws WalletError UNSUPPORTED_VM for an unknown VM string', () => {
    expect(() => getAdapter('unknown' as 'evm')).toThrow(WalletError)
    try {
      getAdapter('unknown' as 'evm')
    } catch (err) {
      expect(WalletError.isWalletError(err)).toBe(true)
      if (WalletError.isWalletError(err)) {
        expect(err.code).toBe('UNSUPPORTED_VM')
      }
    }
  })

  it('adapters from the factory are functional (isValidAddress works)', () => {
    expect(getAdapter('evm').isValidAddress('0x' + 'a'.repeat(40))).toBe(true)
    expect(getAdapter('svm').isValidAddress('not-valid!!!')).toBe(false)
    expect(getAdapter('native').isValidAddress('0x' + '0'.repeat(40))).toBe(true)
  })
})
