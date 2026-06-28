/**
 * TransactionBuilder.test.ts — Unit tests for the fluent TransactionBuilder.
 *
 * Covers: builder immutability, all setters, build() validation,
 * generated id / createdAt, and branching builder patterns.
 */

import { describe, it, expect } from 'vitest'
import { TransactionBuilder } from '../TransactionBuilder'
import { WalletError } from '@/domain/errors'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const EVM_FROM = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
const EVM_TO = '0x1234567890123456789012345678901234567890'
const AMOUNT = BigInt('1000000000000000000')
const ASSET_ID = 'ethereum-sepolia:native:SEP'
const CHAIN_ID = 'ethereum-sepolia'

function evmBase(): TransactionBuilder {
  return TransactionBuilder.create()
    .vm('evm')
    .chain(CHAIN_ID)
    .asset(ASSET_ID)
    .from(EVM_FROM)
    .to(EVM_TO)
    .amount(AMOUNT)
}

// ─── create() ──────────────────────────────────────────────────────────────

describe('TransactionBuilder.create()', () => {
  it('returns a TransactionBuilder instance', () => {
    expect(TransactionBuilder.create()).toBeInstanceOf(TransactionBuilder)
  })

  it('initial type defaults to transfer in snapshot', () => {
    const snap = TransactionBuilder.create().snapshot()
    expect(snap.type).toBe('transfer')
  })

  it('initial optional fields are undefined in snapshot', () => {
    const snap = TransactionBuilder.create().snapshot()
    expect(snap.vm).toBeUndefined()
    expect(snap.chainId).toBeUndefined()
    expect(snap.assetId).toBeUndefined()
    expect(snap.from).toBeUndefined()
    expect(snap.to).toBeUndefined()
    expect(snap.amount).toBeUndefined()
    expect(snap.memo).toBeUndefined()
  })
})

// ─── Immutability ──────────────────────────────────────────────────────────

describe('Builder immutability', () => {
  it('each setter returns a new instance', () => {
    const base = TransactionBuilder.create()
    const withVm = base.vm('evm')
    expect(withVm).not.toBe(base)
  })

  it('original builder is unchanged after setter call', () => {
    const base = TransactionBuilder.create()
    base.vm('evm')
    expect(base.snapshot().vm).toBeUndefined()
  })

  it('branching builders produce independent state', () => {
    const base = evmBase()
    const tx1 = base.to(EVM_FROM).amount(BigInt(1)).build()
    const tx2 = base.to(EVM_TO).amount(BigInt(2)).build()
    expect(tx1.to).toBe(EVM_FROM)
    expect(tx2.to).toBe(EVM_TO)
    expect(tx1.amount).toBe(BigInt(1))
    expect(tx2.amount).toBe(BigInt(2))
  })

  it('snapshot() returns a copy — mutating it does not affect the builder', () => {
    const builder = TransactionBuilder.create().vm('evm')
    const snap = builder.snapshot() as { vm: string }
    snap.vm = 'svm'
    expect(builder.snapshot().vm).toBe('evm')
  })
})

// ─── Setters ───────────────────────────────────────────────────────────────

describe('Setters', () => {
  it('.type() sets transaction type', () => {
    expect(TransactionBuilder.create().type('contract_call').snapshot().type).toBe('contract_call')
  })

  it('.vm() sets vm', () => {
    expect(TransactionBuilder.create().vm('svm').snapshot().vm).toBe('svm')
  })

  it('.chain() sets chainId', () => {
    expect(TransactionBuilder.create().chain('solana-devnet').snapshot().chainId).toBe(
      'solana-devnet',
    )
  })

  it('.asset() sets assetId', () => {
    expect(TransactionBuilder.create().asset(ASSET_ID).snapshot().assetId).toBe(ASSET_ID)
  })

  it('.from() sets from address', () => {
    expect(TransactionBuilder.create().from(EVM_FROM).snapshot().from).toBe(EVM_FROM)
  })

  it('.to() sets to address', () => {
    expect(TransactionBuilder.create().to(EVM_TO).snapshot().to).toBe(EVM_TO)
  })

  it('.amount() sets amount', () => {
    expect(TransactionBuilder.create().amount(BigInt(42)).snapshot().amount).toBe(BigInt(42))
  })

  it('.memo() sets memo', () => {
    expect(TransactionBuilder.create().memo('test').snapshot().memo).toBe('test')
  })
})

// ─── build() success ───────────────────────────────────────────────────────

describe('build() — success', () => {
  it('returns a valid TransactionRequest with all required fields', () => {
    const req = evmBase().build()
    expect(req.type).toBe('transfer')
    expect(req.vm).toBe('evm')
    expect(req.chainId).toBe(CHAIN_ID)
    expect(req.assetId).toBe(ASSET_ID)
    expect(req.from).toBe(EVM_FROM)
    expect(req.to).toBe(EVM_TO)
    expect(req.amount).toBe(AMOUNT)
  })

  it('generates a UUID-format id', () => {
    const req = evmBase().build()
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('generates a recent createdAt timestamp', () => {
    const before = Date.now()
    const req = evmBase().build()
    const after = Date.now()
    expect(req.createdAt).toBeGreaterThanOrEqual(before)
    expect(req.createdAt).toBeLessThanOrEqual(after)
  })

  it('memo is included when set', () => {
    const req = evmBase().memo('hello').build()
    expect(req.memo).toBe('hello')
  })

  it('memo is absent when not set', () => {
    const req = evmBase().build()
    expect(req.memo).toBeUndefined()
  })

  it('two build() calls produce different ids', () => {
    const req1 = evmBase().build()
    const req2 = evmBase().build()
    expect(req1.id).not.toBe(req2.id)
  })

  it('type defaults to transfer when not overridden', () => {
    const req = evmBase().build()
    expect(req.type).toBe('transfer')
  })

  it('accepts contract_call type', () => {
    const req = evmBase().type('contract_call').build()
    expect(req.type).toBe('contract_call')
  })

  it('accepts contract_deploy type', () => {
    const req = evmBase().type('contract_deploy').build()
    expect(req.type).toBe('contract_deploy')
  })

  it('accepts native vm', () => {
    const nativeFrom = '0x' + 'ab'.repeat(20)
    const nativeTo = '0x' + 'cd'.repeat(20)
    const req = TransactionBuilder.create()
      .vm('native')
      .chain('qorechain-devnet')
      .asset('qorechain-devnet:native:QR')
      .from(nativeFrom)
      .to(nativeTo)
      .amount(BigInt(1))
      .build()
    expect(req.vm).toBe('native')
  })
})

// ─── build() validation failures ──────────────────────────────────────────

describe('build() — validation failures', () => {
  it('throws UNSUPPORTED_VM when vm is not set', () => {
    const builder = TransactionBuilder.create()
      .chain(CHAIN_ID)
      .asset(ASSET_ID)
      .from(EVM_FROM)
      .to(EVM_TO)
      .amount(AMOUNT)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_VM')
  })

  it('throws UNSUPPORTED_CHAIN when chainId is not set', () => {
    const builder = TransactionBuilder.create()
      .vm('evm')
      .asset(ASSET_ID)
      .from(EVM_FROM)
      .to(EVM_TO)
      .amount(AMOUNT)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })

  it('throws ASSET_NOT_FOUND when assetId is not set', () => {
    const builder = TransactionBuilder.create()
      .vm('evm')
      .chain(CHAIN_ID)
      .from(EVM_FROM)
      .to(EVM_TO)
      .amount(AMOUNT)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('ASSET_NOT_FOUND')
  })

  it('throws INVALID_ADDRESS when from is not set', () => {
    const builder = TransactionBuilder.create()
      .vm('evm')
      .chain(CHAIN_ID)
      .asset(ASSET_ID)
      .to(EVM_TO)
      .amount(AMOUNT)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_ADDRESS')
  })

  it('throws INVALID_ADDRESS when to is not set', () => {
    const builder = TransactionBuilder.create()
      .vm('evm')
      .chain(CHAIN_ID)
      .asset(ASSET_ID)
      .from(EVM_FROM)
      .amount(AMOUNT)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_ADDRESS')
  })

  it('throws INVALID_AMOUNT when amount is not set', () => {
    const builder = TransactionBuilder.create()
      .vm('evm')
      .chain(CHAIN_ID)
      .asset(ASSET_ID)
      .from(EVM_FROM)
      .to(EVM_TO)
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_AMOUNT')
  })

  it('throws INVALID_AMOUNT when amount is zero', () => {
    const builder = evmBase().amount(BigInt(0))
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_AMOUNT')
  })

  it('throws INVALID_AMOUNT when amount is negative', () => {
    const builder = evmBase().amount(BigInt(-1))
    let err: unknown
    try {
      builder.build()
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('INVALID_AMOUNT')
  })
})
