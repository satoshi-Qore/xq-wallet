/**
 * AssetRegistry.test.ts — Unit tests for AssetRegistry.
 *
 * Tests: register, unregister, getById, getBySymbol, getByChain, getByVM, list, size.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AssetRegistry } from '../AssetRegistry'
import { WalletError } from '@/domain/errors'
import type { NativeAsset, TokenAsset, NFTAsset } from '@/domain/asset'

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

const USDC: TokenAsset = {
  id: 'ethereum-sepolia:token:0xUSDC',
  type: 'token',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  contractAddress: '0xUSDC',
  logoKey: 'usdc',
}

const BAYC: NFTAsset = {
  id: 'ethereum-sepolia:nft:0xBAYC:1',
  type: 'nft',
  symbol: 'BAYC',
  name: 'Bored Ape Yacht Club',
  decimals: 0,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  contractAddress: '0xBAYC',
  tokenId: '1',
  logoKey: 'bayc',
}

// ─── register / size ───────────────────────────────────────────────────────

describe('AssetRegistry — register()', () => {
  let registry: AssetRegistry

  beforeEach(() => {
    registry = new AssetRegistry()
  })

  it('starts empty', () => {
    expect(registry.size).toBe(0)
    expect(registry.list()).toHaveLength(0)
  })

  it('registers an asset and increments size', () => {
    registry.register(QR)
    expect(registry.size).toBe(1)
  })

  it('registers multiple assets', () => {
    registry.register(QR)
    registry.register(SEP)
    registry.register(SOL)
    expect(registry.size).toBe(3)
  })

  it('throws ASSET_ALREADY_REGISTERED for duplicate id', () => {
    registry.register(QR)
    let err: unknown
    try {
      registry.register(QR)
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('ASSET_ALREADY_REGISTERED')
    }
  })
})

// ─── unregister ────────────────────────────────────────────────────────────

describe('AssetRegistry — unregister()', () => {
  it('removes a registered asset', () => {
    const registry = new AssetRegistry()
    registry.register(QR)
    registry.unregister(QR.id)
    expect(registry.size).toBe(0)
    expect(registry.getById(QR.id)).toBeUndefined()
  })

  it('throws ASSET_NOT_FOUND for unknown id', () => {
    const registry = new AssetRegistry()
    let err: unknown
    try {
      registry.unregister('nonexistent')
    } catch (e) {
      err = e
    }
    expect(WalletError.isWalletError(err)).toBe(true)
    if (WalletError.isWalletError(err)) {
      expect(err.code).toBe('ASSET_NOT_FOUND')
    }
  })

  it('allows re-registration after unregister', () => {
    const registry = new AssetRegistry()
    registry.register(QR)
    registry.unregister(QR.id)
    registry.register(QR)
    expect(registry.size).toBe(1)
  })
})

// ─── getById ───────────────────────────────────────────────────────────────

describe('AssetRegistry — getById()', () => {
  it('returns the registered asset', () => {
    const registry = new AssetRegistry()
    registry.register(QR)
    expect(registry.getById(QR.id)).toEqual(QR)
  })

  it('returns undefined for unknown id', () => {
    const registry = new AssetRegistry()
    expect(registry.getById('unknown')).toBeUndefined()
  })
})

// ─── getBySymbol ───────────────────────────────────────────────────────────

describe('AssetRegistry — getBySymbol()', () => {
  let registry: AssetRegistry

  beforeEach(() => {
    registry = new AssetRegistry()
    registry.register(QR)
    registry.register(SEP)
    registry.register(USDC)
  })

  it('finds by exact symbol', () => {
    expect(registry.getBySymbol('QR')).toEqual(QR)
  })

  it('finds by lowercase symbol (case-insensitive)', () => {
    expect(registry.getBySymbol('sep')).toEqual(SEP)
  })

  it('finds by mixed-case symbol', () => {
    expect(registry.getBySymbol('UsDb')).toBeUndefined() // typo — won't match
    expect(registry.getBySymbol('Usdc')).toEqual(USDC)
  })

  it('returns undefined for unknown symbol', () => {
    expect(registry.getBySymbol('XYZ')).toBeUndefined()
  })
})

// ─── getByChain ────────────────────────────────────────────────────────────

describe('AssetRegistry — getByChain()', () => {
  let registry: AssetRegistry

  beforeEach(() => {
    registry = new AssetRegistry()
    registry.register(QR)
    registry.register(SEP)
    registry.register(SOL)
    registry.register(USDC)
    registry.register(BAYC)
  })

  it('returns all assets on a chain', () => {
    const assets = registry.getByChain('ethereum-sepolia')
    expect(assets).toHaveLength(3) // SEP, USDC, BAYC
    const ids = assets.map((a) => a.id)
    expect(ids).toContain(SEP.id)
    expect(ids).toContain(USDC.id)
    expect(ids).toContain(BAYC.id)
  })

  it('returns an empty array for an unknown chain', () => {
    expect(registry.getByChain('unknown-chain')).toHaveLength(0)
  })

  it('returns single asset for qorechain-devnet', () => {
    expect(registry.getByChain('qorechain-devnet')).toHaveLength(1)
    expect(registry.getByChain('qorechain-devnet')[0]).toEqual(QR)
  })
})

// ─── getByVM ───────────────────────────────────────────────────────────────

describe('AssetRegistry — getByVM()', () => {
  let registry: AssetRegistry

  beforeEach(() => {
    registry = new AssetRegistry()
    registry.register(QR)
    registry.register(SEP)
    registry.register(SOL)
    registry.register(USDC)
    registry.register(BAYC)
  })

  it('returns all EVM assets', () => {
    const assets = registry.getByVM('evm')
    expect(assets).toHaveLength(3) // SEP, USDC, BAYC
  })

  it('returns all SVM assets', () => {
    expect(registry.getByVM('svm')).toHaveLength(1)
    expect(registry.getByVM('svm')[0]).toEqual(SOL)
  })

  it('returns all native assets', () => {
    expect(registry.getByVM('native')).toHaveLength(1)
    expect(registry.getByVM('native')[0]).toEqual(QR)
  })

  it('returns empty array for VM with no assets', () => {
    const empty = new AssetRegistry()
    expect(empty.getByVM('evm')).toHaveLength(0)
  })
})

// ─── list ──────────────────────────────────────────────────────────────────

describe('AssetRegistry — list()', () => {
  it('returns assets in insertion order', () => {
    const registry = new AssetRegistry()
    registry.register(QR)
    registry.register(SEP)
    registry.register(SOL)
    const listed = registry.list()
    expect(listed[0]).toEqual(QR)
    expect(listed[1]).toEqual(SEP)
    expect(listed[2]).toEqual(SOL)
  })

  it('returns a fresh copy — mutations do not affect the registry', () => {
    const registry = new AssetRegistry()
    registry.register(QR)
    const list = registry.list()
    list.pop()
    expect(registry.size).toBe(1)
  })
})
