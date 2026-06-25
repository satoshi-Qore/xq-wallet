/**
 * defaultAssets.test.ts — Unit tests for default asset definitions and factory.
 */

import { describe, it, expect } from 'vitest'
import {
  QR_DEVNET,
  SEP_SEPOLIA,
  SOL_DEVNET,
  DEFAULT_ASSETS,
  createDefaultAssetRegistry,
} from '../defaultAssets'

describe('Default asset definitions', () => {
  it('QR_DEVNET is a native QoreChain asset', () => {
    expect(QR_DEVNET.id).toBe('qorechain-devnet:native:QR')
    expect(QR_DEVNET.type).toBe('native')
    expect(QR_DEVNET.symbol).toBe('QR')
    expect(QR_DEVNET.vm).toBe('native')
    expect(QR_DEVNET.chainId).toBe('qorechain-devnet')
    expect(QR_DEVNET.decimals).toBe(18)
  })

  it('SEP_SEPOLIA is a native EVM asset', () => {
    expect(SEP_SEPOLIA.id).toBe('ethereum-sepolia:native:SEP')
    expect(SEP_SEPOLIA.type).toBe('native')
    expect(SEP_SEPOLIA.symbol).toBe('SEP')
    expect(SEP_SEPOLIA.vm).toBe('evm')
    expect(SEP_SEPOLIA.chainId).toBe('ethereum-sepolia')
    expect(SEP_SEPOLIA.decimals).toBe(18)
  })

  it('SOL_DEVNET is a native SVM asset', () => {
    expect(SOL_DEVNET.id).toBe('solana-devnet:native:SOL')
    expect(SOL_DEVNET.type).toBe('native')
    expect(SOL_DEVNET.symbol).toBe('SOL')
    expect(SOL_DEVNET.vm).toBe('svm')
    expect(SOL_DEVNET.chainId).toBe('solana-devnet')
    expect(SOL_DEVNET.decimals).toBe(9)
  })

  it('DEFAULT_ASSETS contains exactly 3 assets', () => {
    expect(DEFAULT_ASSETS).toHaveLength(3)
  })

  it('DEFAULT_ASSETS covers all three VMs', () => {
    const vms = DEFAULT_ASSETS.map((a) => a.vm)
    expect(vms).toContain('native')
    expect(vms).toContain('evm')
    expect(vms).toContain('svm')
  })
})

describe('createDefaultAssetRegistry()', () => {
  it('returns a registry with 3 assets', () => {
    const registry = createDefaultAssetRegistry()
    expect(registry.size).toBe(3)
  })

  it('can look up QR by id', () => {
    const registry = createDefaultAssetRegistry()
    expect(registry.getById('qorechain-devnet:native:QR')).toEqual(QR_DEVNET)
  })

  it('can look up SEP by symbol', () => {
    const registry = createDefaultAssetRegistry()
    expect(registry.getBySymbol('SEP')).toEqual(SEP_SEPOLIA)
  })

  it('can look up SOL by VM', () => {
    const registry = createDefaultAssetRegistry()
    const svm = registry.getByVM('svm')
    expect(svm).toHaveLength(1)
    expect(svm[0]).toEqual(SOL_DEVNET)
  })

  it('each call returns an independent registry', () => {
    const r1 = createDefaultAssetRegistry()
    const r2 = createDefaultAssetRegistry()
    r1.unregister(QR_DEVNET.id)
    expect(r1.size).toBe(2)
    expect(r2.size).toBe(3) // r2 unaffected
  })
})
