/**
 * NullChainProvider.test.ts — Tests for the Sprint 2 no-op provider.
 *
 * Every method must throw WalletError('RPC_NOT_CONNECTED').
 * The chainId property must be accessible without throwing.
 */

import { describe, it, expect } from 'vitest'
import { NullChainProvider } from '../NullChainProvider'
import { WalletError } from '@/domain/errors'

describe('NullChainProvider', () => {
  const provider = new NullChainProvider('qorechain-devnet')

  it('stores the chainId passed to the constructor', () => {
    expect(provider.chainId).toBe('qorechain-devnet')
  })

  it('chainId is accessible without throwing', () => {
    expect(() => provider.chainId).not.toThrow()
  })

  it('getBalance() throws a WalletError', () => {
    expect(() => provider.getBalance('0xabc')).toThrow(WalletError)
  })

  it('getBalance() throws with code RPC_NOT_CONNECTED', () => {
    try {
      provider.getBalance('0xabc')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('estimateFee() throws a WalletError', () => {
    expect(() => provider.estimateFee('0xabc', BigInt(1))).toThrow(WalletError)
  })

  it('estimateFee() throws with code RPC_NOT_CONNECTED', () => {
    try {
      provider.estimateFee('0xabc', BigInt(1))
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('sendRawTransaction() throws a WalletError', () => {
    expect(() => provider.sendRawTransaction(new Uint8Array(32))).toThrow(WalletError)
  })

  it('sendRawTransaction() throws with code RPC_NOT_CONNECTED', () => {
    try {
      provider.sendRawTransaction(new Uint8Array(32))
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('getTransactionStatus() throws a WalletError', () => {
    expect(() => provider.getTransactionStatus('0xhash')).toThrow(WalletError)
  })

  it('getTransactionStatus() throws with code RPC_NOT_CONNECTED', () => {
    try {
      provider.getTransactionStatus('0xhash')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('all four methods throw WalletError (not generic Error)', () => {
    const methods = [
      () => provider.getBalance('0xabc'),
      () => provider.estimateFee('0xabc', BigInt(0)),
      () => provider.sendRawTransaction(new Uint8Array(0)),
      () => provider.getTransactionStatus('0xhash'),
    ]
    for (const method of methods) {
      try {
        method()
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WalletError)
        expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
      }
    }
  })

  it('all methods carry the same RPC_NOT_CONNECTED code', () => {
    const methods = [
      () => provider.getBalance('0xabc'),
      () => provider.estimateFee('0xabc', BigInt(0)),
      () => provider.sendRawTransaction(new Uint8Array(0)),
      () => provider.getTransactionStatus('0xhash'),
    ]
    for (const method of methods) {
      try {
        method()
        expect.fail('should have thrown')
      } catch (err) {
        expect((err as WalletError).code).toBe('RPC_NOT_CONNECTED')
      }
    }
  })

  it('a different chainId is stored correctly', () => {
    const p = new NullChainProvider('solana-devnet')
    expect(p.chainId).toBe('solana-devnet')
  })
})
