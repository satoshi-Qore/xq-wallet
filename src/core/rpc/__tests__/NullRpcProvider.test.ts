/**
 * NullRpcProvider.test.ts
 *
 * Verifies that NullRpcProvider:
 *   - Throws WalletError('RPC_NOT_CONNECTED') for all network operations.
 *   - Returns a well-formed unavailable RpcHealthReport for healthCheck().
 *   - Preserves vm and chainId constructor arguments.
 *   - Works for all three supported VM types.
 */

import { describe, it, expect } from 'vitest'
import { NullRpcProvider } from '../NullRpcProvider'
import { WalletError } from '@/domain/errors'

// ─── Helper ──────────────────────────────────────────────────────────────────

async function expectRpcNotConnected(fn: () => Promise<unknown>, chainId: string): Promise<void> {
  let err: unknown
  try {
    await fn()
  } catch (e) {
    err = e
  }
  expect(WalletError.isWalletError(err)).toBe(true)
  if (WalletError.isWalletError(err)) {
    expect(err.code).toBe('RPC_NOT_CONNECTED')
    expect(err.message).toContain(chainId)
  }
}

// ─── EVM provider ─────────────────────────────────────────────────────────────

describe('NullRpcProvider — evm', () => {
  const provider = new NullRpcProvider('evm', 'ethereum-sepolia')

  it('exposes vm and chainId', () => {
    expect(provider.vm).toBe('evm')
    expect(provider.chainId).toBe('ethereum-sepolia')
  })

  it('getBlock throws RPC_NOT_CONNECTED', async () => {
    await expectRpcNotConnected(() => provider.getBlock(BigInt(1)), 'ethereum-sepolia')
  })

  it('getLatestBlock throws RPC_NOT_CONNECTED', async () => {
    await expectRpcNotConnected(() => provider.getLatestBlock(), 'ethereum-sepolia')
  })

  it('getBalance throws RPC_NOT_CONNECTED', async () => {
    const asset = {
      id: 'ethereum-sepolia:native:SEP',
      type: 'native' as const,
      symbol: 'SEP',
      name: 'Sepolia Ether',
      decimals: 18,
      vm: 'evm' as const,
      logoKey: '',
      chainId: 'ethereum-sepolia',
    }
    await expectRpcNotConnected(() => provider.getBalance('0xAddress', asset), 'ethereum-sepolia')
  })

  it('getTransaction throws RPC_NOT_CONNECTED', async () => {
    await expectRpcNotConnected(() => provider.getTransaction('0xhash'), 'ethereum-sepolia')
  })

  it('sendTransaction throws RPC_NOT_CONNECTED', async () => {
    await expectRpcNotConnected(
      () => provider.sendTransaction(new Uint8Array([1, 2, 3])),
      'ethereum-sepolia',
    )
  })

  it('estimateFee throws RPC_NOT_CONNECTED', async () => {
    const req = {
      id: 'tx-1',
      type: 'transfer' as const,
      vm: 'evm' as const,
      chainId: 'ethereum-sepolia',
      assetId: 'ethereum-sepolia:native:SEP',
      from: '0xFrom',
      to: '0xTo',
      amount: BigInt(1),
      createdAt: Date.now(),
    }
    await expectRpcNotConnected(() => provider.estimateFee(req), 'ethereum-sepolia')
  })

  it('getChainId throws RPC_NOT_CONNECTED', async () => {
    await expectRpcNotConnected(() => provider.getChainId(), 'ethereum-sepolia')
  })
})

// ─── healthCheck returns report (never throws) ────────────────────────────────

describe('NullRpcProvider — healthCheck', () => {
  it('returns unavailable report for evm chain', async () => {
    const provider = new NullRpcProvider('evm', 'ethereum-sepolia')
    const report = await provider.healthCheck()
    expect(report.status).toBe('unavailable')
    expect(report.latencyMs).toBeNull()
    expect(report.lastSuccessAt).toBeNull()
    expect(report.errorMessage).toContain('ethereum-sepolia')
    expect(report.lastCheckedAt).toBeGreaterThan(0)
  })

  it('returns unavailable report for svm chain', async () => {
    const provider = new NullRpcProvider('svm', 'solana-devnet')
    const report = await provider.healthCheck()
    expect(report.status).toBe('unavailable')
    expect(report.errorMessage).toContain('solana-devnet')
  })

  it('returns unavailable report for native chain', async () => {
    const provider = new NullRpcProvider('native', 'qorechain-devnet')
    const report = await provider.healthCheck()
    expect(report.status).toBe('unavailable')
    expect(report.errorMessage).toContain('qorechain-devnet')
  })

  it('sets lastCheckedAt to a recent unix timestamp (ms)', async () => {
    const before = Date.now()
    const provider = new NullRpcProvider('evm', 'ethereum-sepolia')
    const report = await provider.healthCheck()
    const after = Date.now()
    expect(report.lastCheckedAt).toBeGreaterThanOrEqual(before)
    expect(report.lastCheckedAt).toBeLessThanOrEqual(after)
  })

  it('endpoint is empty string (no real endpoint)', async () => {
    const provider = new NullRpcProvider('evm', 'ethereum-sepolia')
    const report = await provider.healthCheck()
    expect(report.endpoint).toBe('')
  })
})

// ─── Multiple chains ──────────────────────────────────────────────────────────

describe('NullRpcProvider — all supported VMs', () => {
  const providers = [
    new NullRpcProvider('evm', 'ethereum-sepolia'),
    new NullRpcProvider('svm', 'solana-devnet'),
    new NullRpcProvider('native', 'qorechain-devnet'),
  ]

  for (const provider of providers) {
    it(`${provider.vm}:${provider.chainId} — getLatestBlock throws RPC_NOT_CONNECTED`, async () => {
      await expectRpcNotConnected(() => provider.getLatestBlock(), provider.chainId)
    })

    it(`${provider.vm}:${provider.chainId} — healthCheck returns unavailable`, async () => {
      const report = await provider.healthCheck()
      expect(report.status).toBe('unavailable')
      expect(report.endpoint).toBe('')
      expect(report.latencyMs).toBeNull()
      expect(report.lastSuccessAt).toBeNull()
      expect(typeof report.errorMessage).toBe('string')
    })
  }
})
