/**
 * rpc.test.ts — Structural tests for RPC domain types.
 *
 * Verifies that the type shapes, literals, and type guard expectations
 * defined in domain/rpc.ts remain stable. These are compile-time + runtime
 * shape tests — no network I/O is performed.
 */

import { describe, it, expect } from 'vitest'
import type {
  RpcBlock,
  RpcTransaction,
  RpcTransactionStatus,
  RpcEndpointStatus,
  RpcHealthReport,
  RpcFeeData,
  RetryConfig,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from '../rpc'

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const BLOCK: RpcBlock = {
  hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  number: BigInt(1_000_000),
  parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  timestamp: 1_700_000_000,
  transactionCount: 42,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
}

const TX: RpcTransaction = {
  hash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: BigInt('1000000000000000000'),
  data: '0x',
  blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  blockNumber: BigInt(1_000_000),
  transactionIndex: 3,
  status: 'confirmed',
  vm: 'evm',
  chainId: 'ethereum-sepolia',
}

const HEALTH: RpcHealthReport = {
  endpoint: 'https://sepolia.infura.io/v3/key',
  status: 'available',
  latencyMs: 42,
  lastCheckedAt: Date.now(),
  lastSuccessAt: Date.now() - 1000,
  errorMessage: null,
}

const FEE_DATA: RpcFeeData = {
  baseFeePerGas: BigInt(10_000_000_000),
  maxPriorityFeePerGas: BigInt(1_500_000_000),
  gasPrice: BigInt(11_500_000_000),
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  estimatedAt: Date.now(),
}

const RETRY_CFG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  timeoutMs: 30_000,
}

const CB_CFG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
  halfOpenMaxCalls: 1,
}

// ─── RpcBlock ─────────────────────────────────────────────────────────────────

describe('RpcBlock', () => {
  it('holds all required fields', () => {
    expect(BLOCK.hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab')
    expect(BLOCK.number).toBe(BigInt(1_000_000))
    expect(BLOCK.transactionCount).toBe(42)
    expect(BLOCK.vm).toBe('evm')
    expect(BLOCK.chainId).toBe('ethereum-sepolia')
  })

  it('uses bigint for block number', () => {
    expect(typeof BLOCK.number).toBe('bigint')
  })

  it('timestamp is a unix seconds integer', () => {
    expect(Number.isInteger(BLOCK.timestamp)).toBe(true)
    expect(BLOCK.timestamp).toBeGreaterThan(1_600_000_000)
  })
})

// ─── RpcTransaction ───────────────────────────────────────────────────────────

describe('RpcTransaction', () => {
  it('holds all required fields', () => {
    expect(TX.hash).toBeTruthy()
    expect(TX.from).toBeTruthy()
    expect(TX.to).toBeTruthy()
    expect(TX.status).toBe('confirmed')
    expect(TX.vm).toBe('evm')
  })

  it('uses bigint for value', () => {
    expect(typeof TX.value).toBe('bigint')
  })

  it('blockNumber is bigint when confirmed', () => {
    expect(typeof TX.blockNumber).toBe('bigint')
  })

  it('to field is null for contract deployments', () => {
    const deploy: RpcTransaction = { ...TX, to: null }
    expect(deploy.to).toBeNull()
  })

  it('blockHash and blockNumber are null when pending', () => {
    const pending: RpcTransaction = {
      ...TX,
      status: 'pending',
      blockHash: null,
      blockNumber: null,
      transactionIndex: null,
    }
    expect(pending.blockHash).toBeNull()
    expect(pending.blockNumber).toBeNull()
    expect(pending.transactionIndex).toBeNull()
  })

  it('accepts all RpcTransactionStatus values', () => {
    const statuses: RpcTransactionStatus[] = ['pending', 'confirmed', 'failed']
    for (const status of statuses) {
      const tx: RpcTransaction = { ...TX, status }
      expect(tx.status).toBe(status)
    }
  })
})

// ─── RpcHealthReport ──────────────────────────────────────────────────────────

describe('RpcHealthReport', () => {
  it('holds all required fields when available', () => {
    expect(HEALTH.endpoint).toBeTruthy()
    expect(HEALTH.status).toBe('available')
    expect(HEALTH.latencyMs).toBeGreaterThan(0)
    expect(HEALTH.errorMessage).toBeNull()
    expect(HEALTH.lastSuccessAt).not.toBeNull()
  })

  it('accepts all RpcEndpointStatus values', () => {
    const statuses: RpcEndpointStatus[] = ['available', 'unavailable', 'degraded', 'unknown']
    for (const status of statuses) {
      const report: RpcHealthReport = { ...HEALTH, status }
      expect(report.status).toBe(status)
    }
  })

  it('allows null latency when unavailable', () => {
    const report: RpcHealthReport = {
      endpoint: '',
      status: 'unavailable',
      latencyMs: null,
      lastCheckedAt: Date.now(),
      lastSuccessAt: null,
      errorMessage: 'Connection refused',
    }
    expect(report.latencyMs).toBeNull()
    expect(report.lastSuccessAt).toBeNull()
    expect(report.errorMessage).toBeTruthy()
  })
})

// ─── RpcFeeData ───────────────────────────────────────────────────────────────

describe('RpcFeeData', () => {
  it('has EIP-1559 fields for EVM', () => {
    expect(FEE_DATA.baseFeePerGas).not.toBeNull()
    expect(FEE_DATA.maxPriorityFeePerGas).not.toBeNull()
    expect(typeof FEE_DATA.gasPrice).toBe('bigint')
  })

  it('allows null EIP-1559 fields for SVM', () => {
    const svmFee: RpcFeeData = {
      baseFeePerGas: null,
      maxPriorityFeePerGas: null,
      gasPrice: BigInt(5000),
      vm: 'svm',
      chainId: 'solana-devnet',
      estimatedAt: Date.now(),
    }
    expect(svmFee.baseFeePerGas).toBeNull()
    expect(svmFee.maxPriorityFeePerGas).toBeNull()
    expect(typeof svmFee.gasPrice).toBe('bigint')
  })
})

// ─── RetryConfig ──────────────────────────────────────────────────────────────

describe('RetryConfig', () => {
  it('all fields are numbers', () => {
    expect(typeof RETRY_CFG.maxAttempts).toBe('number')
    expect(typeof RETRY_CFG.initialDelayMs).toBe('number')
    expect(typeof RETRY_CFG.maxDelayMs).toBe('number')
    expect(typeof RETRY_CFG.backoffMultiplier).toBe('number')
    expect(typeof RETRY_CFG.timeoutMs).toBe('number')
  })

  it('maxDelayMs >= initialDelayMs by convention', () => {
    expect(RETRY_CFG.maxDelayMs).toBeGreaterThanOrEqual(RETRY_CFG.initialDelayMs)
  })
})

// ─── CircuitBreakerConfig + State ─────────────────────────────────────────────

describe('CircuitBreakerConfig', () => {
  it('holds all required fields', () => {
    expect(typeof CB_CFG.failureThreshold).toBe('number')
    expect(typeof CB_CFG.recoveryTimeMs).toBe('number')
    expect(typeof CB_CFG.halfOpenMaxCalls).toBe('number')
  })
})

describe('CircuitBreakerState', () => {
  it('accepts all three states', () => {
    const states: CircuitBreakerState[] = ['closed', 'open', 'half-open']
    expect(states).toHaveLength(3)
    expect(states).toContain('closed')
    expect(states).toContain('open')
    expect(states).toContain('half-open')
  })
})
