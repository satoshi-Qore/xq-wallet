/**
 * WalletService.rpc.test.ts
 *
 * Tests the five RPC methods added to WalletService in Day 10:
 *   getLatestBlock, submitTransaction, getTransaction, fetchBalance, healthCheck
 *
 * Sprint 2: all network methods route through NullRpcProvider (the default)
 * and throw WalletError('RPC_NOT_CONNECTED'). healthCheck returns an
 * unavailable report.
 *
 * Tests also cover:
 *   - Custom RpcProviderRegistry injection via WalletServiceOptions.
 *   - _getProvider throws UNSUPPORTED_CHAIN for unregistered chainIds.
 *   - fetchBalance resolves asset from the AssetRegistry before delegating.
 */

import { describe, it, expect } from 'vitest'
import { WalletService } from '../WalletService'
import { WalletError } from '@/domain/errors'
import { RpcProviderRegistry } from '@/core/rpc/RpcProviderRegistry'
import { NullRpcProvider } from '@/core/rpc/NullRpcProvider'

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── getLatestBlock ───────────────────────────────────────────────────────────

describe('WalletService.getLatestBlock', () => {
  it('throws RPC_NOT_CONNECTED with NullRpcProvider (default)', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.getLatestBlock('ethereum-sepolia')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('throws UNSUPPORTED_CHAIN for unregistered chainId', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.getLatestBlock('unknown-chain')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('throws RPC_NOT_CONNECTED for all three default chains', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const chains = ['ethereum-sepolia', 'solana-devnet', 'qorechain-devnet']
    for (const chainId of chains) {
      let err: unknown
      try {
        await svc.getLatestBlock(chainId)
      } catch (e) {
        err = e
      }
      expect(WalletError.isWalletError(err)).toBe(true)
      if (WalletError.isWalletError(err)) expect(err.code).toBe('RPC_NOT_CONNECTED')
    }
  })
})

// ─── submitTransaction ────────────────────────────────────────────────────────

describe('WalletService.submitTransaction', () => {
  it('throws RPC_NOT_CONNECTED with NullRpcProvider', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const rawTx = new Uint8Array([0xf8, 0x6a, 0x01])
    let err: unknown
    try {
      await svc.submitTransaction(rawTx, 'ethereum-sepolia')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('throws UNSUPPORTED_CHAIN for unknown chain', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.submitTransaction(new Uint8Array([1]), 'not-a-chain')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })
})

// ─── getTransaction ───────────────────────────────────────────────────────────

describe('WalletService.getTransaction', () => {
  it('throws RPC_NOT_CONNECTED with NullRpcProvider', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.getTransaction('0xdeadbeef', 'ethereum-sepolia')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('RPC_NOT_CONNECTED')
    }
  })

  it('throws UNSUPPORTED_CHAIN for unknown chain', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.getTransaction('0xhash', 'unknown')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })
})

// ─── fetchBalance ─────────────────────────────────────────────────────────────

describe('WalletService.fetchBalance', () => {
  it('throws ASSET_NOT_FOUND for unknown assetId', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.fetchBalance('0xAddr', 'ethereum-sepolia', 'nonexistent:asset:id')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('ASSET_NOT_FOUND')
  })

  it('throws RPC_NOT_CONNECTED when asset exists but chain is NullRpcProvider', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.fetchBalance(
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        'ethereum-sepolia',
        'ethereum-sepolia:native:SEP',
      )
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('RPC_NOT_CONNECTED')
  })

  it('throws UNSUPPORTED_CHAIN when provider is missing', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      // SEP asset exists but no provider for "missing-chain"
      await svc.fetchBalance('0xAddr', 'missing-chain', 'ethereum-sepolia:native:SEP')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })
})

// ─── healthCheck ──────────────────────────────────────────────────────────────

describe('WalletService.healthCheck', () => {
  it('returns unavailable report for ethereum-sepolia', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const report = await svc.healthCheck('ethereum-sepolia')
    expect(report.status).toBe('unavailable')
    expect(report.latencyMs).toBeNull()
    expect(report.errorMessage).toContain('ethereum-sepolia')
  })

  it('returns unavailable report for solana-devnet', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const report = await svc.healthCheck('solana-devnet')
    expect(report.status).toBe('unavailable')
  })

  it('returns unavailable report for qorechain-devnet', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const report = await svc.healthCheck('qorechain-devnet')
    expect(report.status).toBe('unavailable')
  })

  it('throws UNSUPPORTED_CHAIN for unregistered chainId', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    let err: unknown
    try {
      await svc.healthCheck('not-registered')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })

  it('sets lastCheckedAt within current execution', async () => {
    const svc = new WalletService({ pbkdf2Iterations: 1 })
    const before = Date.now()
    const report = await svc.healthCheck('ethereum-sepolia')
    const after = Date.now()
    expect(report.lastCheckedAt).toBeGreaterThanOrEqual(before)
    expect(report.lastCheckedAt).toBeLessThanOrEqual(after)
  })
})

// ─── Custom RpcProviderRegistry injection ────────────────────────────────────

describe('WalletService — custom rpcRegistry injection', () => {
  it('uses the injected registry instead of the default', async () => {
    const registry = new RpcProviderRegistry()
    registry.register(new NullRpcProvider('evm', 'my-custom-chain'))

    const svc = new WalletService({ pbkdf2Iterations: 1, rpcRegistry: registry })

    // Custom chain works (NullRpcProvider → throws RPC_NOT_CONNECTED, not UNSUPPORTED_CHAIN)
    let err: unknown
    try {
      await svc.getLatestBlock('my-custom-chain')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('RPC_NOT_CONNECTED')
  })

  it('throws UNSUPPORTED_CHAIN for chains not in the injected registry', async () => {
    const registry = new RpcProviderRegistry()
    // Only register custom chain — default chains are NOT present
    registry.register(new NullRpcProvider('evm', 'my-chain'))

    const svc = new WalletService({ pbkdf2Iterations: 1, rpcRegistry: registry })

    let err: unknown
    try {
      await svc.getLatestBlock('ethereum-sepolia') // not in this registry
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) expect(err.code).toBe('UNSUPPORTED_CHAIN')
  })
})
