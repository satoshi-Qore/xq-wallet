/**
 * ChainRegistry.test.ts — Tests for the chain registry.
 *
 * Tests cover: register, duplicate rejection, unregister, get, getAll,
 * getDefault, exists, size, ordering, and immutability.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ChainRegistry } from '../ChainRegistry'
import { WalletError } from '@/domain/errors'
import { qorechainDevnet, ethereumSepolia, solanaDevnet } from '../definitions'
import type { ChainDefinition } from '@/domain/chain'

// ─── Test fixtures ─────────────────────────────────────────────────────────

const makeChain = (id: string, vm: ChainDefinition['vm'] = 'evm'): ChainDefinition => ({
  id,
  name: `Chain ${id}`,
  shortName: id.toUpperCase(),
  vm,
  chainId: vm === 'evm' ? 1 : null,
  rpcUrls: [`https://rpc.${id}.example.com`],
  explorerUrl: `https://explorer.${id}.example.com`,
  explorerTxPath: '/tx/{hash}',
  explorerAddressPath: '/address/{address}',
  nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
  testnet: true,
  enabled: true,
  logoKey: id,
})

const chainA = makeChain('chain-a')
const chainB = makeChain('chain-b', 'svm')
const chainC = makeChain('chain-c', 'native')

// ─── register() ────────────────────────────────────────────────────────────

describe('ChainRegistry — register()', () => {
  it('rejects mainnet chains in a development release', () => {
    const reg = new ChainRegistry()
    const mainnet = { ...chainA, id: 'mainnet', testnet: false }

    expect(() => reg.register(mainnet)).toThrow(
      expect.objectContaining({ code: 'RELEASE_CAPABILITY_DISABLED' }),
    )
    expect(reg.size).toBe(0)
  })

  it('registers a valid chain definition without throwing', () => {
    const reg = new ChainRegistry()
    expect(() => reg.register(chainA)).not.toThrow()
  })

  it('size is 1 after registering one chain', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    expect(reg.size).toBe(1)
  })

  it('throws CHAIN_ALREADY_REGISTERED when the same id is registered twice', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    expect(() => reg.register(chainA)).toThrow(WalletError)
  })

  it('CHAIN_ALREADY_REGISTERED error has the correct code', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    try {
      reg.register(chainA)
      expect.fail('should have thrown')
    } catch (err) {
      expect(WalletError.isWalletError(err)).toBe(true)
      expect((err as WalletError).code).toBe('CHAIN_ALREADY_REGISTERED')
    }
  })

  it('error message identifies the duplicate chain id', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    try {
      reg.register(chainA)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).message).toContain('chain-a')
    }
  })

  it('allows re-registration after unregister (no duplicate error)', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.unregister('chain-a')
    expect(() => reg.register(chainA)).not.toThrow()
  })

  it('two different chains can both be registered', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    expect(reg.size).toBe(2)
  })
})

// ─── unregister() ──────────────────────────────────────────────────────────

describe('ChainRegistry — unregister()', () => {
  let reg: ChainRegistry

  beforeEach(() => {
    reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
  })

  it('removes the chain from the registry', () => {
    reg.unregister('chain-a')
    expect(reg.exists('chain-a')).toBe(false)
  })

  it('size decrements after unregister', () => {
    reg.unregister('chain-a')
    expect(reg.size).toBe(1)
  })

  it('throws UNSUPPORTED_CHAIN when chain is not registered', () => {
    expect(() => reg.unregister('does-not-exist')).toThrow(WalletError)
  })

  it('UNSUPPORTED_CHAIN error has correct code', () => {
    try {
      reg.unregister('does-not-exist')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('get() throws after unregister', () => {
    reg.unregister('chain-a')
    expect(() => reg.get('chain-a')).toThrow(WalletError)
  })

  it('remaining chains are still accessible after unregister', () => {
    reg.unregister('chain-a')
    expect(reg.get('chain-b')).toBe(chainB)
  })
})

// ─── get() ─────────────────────────────────────────────────────────────────

describe('ChainRegistry — get()', () => {
  let reg: ChainRegistry

  beforeEach(() => {
    reg = new ChainRegistry()
    reg.register(chainA)
  })

  it('returns the registered chain definition', () => {
    expect(reg.get('chain-a')).toBe(chainA)
  })

  it('returns the exact same object reference (identity)', () => {
    const result = reg.get('chain-a')
    expect(result).toBe(chainA)
  })

  it('throws UNSUPPORTED_CHAIN for an unknown id', () => {
    expect(() => reg.get('unknown')).toThrow(WalletError)
  })

  it('UNSUPPORTED_CHAIN error has correct code', () => {
    try {
      reg.get('unknown')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('error message identifies the missing chain id', () => {
    try {
      reg.get('missing-chain')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).message).toContain('missing-chain')
    }
  })
})

// ─── getAll() ──────────────────────────────────────────────────────────────

describe('ChainRegistry — getAll()', () => {
  it('returns an empty array when nothing is registered', () => {
    const reg = new ChainRegistry()
    expect(reg.getAll()).toHaveLength(0)
  })

  it('returns all registered chains', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    reg.register(chainC)
    expect(reg.getAll()).toHaveLength(3)
  })

  it('preserves registration order', () => {
    const reg = new ChainRegistry()
    reg.register(chainC)
    reg.register(chainA)
    reg.register(chainB)
    const all = reg.getAll()
    expect(all[0].id).toBe('chain-c')
    expect(all[1].id).toBe('chain-a')
    expect(all[2].id).toBe('chain-b')
  })

  it('returned array is frozen (immutable)', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    const all = reg.getAll()
    expect(Object.isFrozen(all)).toBe(true)
  })

  it('pushing to the returned array does not affect the registry', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    const all = reg.getAll() as ChainDefinition[]
    expect(() => all.push(chainB)).toThrow()
    expect(reg.size).toBe(1)
  })

  it('reflects state after unregister', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    reg.unregister('chain-a')
    const all = reg.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('chain-b')
  })
})

// ─── getDefault() ──────────────────────────────────────────────────────────

describe('ChainRegistry — getDefault()', () => {
  it('throws UNSUPPORTED_CHAIN when the registry is empty', () => {
    const reg = new ChainRegistry()
    expect(() => reg.getDefault()).toThrow(WalletError)
  })

  it('empty registry error has code UNSUPPORTED_CHAIN', () => {
    const reg = new ChainRegistry()
    try {
      reg.getDefault()
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('returns the first registered chain when no defaultChainId is set', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    expect(reg.getDefault()).toBe(chainA)
  })

  it('returns the specified defaultChainId chain', () => {
    const reg = new ChainRegistry({ defaultChainId: 'chain-b' })
    reg.register(chainA)
    reg.register(chainB)
    expect(reg.getDefault()).toBe(chainB)
  })

  it('throws UNSUPPORTED_CHAIN if defaultChainId is not registered', () => {
    const reg = new ChainRegistry({ defaultChainId: 'does-not-exist' })
    reg.register(chainA)
    try {
      reg.getDefault()
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as WalletError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })

  it('default shifts after the original first chain is unregistered', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    reg.unregister('chain-a')
    expect(reg.getDefault()).toBe(chainB)
  })
})

// ─── exists() ──────────────────────────────────────────────────────────────

describe('ChainRegistry — exists()', () => {
  it('returns true for a registered chain', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    expect(reg.exists('chain-a')).toBe(true)
  })

  it('returns false for an unregistered chain', () => {
    const reg = new ChainRegistry()
    expect(reg.exists('chain-a')).toBe(false)
  })

  it('returns false after the chain is unregistered', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.unregister('chain-a')
    expect(reg.exists('chain-a')).toBe(false)
  })

  it('never throws regardless of the id', () => {
    const reg = new ChainRegistry()
    expect(() => reg.exists('')).not.toThrow()
    expect(() => reg.exists('definitely-not-real')).not.toThrow()
  })
})

// ─── size ──────────────────────────────────────────────────────────────────

describe('ChainRegistry — size', () => {
  it('is 0 on a fresh registry', () => {
    const reg = new ChainRegistry()
    expect(reg.size).toBe(0)
  })

  it('increments on each registration', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    expect(reg.size).toBe(1)
    reg.register(chainB)
    expect(reg.size).toBe(2)
  })

  it('decrements on unregister', () => {
    const reg = new ChainRegistry()
    reg.register(chainA)
    reg.register(chainB)
    reg.unregister('chain-a')
    expect(reg.size).toBe(1)
  })
})

// ─── seeding with DEFAULT_CHAINS ───────────────────────────────────────────

describe('ChainRegistry — seeded with DEFAULT_CHAINS', () => {
  it('registers all three Sprint 2 definitions', () => {
    const reg = new ChainRegistry()
    reg.register(qorechainDevnet)
    reg.register(ethereumSepolia)
    reg.register(solanaDevnet)
    expect(reg.size).toBe(3)
  })

  it('qorechain-devnet is the default when registered first', () => {
    const reg = new ChainRegistry()
    reg.register(qorechainDevnet)
    reg.register(ethereumSepolia)
    reg.register(solanaDevnet)
    expect(reg.getDefault().id).toBe('qorechain-devnet')
  })

  it('can retrieve each chain by id', () => {
    const reg = new ChainRegistry()
    reg.register(qorechainDevnet)
    reg.register(ethereumSepolia)
    reg.register(solanaDevnet)
    expect(reg.get('qorechain-devnet')).toBe(qorechainDevnet)
    expect(reg.get('ethereum-sepolia')).toBe(ethereumSepolia)
    expect(reg.get('solana-devnet')).toBe(solanaDevnet)
  })
})
