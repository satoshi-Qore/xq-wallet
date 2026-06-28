/**
 * TransactionValidator.test.ts — Unit tests for TransactionValidator.
 *
 * Covers: validateFrom, validateTo, validateAmount, validateBalance,
 * validateAsset, validateNetwork, and the aggregate validate() method.
 */

import { describe, it, expect } from 'vitest'
import { TransactionValidator } from '../TransactionValidator'
import type { TransactionRequest } from '@/domain/transaction'
import type { Balance } from '@/domain/asset'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const EVM_FROM = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
const EVM_TO = '0x1234567890123456789012345678901234567890'
const SOL_ADDR = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'

const VALID_EVM_REQUEST: TransactionRequest = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  type: 'transfer',
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  assetId: 'ethereum-sepolia:native:SEP',
  from: EVM_FROM,
  to: EVM_TO,
  amount: BigInt('1000000000000000000'),
  createdAt: 1_700_000_000_000,
}

const VALID_SVM_REQUEST: TransactionRequest = {
  id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  type: 'transfer',
  vm: 'svm',
  chainId: 'solana-devnet',
  assetId: 'solana-devnet:native:SOL',
  from: SOL_ADDR,
  to: SOL_ADDR,
  amount: BigInt('1000000000'),
  createdAt: 1_700_000_000_000,
}

const FULL_BALANCE: Balance = {
  available: BigInt('2000000000000000000'),
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

// ─── validateFrom() ────────────────────────────────────────────────────────

describe('TransactionValidator.validateFrom()', () => {
  it('returns null for a valid EVM address', () => {
    expect(TransactionValidator.validateFrom(EVM_FROM, 'evm')).toBeNull()
  })

  it('returns null for a valid SVM address', () => {
    expect(TransactionValidator.validateFrom(SOL_ADDR, 'svm')).toBeNull()
  })

  it('returns error for an empty string', () => {
    const err = TransactionValidator.validateFrom('', 'evm')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('from')
    expect(err?.code).toBe('INVALID_ADDRESS')
  })

  it('returns error for an invalid EVM address', () => {
    const err = TransactionValidator.validateFrom('not-an-address', 'evm')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('from')
    expect(err?.code).toBe('INVALID_ADDRESS')
  })

  it('returns error for an invalid SVM address', () => {
    const err = TransactionValidator.validateFrom('not-valid!!!', 'svm')
    expect(err).not.toBeNull()
    expect(err?.code).toBe('INVALID_ADDRESS')
  })

  it('returns null for a valid native address', () => {
    const nativeAddr = '0x' + 'ab'.repeat(20)
    expect(TransactionValidator.validateFrom(nativeAddr, 'native')).toBeNull()
  })
})

// ─── validateTo() ──────────────────────────────────────────────────────────

describe('TransactionValidator.validateTo()', () => {
  it('returns null for a valid EVM address', () => {
    expect(TransactionValidator.validateTo(EVM_TO, 'evm')).toBeNull()
  })

  it('returns error for an empty string', () => {
    const err = TransactionValidator.validateTo('', 'evm')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('to')
    expect(err?.code).toBe('INVALID_ADDRESS')
  })

  it('returns error for an invalid address', () => {
    const err = TransactionValidator.validateTo('garbage', 'evm')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('to')
  })

  it('returns null for a valid SVM address', () => {
    expect(TransactionValidator.validateTo(SOL_ADDR, 'svm')).toBeNull()
  })
})

// ─── validateAmount() ──────────────────────────────────────────────────────

describe('TransactionValidator.validateAmount()', () => {
  it('returns null for a positive amount', () => {
    expect(TransactionValidator.validateAmount(BigInt(1))).toBeNull()
  })

  it('returns null for a large amount', () => {
    expect(TransactionValidator.validateAmount(BigInt('99999999999999999999'))).toBeNull()
  })

  it('returns error for zero', () => {
    const err = TransactionValidator.validateAmount(BigInt(0))
    expect(err).not.toBeNull()
    expect(err?.field).toBe('amount')
    expect(err?.code).toBe('INVALID_AMOUNT')
  })

  it('returns error for negative amount', () => {
    const err = TransactionValidator.validateAmount(BigInt(-1))
    expect(err).not.toBeNull()
    expect(err?.field).toBe('amount')
    expect(err?.code).toBe('INVALID_AMOUNT')
  })

  it('error message includes the actual amount', () => {
    const err = TransactionValidator.validateAmount(BigInt(0))
    expect(err?.message).toContain('0')
  })
})

// ─── validateBalance() ─────────────────────────────────────────────────────

describe('TransactionValidator.validateBalance()', () => {
  it('returns null when amount equals available', () => {
    const balance: Balance = { ...FULL_BALANCE, available: BigInt(100) }
    expect(TransactionValidator.validateBalance(BigInt(100), balance)).toBeNull()
  })

  it('returns null when amount is less than available', () => {
    expect(TransactionValidator.validateBalance(BigInt(1), FULL_BALANCE)).toBeNull()
  })

  it('returns error when amount exceeds available', () => {
    const err = TransactionValidator.validateBalance(BigInt('3000000000000000000'), FULL_BALANCE)
    expect(err).not.toBeNull()
    expect(err?.field).toBe('balance')
    expect(err?.code).toBe('INSUFFICIENT_BALANCE')
  })

  it('returns error when balance is zero', () => {
    const err = TransactionValidator.validateBalance(BigInt(1), EMPTY_BALANCE)
    expect(err).not.toBeNull()
    expect(err?.code).toBe('INSUFFICIENT_BALANCE')
  })

  it('error message contains symbol', () => {
    const err = TransactionValidator.validateBalance(BigInt(999), EMPTY_BALANCE)
    expect(err?.message).toContain('SEP')
  })
})

// ─── validateAsset() ───────────────────────────────────────────────────────

describe('TransactionValidator.validateAsset()', () => {
  it('returns null for a non-empty assetId', () => {
    expect(TransactionValidator.validateAsset('ethereum-sepolia:native:SEP')).toBeNull()
  })

  it('returns error for an empty assetId', () => {
    const err = TransactionValidator.validateAsset('')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('asset')
    expect(err?.code).toBe('ASSET_NOT_FOUND')
  })
})

// ─── validateNetwork() ─────────────────────────────────────────────────────

describe('TransactionValidator.validateNetwork()', () => {
  it('returns null for a non-empty chainId', () => {
    expect(TransactionValidator.validateNetwork('ethereum-sepolia')).toBeNull()
  })

  it('returns error for an empty chainId', () => {
    const err = TransactionValidator.validateNetwork('')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('network')
    expect(err?.code).toBe('UNSUPPORTED_CHAIN')
  })
})

// ─── validate() ────────────────────────────────────────────────────────────

describe('TransactionValidator.validate()', () => {
  it('returns valid:true for a fully valid EVM request', () => {
    const result = TransactionValidator.validate(VALID_EVM_REQUEST)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid:true for a fully valid SVM request', () => {
    const result = TransactionValidator.validate(VALID_SVM_REQUEST)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid:true when amount equals available balance', () => {
    const balance: Balance = { ...FULL_BALANCE, available: VALID_EVM_REQUEST.amount }
    const result = TransactionValidator.validate(VALID_EVM_REQUEST, balance)
    expect(result.valid).toBe(true)
  })

  it('returns valid:false with INSUFFICIENT_BALANCE when balance is too low', () => {
    const result = TransactionValidator.validate(VALID_EVM_REQUEST, EMPTY_BALANCE)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INSUFFICIENT_BALANCE')).toBe(true)
  })

  it('skips balance check when balance is undefined', () => {
    const result = TransactionValidator.validate(VALID_EVM_REQUEST)
    expect(result.errors.some((e) => e.code === 'INSUFFICIENT_BALANCE')).toBe(false)
  })

  it('collects multiple errors in a single pass', () => {
    const badRequest: TransactionRequest = {
      ...VALID_EVM_REQUEST,
      from: 'bad-address',
      to: 'bad-address',
      amount: BigInt(0),
    }
    const result = TransactionValidator.validate(badRequest)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })

  it('from error has field = "from"', () => {
    const bad: TransactionRequest = { ...VALID_EVM_REQUEST, from: 'x' }
    const result = TransactionValidator.validate(bad)
    expect(result.errors.some((e) => e.field === 'from')).toBe(true)
  })

  it('to error has field = "to"', () => {
    const bad: TransactionRequest = { ...VALID_EVM_REQUEST, to: 'x' }
    const result = TransactionValidator.validate(bad)
    expect(result.errors.some((e) => e.field === 'to')).toBe(true)
  })

  it('amount error has field = "amount"', () => {
    const bad: TransactionRequest = { ...VALID_EVM_REQUEST, amount: BigInt(0) }
    const result = TransactionValidator.validate(bad)
    expect(result.errors.some((e) => e.field === 'amount')).toBe(true)
  })
})
