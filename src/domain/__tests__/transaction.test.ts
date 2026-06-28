/**
 * transaction.test.ts — Unit tests for transaction domain types and type shapes.
 *
 * Validates: interface shapes, type guard patterns, discriminant fields,
 * and structural invariants of the transaction model.
 */

import { describe, it, expect } from 'vitest'
import type {
  TransactionRequest,
  SigningPayload,
  SignedTransaction,
  FeeEstimate,
  Fee,
  TransactionValidationResult,
  TransactionValidationError,
  TransactionType,
  TransactionStatus,
  FeePriority,
  SigningAlgorithm,
} from '../transaction'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VALID_REQUEST: TransactionRequest = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  type: 'transfer',
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  assetId: 'ethereum-sepolia:native:SEP',
  from: '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01',
  to: '0x1234567890123456789012345678901234567890',
  amount: BigInt('1000000000000000000'),
  createdAt: 1_700_000_000_000,
}

const MOCK_PAYLOAD = new Uint8Array([1, 2, 3, 4])

const SIGNING_PAYLOAD: SigningPayload = {
  transactionId: VALID_REQUEST.id,
  payload: MOCK_PAYLOAD,
  algorithm: 'secp256k1-keccak256',
  accountIndex: 0,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
}

const SIGNED_TX: SignedTransaction = {
  transactionId: VALID_REQUEST.id,
  signatureBytes: new Uint8Array(64),
  signatureHex: '0'.repeat(128),
  algorithm: 'secp256k1-keccak256',
  signedAt: 1_700_000_001_000,
}

const MOCK_FEE: Fee = {
  priority: 'normal',
  maxFee: BigInt('357000000000000'),
  baseFee: BigInt('315000000000000'),
  priorityFee: BigInt('42000000000000'),
  estimatedSeconds: 60,
}

const MOCK_FEE_ESTIMATE: FeeEstimate = {
  assetId: 'ethereum-sepolia:native:SEP',
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  slow: { ...MOCK_FEE, priority: 'slow', maxFee: BigInt('231000000000000'), estimatedSeconds: 120 },
  normal: MOCK_FEE,
  fast: { ...MOCK_FEE, priority: 'fast', maxFee: BigInt('525000000000000'), estimatedSeconds: 15 },
  estimatedAt: 1_700_000_000_000,
}

// ─── TransactionRequest ─────────────────────────────────────────────────────

describe('TransactionRequest', () => {
  it('holds all required fields', () => {
    expect(VALID_REQUEST.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(VALID_REQUEST.type).toBe('transfer')
    expect(VALID_REQUEST.vm).toBe('evm')
    expect(VALID_REQUEST.chainId).toBe('ethereum-sepolia')
    expect(VALID_REQUEST.assetId).toBe('ethereum-sepolia:native:SEP')
    expect(VALID_REQUEST.from).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(VALID_REQUEST.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(VALID_REQUEST.amount).toBe(BigInt('1000000000000000000'))
    expect(typeof VALID_REQUEST.createdAt).toBe('number')
  })

  it('memo is optional', () => {
    const withMemo: TransactionRequest = { ...VALID_REQUEST, memo: 'Payment' }
    expect(withMemo.memo).toBe('Payment')
    expect(VALID_REQUEST.memo).toBeUndefined()
  })

  it('amount uses bigint (no float)', () => {
    expect(typeof VALID_REQUEST.amount).toBe('bigint')
  })

  it('accepts all TransactionType values', () => {
    const types: TransactionType[] = ['transfer', 'contract_call', 'contract_deploy']
    for (const type of types) {
      const req: TransactionRequest = { ...VALID_REQUEST, type }
      expect(req.type).toBe(type)
    }
  })

  it('accepts all TransactionStatus values (structural check)', () => {
    const statuses: TransactionStatus[] = ['pending', 'submitted', 'confirmed', 'failed', 'dropped']
    expect(statuses).toHaveLength(5)
  })

  it('accepts all VM types', () => {
    const evmReq: TransactionRequest = { ...VALID_REQUEST, vm: 'evm' }
    const svmReq: TransactionRequest = { ...VALID_REQUEST, vm: 'svm' }
    const nativeReq: TransactionRequest = { ...VALID_REQUEST, vm: 'native' }
    expect(evmReq.vm).toBe('evm')
    expect(svmReq.vm).toBe('svm')
    expect(nativeReq.vm).toBe('native')
  })
})

// ─── SigningPayload ─────────────────────────────────────────────────────────

describe('SigningPayload', () => {
  it('holds transactionId, payload bytes, algorithm, accountIndex, vm, chainId', () => {
    expect(SIGNING_PAYLOAD.transactionId).toBe(VALID_REQUEST.id)
    expect(SIGNING_PAYLOAD.payload).toBeInstanceOf(Uint8Array)
    expect(SIGNING_PAYLOAD.algorithm).toBe('secp256k1-keccak256')
    expect(SIGNING_PAYLOAD.accountIndex).toBe(0)
    expect(SIGNING_PAYLOAD.vm).toBe('evm')
    expect(SIGNING_PAYLOAD.chainId).toBe('ethereum-sepolia')
  })

  it('accepts ed25519 algorithm for SVM', () => {
    const svm: SigningPayload = {
      ...SIGNING_PAYLOAD,
      algorithm: 'ed25519',
      vm: 'svm',
    }
    expect(svm.algorithm).toBe('ed25519')
  })

  it('accepts all SigningAlgorithm values', () => {
    const algos: SigningAlgorithm[] = ['secp256k1-keccak256', 'ed25519']
    expect(algos).toHaveLength(2)
  })
})

// ─── SignedTransaction ──────────────────────────────────────────────────────

describe('SignedTransaction', () => {
  it('holds all required fields', () => {
    expect(SIGNED_TX.transactionId).toBe(VALID_REQUEST.id)
    expect(SIGNED_TX.signatureBytes).toBeInstanceOf(Uint8Array)
    expect(typeof SIGNED_TX.signatureHex).toBe('string')
    expect(SIGNED_TX.algorithm).toBe('secp256k1-keccak256')
    expect(typeof SIGNED_TX.signedAt).toBe('number')
  })

  it('signatureBytes is 64 bytes for secp256k1 and ed25519', () => {
    expect(SIGNED_TX.signatureBytes).toHaveLength(64)
  })

  it('signatureHex is 128 characters for 64-byte signature', () => {
    expect(SIGNED_TX.signatureHex).toHaveLength(128)
  })
})

// ─── Fee / FeeEstimate ──────────────────────────────────────────────────────

describe('Fee', () => {
  it('holds priority, maxFee, baseFee, priorityFee, estimatedSeconds', () => {
    expect(MOCK_FEE.priority).toBe('normal')
    expect(typeof MOCK_FEE.maxFee).toBe('bigint')
    expect(typeof MOCK_FEE.baseFee).toBe('bigint')
    expect(typeof MOCK_FEE.priorityFee).toBe('bigint')
    expect(typeof MOCK_FEE.estimatedSeconds).toBe('number')
  })

  it('maxFee equals baseFee + priorityFee', () => {
    expect(MOCK_FEE.maxFee).toBe(MOCK_FEE.baseFee + MOCK_FEE.priorityFee)
  })

  it('accepts all FeePriority values', () => {
    const priorities: FeePriority[] = ['slow', 'normal', 'fast']
    expect(priorities).toHaveLength(3)
  })
})

describe('FeeEstimate', () => {
  it('holds assetId, vm, chainId, slow, normal, fast, estimatedAt', () => {
    expect(MOCK_FEE_ESTIMATE.assetId).toBe('ethereum-sepolia:native:SEP')
    expect(MOCK_FEE_ESTIMATE.vm).toBe('evm')
    expect(MOCK_FEE_ESTIMATE.chainId).toBe('ethereum-sepolia')
    expect(typeof MOCK_FEE_ESTIMATE.estimatedAt).toBe('number')
  })

  it('slow, normal, fast are Fee objects with correct priorities', () => {
    expect(MOCK_FEE_ESTIMATE.slow.priority).toBe('slow')
    expect(MOCK_FEE_ESTIMATE.normal.priority).toBe('normal')
    expect(MOCK_FEE_ESTIMATE.fast.priority).toBe('fast')
  })

  it('fast.estimatedSeconds < normal.estimatedSeconds < slow.estimatedSeconds', () => {
    expect(MOCK_FEE_ESTIMATE.fast.estimatedSeconds).toBeLessThan(
      MOCK_FEE_ESTIMATE.normal.estimatedSeconds,
    )
    expect(MOCK_FEE_ESTIMATE.normal.estimatedSeconds).toBeLessThan(
      MOCK_FEE_ESTIMATE.slow.estimatedSeconds,
    )
  })
})

// ─── TransactionValidationResult ───────────────────────────────────────────

describe('TransactionValidationResult', () => {
  it('valid: true when errors is empty', () => {
    const result: TransactionValidationResult = { valid: true, errors: [] }
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('valid: false when errors is non-empty', () => {
    const error: TransactionValidationError = {
      field: 'amount',
      code: 'INVALID_AMOUNT',
      message: 'Amount must be > 0.',
    }
    const result: TransactionValidationResult = { valid: false, errors: [error] }
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].field).toBe('amount')
    expect(result.errors[0].code).toBe('INVALID_AMOUNT')
  })

  it('errors can reference all field types', () => {
    const fields = ['from', 'to', 'amount', 'asset', 'network', 'balance'] as const
    for (const field of fields) {
      const err: TransactionValidationError = {
        field,
        code: 'INVALID_AMOUNT',
        message: `Error on ${field}`,
      }
      expect(err.field).toBe(field)
    }
  })
})
