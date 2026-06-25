/**
 * MockBalanceProvider.test.ts — Unit tests for MockBalanceProvider.
 *
 * Tests: getBalance, getBalances, constructor overrides, withBalance factory.
 */

import { describe, it, expect } from 'vitest'
import { MockBalanceProvider } from '../MockBalanceProvider'
import type { NativeAsset } from '@/domain/asset'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const QR: NativeAsset = {
  id: 'qorechain-devnet:native:QR',
  type: 'native',
  symbol: 'QR',
  name: 'QoreChain Token',
  decimals: 18,
  vm: 'native',
  chainId: 'qorechain-devnet',
  logoKey: 'qorechain',
}

const SEP: NativeAsset = {
  id: 'ethereum-sepolia:native:SEP',
  type: 'native',
  symbol: 'SEP',
  name: 'Sepolia Ether',
  decimals: 18,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  logoKey: 'ethereum',
}

const SOL: NativeAsset = {
  id: 'solana-devnet:native:SOL',
  type: 'native',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  vm: 'svm',
  chainId: 'solana-devnet',
  logoKey: 'solana',
}

const UNKNOWN_ASSET: NativeAsset = {
  id: 'unknown-chain:native:UNKNOWN',
  type: 'native',
  symbol: 'UNKNOWN',
  name: 'Unknown Token',
  decimals: 18,
  vm: 'native',
  chainId: 'unknown-chain',
  logoKey: '',
}

const ANY_ADDRESS = '0x1234567890123456789012345678901234567890'

// ─── getBalance() ──────────────────────────────────────────────────────────

describe('MockBalanceProvider — getBalance()', () => {
  const provider = new MockBalanceProvider()

  it('returns 1 QR for the QoreChain devnet asset', async () => {
    const balance = await provider.getBalance(ANY_ADDRESS, QR)
    expect(balance.available).toBe(BigInt('1000000000000000000'))
    expect(balance.pending).toBe(BigInt(0))
    expect(balance.locked).toBe(BigInt(0))
    expect(balance.decimals).toBe(18)
    expect(balance.symbol).toBe('QR')
  })

  it('returns 1 SEP for the Sepolia asset', async () => {
    const balance = await provider.getBalance(ANY_ADDRESS, SEP)
    expect(balance.available).toBe(BigInt('1000000000000000000'))
    expect(balance.symbol).toBe('SEP')
  })

  it('returns 1 SOL for the Solana devnet asset', async () => {
    const balance = await provider.getBalance(ANY_ADDRESS, SOL)
    expect(balance.available).toBe(BigInt('1000000000'))
    expect(balance.decimals).toBe(9)
    expect(balance.symbol).toBe('SOL')
  })

  it('returns zero balance for an unknown asset', async () => {
    const balance = await provider.getBalance(ANY_ADDRESS, UNKNOWN_ASSET)
    expect(balance.available).toBe(BigInt(0))
    expect(balance.pending).toBe(BigInt(0))
    expect(balance.locked).toBe(BigInt(0))
  })

  it('is address-agnostic — same balance for different addresses', async () => {
    const b1 = await provider.getBalance('0xaaa', QR)
    const b2 = await provider.getBalance('0xbbb', QR)
    expect(b1.available).toBe(b2.available)
  })
})

// ─── getBalances() ─────────────────────────────────────────────────────────

describe('MockBalanceProvider — getBalances()', () => {
  const provider = new MockBalanceProvider()

  it('returns one entry per asset in input order', async () => {
    const results = await provider.getBalances(ANY_ADDRESS, [QR, SEP, SOL])
    expect(results).toHaveLength(3)
    expect(results[0].asset).toEqual(QR)
    expect(results[1].asset).toEqual(SEP)
    expect(results[2].asset).toEqual(SOL)
  })

  it('returns correct balances for each asset', async () => {
    const results = await provider.getBalances(ANY_ADDRESS, [QR, SOL])
    expect(results[0].balance.available).toBe(BigInt('1000000000000000000'))
    expect(results[1].balance.available).toBe(BigInt('1000000000'))
  })

  it('returns empty array for empty input', async () => {
    const results = await provider.getBalances(ANY_ADDRESS, [])
    expect(results).toHaveLength(0)
  })

  it('returns zero for unknown assets in batch', async () => {
    const results = await provider.getBalances(ANY_ADDRESS, [UNKNOWN_ASSET])
    expect(results[0].balance.available).toBe(BigInt(0))
  })
})

// ─── constructor overrides ─────────────────────────────────────────────────

describe('MockBalanceProvider — constructor overrides', () => {
  it('override replaces the default balance for a known asset', async () => {
    const custom = BigInt('9999')
    const provider = new MockBalanceProvider({ [QR.id]: custom })
    const balance = await provider.getBalance(ANY_ADDRESS, QR)
    expect(balance.available).toBe(custom)
  })

  it('override works for a batch call', async () => {
    const custom = BigInt('42')
    const provider = new MockBalanceProvider({ [SEP.id]: custom })
    const results = await provider.getBalances(ANY_ADDRESS, [SEP])
    expect(results[0].balance.available).toBe(custom)
  })

  it('non-overridden assets still use defaults', async () => {
    const provider = new MockBalanceProvider({ [QR.id]: BigInt(0) })
    const balance = await provider.getBalance(ANY_ADDRESS, SOL)
    expect(balance.available).toBe(BigInt('1000000000'))
  })
})

// ─── withBalance() factory ─────────────────────────────────────────────────

describe('MockBalanceProvider — withBalance()', () => {
  it('creates a provider with a single asset override', async () => {
    const provider = MockBalanceProvider.withBalance(QR.id, BigInt('500'))
    const balance = await provider.getBalance(ANY_ADDRESS, QR)
    expect(balance.available).toBe(BigInt('500'))
  })

  it('non-specified assets still return defaults', async () => {
    const provider = MockBalanceProvider.withBalance(QR.id, BigInt(0))
    const balance = await provider.getBalance(ANY_ADDRESS, SOL)
    expect(balance.available).toBe(BigInt('1000000000'))
  })
})
