/**
 * definitions.test.ts — Validates the three Sprint 2 chain definition objects.
 *
 * These are pure data tests: no network calls, no registry required.
 * Ensures every definition is structurally correct before it enters the registry.
 */

import { describe, it, expect } from 'vitest'
import { qorechainDevnet, ethereumSepolia, solanaDevnet, DEFAULT_CHAINS } from '../definitions'
import type { ChainDefinition, VMType } from '@/domain/chain'

const VALID_VM_TYPES: readonly VMType[] = ['native', 'evm', 'svm']
const ALL_DEFS: readonly ChainDefinition[] = [qorechainDevnet, ethereumSepolia, solanaDevnet]

// ─── Individual chain metadata ─────────────────────────────────────────────

describe('qorechainDevnet definition', () => {
  it('has id: qorechain-devnet', () => {
    expect(qorechainDevnet.id).toBe('qorechain-devnet')
  })

  it('has vm: native', () => {
    expect(qorechainDevnet.vm).toBe('native')
  })

  it('has chainId: null (native VM does not use EIP-155)', () => {
    expect(qorechainDevnet.chainId).toBeNull()
  })

  it('has testnet: true', () => {
    expect(qorechainDevnet.testnet).toBe(true)
  })

  it('has enabled: true', () => {
    expect(qorechainDevnet.enabled).toBe(true)
  })

  it('nativeCurrency symbol is QR', () => {
    expect(qorechainDevnet.nativeCurrency.symbol).toBe('QR')
  })

  it('nativeCurrency decimals is 18', () => {
    expect(qorechainDevnet.nativeCurrency.decimals).toBe(18)
  })

  it('has at least one rpcUrl', () => {
    expect(qorechainDevnet.rpcUrls.length).toBeGreaterThan(0)
  })

  it('explorerUrl is a non-empty string', () => {
    expect(qorechainDevnet.explorerUrl.length).toBeGreaterThan(0)
  })
})

describe('ethereumSepolia definition', () => {
  it('has id: ethereum-sepolia', () => {
    expect(ethereumSepolia.id).toBe('ethereum-sepolia')
  })

  it('has vm: evm', () => {
    expect(ethereumSepolia.vm).toBe('evm')
  })

  it('has chainId: 11155111 (Sepolia per EIP-155)', () => {
    expect(ethereumSepolia.chainId).toBe(11155111)
  })

  it('has testnet: true', () => {
    expect(ethereumSepolia.testnet).toBe(true)
  })

  it('has enabled: true', () => {
    expect(ethereumSepolia.enabled).toBe(true)
  })

  it('nativeCurrency symbol is SEP', () => {
    expect(ethereumSepolia.nativeCurrency.symbol).toBe('SEP')
  })

  it('nativeCurrency decimals is 18', () => {
    expect(ethereumSepolia.nativeCurrency.decimals).toBe(18)
  })

  it('has at least one rpcUrl', () => {
    expect(ethereumSepolia.rpcUrls.length).toBeGreaterThan(0)
  })
})

describe('solanaDevnet definition', () => {
  it('has id: solana-devnet', () => {
    expect(solanaDevnet.id).toBe('solana-devnet')
  })

  it('has vm: svm', () => {
    expect(solanaDevnet.vm).toBe('svm')
  })

  it('has chainId: null (SVM does not use EIP-155)', () => {
    expect(solanaDevnet.chainId).toBeNull()
  })

  it('has testnet: true', () => {
    expect(solanaDevnet.testnet).toBe(true)
  })

  it('has enabled: true', () => {
    expect(solanaDevnet.enabled).toBe(true)
  })

  it('nativeCurrency symbol is SOL', () => {
    expect(solanaDevnet.nativeCurrency.symbol).toBe('SOL')
  })

  it('nativeCurrency decimals is 9', () => {
    expect(solanaDevnet.nativeCurrency.decimals).toBe(9)
  })

  it('has at least one rpcUrl', () => {
    expect(solanaDevnet.rpcUrls.length).toBeGreaterThan(0)
  })
})

// ─── Cross-definition invariants ───────────────────────────────────────────

describe('all chain definitions — shared invariants', () => {
  it('all have a non-empty id', () => {
    for (const def of ALL_DEFS) {
      expect(def.id.length).toBeGreaterThan(0)
    }
  })

  it('all ids are unique', () => {
    const ids = ALL_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all vm values are valid VMType literals', () => {
    for (const def of ALL_DEFS) {
      expect(VALID_VM_TYPES).toContain(def.vm)
    }
  })

  it('covers all three VM types', () => {
    const vms = new Set(ALL_DEFS.map((d) => d.vm))
    expect(vms.has('native')).toBe(true)
    expect(vms.has('evm')).toBe(true)
    expect(vms.has('svm')).toBe(true)
  })

  it('all have a non-empty name', () => {
    for (const def of ALL_DEFS) {
      expect(def.name.length).toBeGreaterThan(0)
    }
  })

  it('all have a non-empty shortName', () => {
    for (const def of ALL_DEFS) {
      expect(def.shortName.length).toBeGreaterThan(0)
    }
  })

  it('all have at least one rpcUrl', () => {
    for (const def of ALL_DEFS) {
      expect(def.rpcUrls.length).toBeGreaterThan(0)
    }
  })

  it('all rpcUrls start with https://', () => {
    for (const def of ALL_DEFS) {
      for (const url of def.rpcUrls) {
        expect(url).toMatch(/^https:\/\//)
      }
    }
  })

  it('all have a non-empty explorerUrl', () => {
    for (const def of ALL_DEFS) {
      expect(def.explorerUrl.length).toBeGreaterThan(0)
    }
  })

  it('all explorerTxPaths contain {hash} placeholder', () => {
    for (const def of ALL_DEFS) {
      expect(def.explorerTxPath).toContain('{hash}')
    }
  })

  it('all explorerAddressPaths contain {address} placeholder', () => {
    for (const def of ALL_DEFS) {
      expect(def.explorerAddressPath).toContain('{address}')
    }
  })

  it('all nativeCurrency.decimals are positive integers', () => {
    for (const def of ALL_DEFS) {
      expect(def.nativeCurrency.decimals).toBeGreaterThan(0)
      expect(Number.isInteger(def.nativeCurrency.decimals)).toBe(true)
    }
  })

  it('all nativeCurrency.symbol are non-empty strings', () => {
    for (const def of ALL_DEFS) {
      expect(def.nativeCurrency.symbol.length).toBeGreaterThan(0)
    }
  })

  it('EVM chains have a numeric chainId; non-EVM chains have null', () => {
    for (const def of ALL_DEFS) {
      if (def.vm === 'evm') {
        expect(typeof def.chainId).toBe('number')
      } else {
        expect(def.chainId).toBeNull()
      }
    }
  })

  it('all have a non-empty logoKey', () => {
    for (const def of ALL_DEFS) {
      expect(def.logoKey.length).toBeGreaterThan(0)
    }
  })
})

// ─── DEFAULT_CHAINS ────────────────────────────────────────────────────────

describe('DEFAULT_CHAINS', () => {
  it('contains exactly three definitions', () => {
    expect(DEFAULT_CHAINS).toHaveLength(3)
  })

  it('first entry is qorechain-devnet', () => {
    expect(DEFAULT_CHAINS[0].id).toBe('qorechain-devnet')
  })

  it('second entry is ethereum-sepolia', () => {
    expect(DEFAULT_CHAINS[1].id).toBe('ethereum-sepolia')
  })

  it('third entry is solana-devnet', () => {
    expect(DEFAULT_CHAINS[2].id).toBe('solana-devnet')
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(DEFAULT_CHAINS)).toBe(true)
  })

  it('contains the same object references as the named exports', () => {
    expect(DEFAULT_CHAINS[0]).toBe(qorechainDevnet)
    expect(DEFAULT_CHAINS[1]).toBe(ethereumSepolia)
    expect(DEFAULT_CHAINS[2]).toBe(solanaDevnet)
  })
})
