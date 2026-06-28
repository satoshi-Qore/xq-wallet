/**
 * MockFeeEstimator.test.ts — Unit tests for MockFeeEstimator.
 *
 * Covers: fee table accuracy, tier ordering, VM coverage, FeeEstimate shape.
 */

import { describe, it, expect } from 'vitest'
import { MockFeeEstimator } from '../MockFeeEstimator'
import type { TransactionRequest } from '@/domain/transaction'

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<TransactionRequest> = {}): TransactionRequest {
  return {
    id: 'test-id',
    type: 'transfer',
    vm: 'evm',
    chainId: 'ethereum-sepolia',
    assetId: 'ethereum-sepolia:native:SEP',
    from: '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01',
    to: '0x1234567890123456789012345678901234567890',
    amount: BigInt('1000000000000000000'),
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

const estimator = new MockFeeEstimator()

// ─── FeeEstimate shape ─────────────────────────────────────────────────────

describe('MockFeeEstimator — FeeEstimate shape', () => {
  it('returns a FeeEstimate with slow, normal, fast tiers', async () => {
    const estimate = await estimator.estimate(makeRequest())
    expect(estimate).toHaveProperty('slow')
    expect(estimate).toHaveProperty('normal')
    expect(estimate).toHaveProperty('fast')
  })

  it('FeeEstimate includes assetId, vm, chainId, estimatedAt', async () => {
    const estimate = await estimator.estimate(makeRequest())
    expect(typeof estimate.assetId).toBe('string')
    expect(estimate.vm).toBe('evm')
    expect(estimate.chainId).toBe('ethereum-sepolia')
    expect(typeof estimate.estimatedAt).toBe('number')
  })

  it('estimatedAt is close to Date.now()', async () => {
    const before = Date.now()
    const estimate = await estimator.estimate(makeRequest())
    const after = Date.now()
    expect(estimate.estimatedAt).toBeGreaterThanOrEqual(before)
    expect(estimate.estimatedAt).toBeLessThanOrEqual(after)
  })

  it('each tier has priority field matching its key', async () => {
    const estimate = await estimator.estimate(makeRequest())
    expect(estimate.slow.priority).toBe('slow')
    expect(estimate.normal.priority).toBe('normal')
    expect(estimate.fast.priority).toBe('fast')
  })

  it('all fee amounts are bigint', async () => {
    const estimate = await estimator.estimate(makeRequest())
    for (const tier of [estimate.slow, estimate.normal, estimate.fast]) {
      expect(typeof tier.maxFee).toBe('bigint')
      expect(typeof tier.baseFee).toBe('bigint')
      expect(typeof tier.priorityFee).toBe('bigint')
    }
  })

  it('maxFee = baseFee + priorityFee for all tiers', async () => {
    const estimate = await estimator.estimate(makeRequest())
    for (const tier of [estimate.slow, estimate.normal, estimate.fast]) {
      expect(tier.maxFee).toBe(tier.baseFee + tier.priorityFee)
    }
  })

  it('all fee amounts are >= 0', async () => {
    const estimate = await estimator.estimate(makeRequest())
    for (const tier of [estimate.slow, estimate.normal, estimate.fast]) {
      expect(tier.maxFee >= BigInt(0)).toBe(true)
      expect(tier.baseFee >= BigInt(0)).toBe(true)
      expect(tier.priorityFee >= BigInt(0)).toBe(true)
    }
  })
})

// ─── Fee tier ordering ─────────────────────────────────────────────────────

describe('MockFeeEstimator — tier ordering', () => {
  it('EVM: fast.maxFee > normal.maxFee > slow.maxFee', async () => {
    const e = await estimator.estimate(makeRequest({ vm: 'evm' }))
    expect(e.fast.maxFee > e.normal.maxFee).toBe(true)
    expect(e.normal.maxFee > e.slow.maxFee).toBe(true)
  })

  it('EVM: fast.estimatedSeconds < normal.estimatedSeconds < slow.estimatedSeconds', async () => {
    const e = await estimator.estimate(makeRequest({ vm: 'evm' }))
    expect(e.fast.estimatedSeconds).toBeLessThan(e.normal.estimatedSeconds)
    expect(e.normal.estimatedSeconds).toBeLessThan(e.slow.estimatedSeconds)
  })

  it('SVM: fast.maxFee >= normal.maxFee >= slow.maxFee', async () => {
    const e = await estimator.estimate(
      makeRequest({ vm: 'svm', chainId: 'solana-devnet', assetId: 'solana-devnet:native:SOL' }),
    )
    expect(e.fast.maxFee >= e.normal.maxFee).toBe(true)
    expect(e.normal.maxFee >= e.slow.maxFee).toBe(true)
  })

  it('SVM: fast.estimatedSeconds < normal.estimatedSeconds', async () => {
    const e = await estimator.estimate(
      makeRequest({ vm: 'svm', chainId: 'solana-devnet', assetId: 'solana-devnet:native:SOL' }),
    )
    expect(e.fast.estimatedSeconds).toBeLessThan(e.normal.estimatedSeconds)
  })

  it('native: fast.maxFee > normal.maxFee > slow.maxFee', async () => {
    const e = await estimator.estimate(
      makeRequest({
        vm: 'native',
        chainId: 'qorechain-devnet',
        assetId: 'qorechain-devnet:native:QR',
      }),
    )
    expect(e.fast.maxFee > e.normal.maxFee).toBe(true)
    expect(e.normal.maxFee > e.slow.maxFee).toBe(true)
  })
})

// ─── VM coverage ───────────────────────────────────────────────────────────

describe('MockFeeEstimator — VM coverage', () => {
  it('estimates fees for EVM', async () => {
    const e = await estimator.estimate(makeRequest({ vm: 'evm' }))
    expect(e.vm).toBe('evm')
  })

  it('estimates fees for SVM', async () => {
    const e = await estimator.estimate(
      makeRequest({ vm: 'svm', chainId: 'solana-devnet', assetId: 'solana-devnet:native:SOL' }),
    )
    expect(e.vm).toBe('svm')
    // SVM base fee should be 5000 lamports for slow and normal
    expect(e.slow.baseFee).toBe(BigInt(5000))
    expect(e.normal.baseFee).toBe(BigInt(5000))
  })

  it('estimates fees for native', async () => {
    const e = await estimator.estimate(
      makeRequest({
        vm: 'native',
        chainId: 'qorechain-devnet',
        assetId: 'qorechain-devnet:native:QR',
      }),
    )
    expect(e.vm).toBe('native')
  })

  it('gas assetId maps to chain native token for known chains', async () => {
    const evmEstimate = await estimator.estimate(
      makeRequest({ vm: 'evm', chainId: 'ethereum-sepolia' }),
    )
    expect(evmEstimate.assetId).toBe('ethereum-sepolia:native:SEP')

    const svmEstimate = await estimator.estimate(
      makeRequest({ vm: 'svm', chainId: 'solana-devnet', assetId: 'solana-devnet:native:SOL' }),
    )
    expect(svmEstimate.assetId).toBe('solana-devnet:native:SOL')

    const nativeEstimate = await estimator.estimate(
      makeRequest({
        vm: 'native',
        chainId: 'qorechain-devnet',
        assetId: 'qorechain-devnet:native:QR',
      }),
    )
    expect(nativeEstimate.assetId).toBe('qorechain-devnet:native:QR')
    expect(nativeEstimate.vm).toBe('native')
    expect(nativeEstimate.chainId).toBe('qorechain-devnet')
    expect(nativeEstimate.slow.maxFee).toBeLessThan(nativeEstimate.normal.maxFee)
    expect(nativeEstimate.normal.maxFee).toBeLessThan(nativeEstimate.fast.maxFee)
  })
})
