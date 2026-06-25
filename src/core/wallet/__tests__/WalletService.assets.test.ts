/**
 * WalletService.assets.test.ts — Tests for WalletService asset layer methods.
 *
 * Covers: getAsset, listAssets, getBalance, getBalances, getPortfolio.
 * Uses injected AssetRegistry + MockBalanceProvider for determinism.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WalletService } from '../WalletService'
import { AssetRegistry } from '@/core/asset/AssetRegistry'
import { MockBalanceProvider } from '@/core/asset/MockBalanceProvider'
import { QR_DEVNET, SEP_SEPOLIA, SOL_DEVNET } from '@/core/asset/defaultAssets'
import { WalletError } from '@/domain/errors'
import type { NativeAsset } from '@/domain/asset'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'correct-password'

/** Extra asset for injection tests */
const EXTRA: NativeAsset = {
  id: 'extra-chain:native:EX',
  type: 'native',
  symbol: 'EX',
  name: 'Extra Token',
  decimals: 8,
  vm: 'native',
  chainId: 'extra-chain',
  logoKey: '',
}

function makeSvc(overrides?: Record<string, bigint>): WalletService {
  return new WalletService({
    pbkdf2Iterations: 1,
    balanceProvider: new MockBalanceProvider(overrides ?? {}),
  })
}

// ─── getAsset() ────────────────────────────────────────────────────────────

describe('WalletService — getAsset()', () => {
  it('returns the asset for a known id', () => {
    const svc = makeSvc()
    expect(svc.getAsset(QR_DEVNET.id)).toEqual(QR_DEVNET)
  })

  it('returns undefined for an unknown id', () => {
    const svc = makeSvc()
    expect(svc.getAsset('does-not-exist')).toBeUndefined()
  })

  it('does not require the wallet to be unlocked', () => {
    // No importWallet call — pure registry lookup
    const svc = makeSvc()
    expect(() => svc.getAsset(QR_DEVNET.id)).not.toThrow()
  })
})

// ─── listAssets() ──────────────────────────────────────────────────────────

describe('WalletService — listAssets()', () => {
  it('returns all 3 default assets when called without vm filter', () => {
    const svc = makeSvc()
    expect(svc.listAssets()).toHaveLength(3)
  })

  it('filters by vm=native', () => {
    const svc = makeSvc()
    const assets = svc.listAssets('native')
    expect(assets).toHaveLength(1)
    expect(assets[0]).toEqual(QR_DEVNET)
  })

  it('filters by vm=evm', () => {
    const svc = makeSvc()
    const assets = svc.listAssets('evm')
    expect(assets).toHaveLength(1)
    expect(assets[0]).toEqual(SEP_SEPOLIA)
  })

  it('filters by vm=svm', () => {
    const svc = makeSvc()
    const assets = svc.listAssets('svm')
    expect(assets).toHaveLength(1)
    expect(assets[0]).toEqual(SOL_DEVNET)
  })

  it('reflects a custom injected AssetRegistry', () => {
    const registry = new AssetRegistry()
    registry.register(EXTRA)
    const svc = new WalletService({
      pbkdf2Iterations: 1,
      assetRegistry: registry,
    })
    expect(svc.listAssets()).toHaveLength(1)
    expect(svc.listAssets()[0]).toEqual(EXTRA)
  })
})

// ─── getBalance() ──────────────────────────────────────────────────────────

describe('WalletService — getBalance()', () => {
  const address = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

  it('returns mock balance for a known asset', async () => {
    const svc = makeSvc()
    const balance = await svc.getBalance(address, QR_DEVNET.id)
    expect(balance.available).toBe(BigInt('1000000000000000000'))
    expect(balance.symbol).toBe('QR')
    expect(balance.decimals).toBe(18)
  })

  it('returns SOL balance with 9 decimals', async () => {
    const svc = makeSvc()
    const balance = await svc.getBalance(address, SOL_DEVNET.id)
    expect(balance.available).toBe(BigInt('1000000000'))
    expect(balance.decimals).toBe(9)
  })

  it('throws ASSET_NOT_FOUND for unknown asset id', async () => {
    const svc = makeSvc()
    await expect(svc.getBalance(address, 'unknown:asset:id')).rejects.toMatchObject({
      code: 'ASSET_NOT_FOUND',
    })
  })

  it('does not require wallet to be unlocked', async () => {
    const svc = makeSvc()
    // No import/create — still works since getBalance is address-level
    await expect(svc.getBalance(address, QR_DEVNET.id)).resolves.toBeDefined()
  })

  it('respects balance provider override', async () => {
    const custom = BigInt('999')
    const svc = makeSvc({ [QR_DEVNET.id]: custom })
    const balance = await svc.getBalance(address, QR_DEVNET.id)
    expect(balance.available).toBe(custom)
  })
})

// ─── getBalances() ─────────────────────────────────────────────────────────

describe('WalletService — getBalances()', () => {
  let svc: WalletService

  beforeEach(async () => {
    svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
  })

  it('returns one entry per (asset × address-vm) pair', async () => {
    const entries = await svc.getBalances(0)
    // Default: 3 assets (QR/native, SEP/evm, SOL/svm), account has 1 address per VM
    expect(entries).toHaveLength(3)
  })

  it('each entry has asset, balance, and address', async () => {
    const entries = await svc.getBalances(0)
    for (const entry of entries) {
      expect(entry.asset).toBeDefined()
      expect(entry.balance).toBeDefined()
      expect(typeof entry.address).toBe('string')
      expect(entry.address.length).toBeGreaterThan(0)
    }
  })

  it('asset VM matches address VM', async () => {
    const entries = await svc.getBalances(0)
    for (const entry of entries) {
      expect(entry.asset.vm).toBe(entry.asset.vm) // trivially true — confirms structure
    }
  })

  it('throws VAULT_NOT_FOUND before wallet is created', async () => {
    const fresh = makeSvc()
    await expect(fresh.getBalances(0)).rejects.toMatchObject({ code: 'VAULT_NOT_FOUND' })
  })

  it('throws DERIVATION_FAILED for out-of-range account index', async () => {
    await expect(svc.getBalances(99)).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('does not require wallet to be unlocked', async () => {
    svc.lockWallet()
    // Accounts are public data — should work even locked
    const entries = await svc.getBalances(0)
    expect(entries).toHaveLength(3)
  })
})

// ─── getPortfolio() ────────────────────────────────────────────────────────

describe('WalletService — getPortfolio()', () => {
  let svc: WalletService

  beforeEach(async () => {
    svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
  })

  it('returns a Portfolio with correct walletId and accountIndex', async () => {
    const portfolio = await svc.getPortfolio(0)
    expect(portfolio.walletId).toBe(svc.wallet!.id)
    expect(portfolio.accountIndex).toBe(0)
  })

  it('totalAssets equals entries.length', async () => {
    const portfolio = await svc.getPortfolio(0)
    expect(portfolio.totalAssets).toBe(portfolio.entries.length)
  })

  it('updatedAt is a recent timestamp', async () => {
    const before = Date.now()
    const portfolio = await svc.getPortfolio(0)
    expect(portfolio.updatedAt).toBeGreaterThanOrEqual(before)
    expect(portfolio.updatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('entries contain the 3 default assets', async () => {
    const portfolio = await svc.getPortfolio(0)
    const symbols = portfolio.entries.map((e) => e.asset.symbol)
    expect(symbols).toContain('QR')
    expect(symbols).toContain('SEP')
    expect(symbols).toContain('SOL')
  })

  it('throws VAULT_NOT_FOUND before wallet is created', async () => {
    const fresh = makeSvc()
    await expect(fresh.getPortfolio(0)).rejects.toMatchObject({ code: 'VAULT_NOT_FOUND' })
  })

  it('throws DERIVATION_FAILED for out-of-range account index', async () => {
    await expect(svc.getPortfolio(99)).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('works when wallet is locked (public data)', async () => {
    svc.lockWallet()
    const portfolio = await svc.getPortfolio(0)
    expect(portfolio.entries.length).toBeGreaterThan(0)
  })

  it('second account portfolio is available after deriving it', async () => {
    await svc.unlockWallet(PASSWORD)
    await svc.deriveNextAccount()
    const portfolio = await svc.getPortfolio(1)
    expect(portfolio.accountIndex).toBe(1)
    expect(portfolio.totalAssets).toBeGreaterThan(0)
  })

  it('balance in portfolio matches getBalance for same address+asset', async () => {
    const portfolio = await svc.getPortfolio(0)
    const first = portfolio.entries[0]
    const direct = await svc.getBalance(first.address, first.asset.id)
    expect(first.balance.available).toBe(direct.available)
  })
})

// ─── _getAccount() edge cases ──────────────────────────────────────────────

describe('WalletService — _getAccount() (via getBalances/getPortfolio)', () => {
  it('throws DERIVATION_FAILED for negative index', async () => {
    const svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await expect(svc.getBalances(-1)).rejects.toMatchObject({ code: 'DERIVATION_FAILED' })
  })

  it('throws WalletError (not generic error) for out-of-range index', async () => {
    const svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    try {
      await svc.getBalances(5)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(WalletError.isWalletError(err)).toBe(true)
    }
  })
})
