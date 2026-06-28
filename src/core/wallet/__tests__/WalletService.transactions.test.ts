/**
 * WalletService.transactions.test.ts — Tests for WalletService transaction methods.
 *
 * Covers: createTransaction, estimateFee, validateTransaction, prepareSigningPayload.
 * Uses injected MockFeeEstimator and pre-imported WalletService helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WalletService } from '../WalletService'
import { MockFeeEstimator } from '@/core/transaction/MockFeeEstimator'
import { WalletError } from '@/domain/errors'
import type { Balance } from '@/domain/asset'
import type { TransactionRequest } from '@/domain/transaction'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const EVM_FROM = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
const EVM_TO = '0x1234567890123456789012345678901234567890'
const AMOUNT = BigInt('1000000000000000000')

const FULL_BALANCE: Balance = {
  available: BigInt('5000000000000000000'),
  pending: BigInt(0),
  locked: BigInt(0),
  decimals: 18,
  symbol: 'SEP',
}

const EMPTY_BALANCE: Balance = {
  available: BigInt(0),
  pending: BigInt(0),
  locked: BigInt(0),
  decimals: 18,
  symbol: 'SEP',
}

function makeSvc(): WalletService {
  return new WalletService({
    pbkdf2Iterations: 1,
    feeEstimator: new MockFeeEstimator(),
  })
}

// ─── createTransaction() ───────────────────────────────────────────────────

describe('WalletService — createTransaction()', () => {
  it('creates a valid EVM transfer request', () => {
    const svc = makeSvc()
    const req = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })
    expect(req.vm).toBe('evm')
    expect(req.chainId).toBe('ethereum-sepolia')
    expect(req.from).toBe(EVM_FROM)
    expect(req.to).toBe(EVM_TO)
    expect(req.amount).toBe(AMOUNT)
    expect(req.type).toBe('transfer')
  })

  it('creates a valid native transfer request', () => {
    const svc = makeSvc()
    const nFrom = '0x' + 'ab'.repeat(20)
    const nTo = '0x' + 'cd'.repeat(20)
    const req = svc.createTransaction({
      vm: 'native',
      chainId: 'qorechain-devnet',
      assetId: 'qorechain-devnet:native:QR',
      from: nFrom,
      to: nTo,
      amount: BigInt(1),
    })
    expect(req.vm).toBe('native')
  })

  it('does not require wallet to be initialized', () => {
    const svc = makeSvc()
    // No importWallet — should still work
    expect(() =>
      svc.createTransaction({
        vm: 'evm',
        chainId: 'ethereum-sepolia',
        assetId: 'ethereum-sepolia:native:SEP',
        from: EVM_FROM,
        to: EVM_TO,
        amount: AMOUNT,
      }),
    ).not.toThrow()
  })

  it('generates a UUID id', () => {
    const svc = makeSvc()
    const req = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('accepts an optional memo', () => {
    const svc = makeSvc()
    const req = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
      memo: 'service payment',
    })
    expect(req.memo).toBe('service payment')
  })

  it('throws INVALID_ADDRESS for invalid from address', () => {
    const svc = makeSvc()
    let err: unknown
    try {
      svc.createTransaction({
        vm: 'evm',
        chainId: 'ethereum-sepolia',
        assetId: 'ethereum-sepolia:native:SEP',
        from: 'bad-from',
        to: EVM_TO,
        amount: AMOUNT,
      })
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_ADDRESS')
  })

  it('throws INVALID_ADDRESS for invalid to address', () => {
    const svc = makeSvc()
    let err: unknown
    try {
      svc.createTransaction({
        vm: 'evm',
        chainId: 'ethereum-sepolia',
        assetId: 'ethereum-sepolia:native:SEP',
        from: EVM_FROM,
        to: 'bad-to',
        amount: AMOUNT,
      })
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_ADDRESS')
  })

  it('throws INVALID_AMOUNT for zero amount', () => {
    const svc = makeSvc()
    let err: unknown
    try {
      svc.createTransaction({
        vm: 'evm',
        chainId: 'ethereum-sepolia',
        assetId: 'ethereum-sepolia:native:SEP',
        from: EVM_FROM,
        to: EVM_TO,
        amount: BigInt(0),
      })
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_AMOUNT')
  })
})

// ─── estimateFee() ─────────────────────────────────────────────────────────

describe('WalletService — estimateFee()', () => {
  let svc: WalletService
  let evmReq: TransactionRequest

  beforeEach(() => {
    svc = makeSvc()
    evmReq = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })
  })

  it('returns a FeeEstimate with slow, normal, fast tiers', async () => {
    const estimate = await svc.estimateFee(evmReq)
    expect(estimate).toHaveProperty('slow')
    expect(estimate).toHaveProperty('normal')
    expect(estimate).toHaveProperty('fast')
  })

  it('FeeEstimate.vm matches the request vm', async () => {
    const estimate = await svc.estimateFee(evmReq)
    expect(estimate.vm).toBe('evm')
  })

  it('FeeEstimate.chainId matches the request chainId', async () => {
    const estimate = await svc.estimateFee(evmReq)
    expect(estimate.chainId).toBe('ethereum-sepolia')
  })

  it('fast fee exceeds slow fee for EVM', async () => {
    const estimate = await svc.estimateFee(evmReq)
    expect(estimate.fast.maxFee > estimate.slow.maxFee).toBe(true)
  })

  it('does not require wallet to be initialized', async () => {
    await expect(svc.estimateFee(evmReq)).resolves.not.toThrow()
  })
})

// ─── validateTransaction() ─────────────────────────────────────────────────

describe('WalletService — validateTransaction()', () => {
  let svc: WalletService
  let validReq: TransactionRequest

  beforeEach(() => {
    svc = makeSvc()
    validReq = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })
  })

  it('returns valid:true for a valid request without balance', () => {
    const result = svc.validateTransaction(validReq)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid:true when balance is sufficient', () => {
    const result = svc.validateTransaction(validReq, FULL_BALANCE)
    expect(result.valid).toBe(true)
  })

  it('returns valid:false with INSUFFICIENT_BALANCE when balance is zero', () => {
    const result = svc.validateTransaction(validReq, EMPTY_BALANCE)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INSUFFICIENT_BALANCE')).toBe(true)
  })

  it('does not require wallet to be initialized', () => {
    expect(() => svc.validateTransaction(validReq)).not.toThrow()
  })

  it('returns errors for all failed fields simultaneously', () => {
    const badReq: TransactionRequest = {
      ...validReq,
      from: 'bad',
      amount: BigInt(0),
    }
    const result = svc.validateTransaction(badReq)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── prepareSigningPayload() ────────────────────────────────────────────────

describe('WalletService — prepareSigningPayload()', () => {
  let svc: WalletService
  let evmReq: TransactionRequest

  beforeEach(() => {
    svc = makeSvc()
    evmReq = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })
  })

  it('returns a SigningPayload with transactionId matching request.id', () => {
    const sp = svc.prepareSigningPayload(evmReq, 0)
    expect(sp.transactionId).toBe(evmReq.id)
  })

  it('uses secp256k1-keccak256 algorithm for EVM', () => {
    const sp = svc.prepareSigningPayload(evmReq, 0)
    expect(sp.algorithm).toBe('secp256k1-keccak256')
  })

  it('uses secp256k1-keccak256 algorithm for native', () => {
    const nFrom = '0x' + 'ab'.repeat(20)
    const nTo = '0x' + 'cd'.repeat(20)
    const nReq = svc.createTransaction({
      vm: 'native',
      chainId: 'qorechain-devnet',
      assetId: 'qorechain-devnet:native:QR',
      from: nFrom,
      to: nTo,
      amount: BigInt(1),
    })
    const sp = svc.prepareSigningPayload(nReq, 0)
    expect(sp.algorithm).toBe('secp256k1-keccak256')
  })

  it('payload is a non-empty Uint8Array', () => {
    const sp = svc.prepareSigningPayload(evmReq, 0)
    expect(sp.payload).toBeInstanceOf(Uint8Array)
    expect(sp.payload.length).toBeGreaterThan(0)
  })

  it('payload is deterministic — same input produces same bytes', () => {
    const sp1 = svc.prepareSigningPayload(evmReq, 0)
    const sp2 = svc.prepareSigningPayload(evmReq, 0)
    expect(sp1.payload).toEqual(sp2.payload)
  })

  it('accountIndex is set correctly', () => {
    const sp = svc.prepareSigningPayload(evmReq, 2)
    expect(sp.accountIndex).toBe(2)
  })

  it('vm and chainId are propagated from the request', () => {
    const sp = svc.prepareSigningPayload(evmReq, 0)
    expect(sp.vm).toBe('evm')
    expect(sp.chainId).toBe('ethereum-sepolia')
  })

  it('does not require wallet to be initialized', () => {
    expect(() => svc.prepareSigningPayload(evmReq, 0)).not.toThrow()
  })

  it('different transactions produce different payloads', () => {
    const req2 = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: BigInt(2),
    })
    const sp1 = svc.prepareSigningPayload(evmReq, 0)
    const sp2 = svc.prepareSigningPayload(req2, 0)
    // Different amounts => different payloads
    expect(sp1.payload).not.toEqual(sp2.payload)
  })

  it('payload encodes the amount as a decimal string (no precision loss)', () => {
    const sp = svc.prepareSigningPayload(evmReq, 0)
    const decoded = new TextDecoder().decode(sp.payload)
    const parsed: Record<string, unknown> = JSON.parse(decoded)
    expect(parsed.amount).toBe(AMOUNT.toString())
  })

  it('memo is included in payload when set', () => {
    const withMemo = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
      memo: 'hello world',
    })
    const sp = svc.prepareSigningPayload(withMemo, 0)
    const decoded = new TextDecoder().decode(sp.payload)
    expect(decoded).toContain('hello world')
  })
})

// ─── Full pipeline ──────────────────────────────────────────────────────────

describe('WalletService — transaction pipeline (create → validate → fee → payload)', () => {
  it('end-to-end pipeline succeeds for EVM transfer', async () => {
    const svc = makeSvc()

    const req = svc.createTransaction({
      vm: 'evm',
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: EVM_FROM,
      to: EVM_TO,
      amount: AMOUNT,
    })

    const validation = svc.validateTransaction(req, FULL_BALANCE)
    expect(validation.valid).toBe(true)

    const fee = await svc.estimateFee(req)
    expect(fee.vm).toBe('evm')
    expect(fee.slow.maxFee).toBeLessThan(fee.fast.maxFee)
  })
})
