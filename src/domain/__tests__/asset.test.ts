/**
 * asset.test.ts — Unit tests for asset domain types and type guards.
 *
 * Tests: type guards, interface shape, and structural invariants.
 * No external dependencies — pure TypeScript type-level tests.
 */

import { describe, it, expect } from 'vitest'
import type {
  NativeAsset,
  TokenAsset,
  NFTAsset,
  Balance,
  Portfolio,
  PortfolioEntry,
} from '../asset'
import { isNativeAsset, isTokenAsset, isNFTAsset } from '../asset'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const NATIVE: NativeAsset = {
  id: 'qorechain-devnet:native:QR',
  type: 'native',
  symbol: 'QR',
  name: 'QoreChain Token',
  decimals: 18,
  vm: 'native',
  chainId: 'qorechain-devnet',
  logoKey: 'qorechain',
}

const TOKEN: TokenAsset = {
  id: 'ethereum-sepolia:token:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  type: 'token',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  logoKey: 'usdc',
}

const NFT: NFTAsset = {
  id: 'ethereum-sepolia:nft:0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D:1',
  type: 'nft',
  symbol: 'BAYC',
  name: 'Bored Ape Yacht Club',
  decimals: 0,
  vm: 'evm',
  chainId: 'ethereum-sepolia',
  contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
  tokenId: '1',
  logoKey: 'bayc',
}

// ─── isNativeAsset ─────────────────────────────────────────────────────────

describe('isNativeAsset()', () => {
  it('returns true for a NativeAsset', () => {
    expect(isNativeAsset(NATIVE)).toBe(true)
  })

  it('returns false for a TokenAsset', () => {
    expect(isNativeAsset(TOKEN)).toBe(false)
  })

  it('returns false for an NFTAsset', () => {
    expect(isNativeAsset(NFT)).toBe(false)
  })

  it('narrowed type has chainId', () => {
    if (isNativeAsset(NATIVE)) {
      expect(NATIVE.chainId).toBe('qorechain-devnet')
    }
  })
})

// ─── isTokenAsset ──────────────────────────────────────────────────────────

describe('isTokenAsset()', () => {
  it('returns true for a TokenAsset', () => {
    expect(isTokenAsset(TOKEN)).toBe(true)
  })

  it('returns false for a NativeAsset', () => {
    expect(isTokenAsset(NATIVE)).toBe(false)
  })

  it('returns false for an NFTAsset', () => {
    expect(isTokenAsset(NFT)).toBe(false)
  })

  it('narrowed type has contractAddress', () => {
    if (isTokenAsset(TOKEN)) {
      expect(TOKEN.contractAddress).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    }
  })
})

// ─── isNFTAsset ────────────────────────────────────────────────────────────

describe('isNFTAsset()', () => {
  it('returns true for an NFTAsset', () => {
    expect(isNFTAsset(NFT)).toBe(true)
  })

  it('returns false for a NativeAsset', () => {
    expect(isNFTAsset(NATIVE)).toBe(false)
  })

  it('returns false for a TokenAsset', () => {
    expect(isNFTAsset(TOKEN)).toBe(false)
  })

  it('narrowed type has tokenId', () => {
    if (isNFTAsset(NFT)) {
      expect(NFT.tokenId).toBe('1')
    }
  })
})

// ─── Balance shape ─────────────────────────────────────────────────────────

describe('Balance', () => {
  it('holds bigint amounts with decimals and symbol', () => {
    const balance: Balance = {
      available: BigInt('1000000000000000000'),
      pending: BigInt(0),
      locked: BigInt(0),
      decimals: 18,
      symbol: 'QR',
    }
    expect(balance.available).toBe(BigInt('1000000000000000000'))
    expect(balance.pending).toBe(BigInt(0))
    expect(balance.locked).toBe(BigInt(0))
    expect(balance.decimals).toBe(18)
    expect(balance.symbol).toBe('QR')
  })
})

// ─── Portfolio shape ────────────────────────────────────────────────────────

describe('Portfolio', () => {
  it('holds entries, totalAssets, and updatedAt', () => {
    const entry: PortfolioEntry = {
      asset: NATIVE,
      balance: {
        available: BigInt('1000000000000000000'),
        pending: BigInt(0),
        locked: BigInt(0),
        decimals: 18,
        symbol: 'QR',
      },
      address: '0x1234567890123456789012345678901234567890',
    }
    const portfolio: Portfolio = {
      walletId: 'wallet-1',
      accountIndex: 0,
      entries: [entry],
      totalAssets: 1,
      updatedAt: Date.now(),
    }
    expect(portfolio.entries).toHaveLength(1)
    expect(portfolio.totalAssets).toBe(1)
    expect(portfolio.entries[0].asset.symbol).toBe('QR')
  })
})
