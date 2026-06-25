/**
 * paths.test.ts — Unit tests for BIP-44 path builders.
 *
 * Tests path string format, coin types, and account index validation.
 */

import { describe, it, expect } from 'vitest'
import {
  evmPath,
  svmPath,
  nativePath,
  assertValidAccountIndex,
  EVM_COIN_TYPE,
  SVM_COIN_TYPE,
  NATIVE_COIN_TYPE,
} from '../paths'
import { WalletError } from '@/domain/errors'

// ─── Coin Type Constants ───────────────────────────────────────────────────

describe('Coin type constants', () => {
  it('EVM_COIN_TYPE is 60 (Ethereum SLIP-0044)', () => {
    expect(EVM_COIN_TYPE).toBe(60)
  })

  it('SVM_COIN_TYPE is 501 (Solana SLIP-0044)', () => {
    expect(SVM_COIN_TYPE).toBe(501)
  })

  it('NATIVE_COIN_TYPE is 9999 (QoreChain provisional)', () => {
    expect(NATIVE_COIN_TYPE).toBe(9999)
  })
})

// ─── evmPath() ────────────────────────────────────────────────────────────

describe('evmPath()', () => {
  it('returns correct path for index 0', () => {
    expect(evmPath(0)).toBe("m/44'/60'/0'/0/0")
  })

  it('returns correct path for index 1', () => {
    expect(evmPath(1)).toBe("m/44'/60'/0'/0/1")
  })

  it('returns correct path for index 100', () => {
    expect(evmPath(100)).toBe("m/44'/60'/0'/0/100")
  })

  it('returns correct path for max valid index (2147483647)', () => {
    expect(evmPath(0x7fffffff)).toBe("m/44'/60'/0'/0/2147483647")
  })

  it('path starts with m/', () => {
    expect(evmPath(0).startsWith('m/')).toBe(true)
  })

  it("path contains hardened purpose (44')", () => {
    expect(evmPath(0)).toContain("44'")
  })

  it("path contains hardened EVM coin type (60')", () => {
    expect(evmPath(0)).toContain("60'")
  })

  it('account index in path is NOT hardened (no apostrophe after the index)', () => {
    const path = evmPath(5)
    // Should end with /5, not /5'
    expect(path.endsWith('/5')).toBe(true)
  })

  it('throws DERIVATION_FAILED for negative index', () => {
    expect(() => evmPath(-1)).toThrowError(expect.objectContaining({ code: 'DERIVATION_FAILED' }))
  })

  it('throws DERIVATION_FAILED for non-integer (float)', () => {
    expect(() => evmPath(1.5)).toThrowError(expect.objectContaining({ code: 'DERIVATION_FAILED' }))
  })

  it('throws DERIVATION_FAILED for index exceeding 2147483647', () => {
    expect(() => evmPath(0x80000000)).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })

  it('throws WalletError instance (not generic Error)', () => {
    expect(() => evmPath(-1)).toThrow(WalletError)
  })
})

// ─── svmPath() ────────────────────────────────────────────────────────────

describe('svmPath()', () => {
  it('returns correct path for index 0', () => {
    expect(svmPath(0)).toBe("m/44'/501'/0'")
  })

  it('returns correct path for index 1', () => {
    expect(svmPath(1)).toBe("m/44'/501'/1'")
  })

  it('returns correct path for index 100', () => {
    expect(svmPath(100)).toBe("m/44'/501'/100'")
  })

  it("path contains hardened SVM coin type (501')", () => {
    expect(svmPath(0)).toContain("501'")
  })

  it('account index in SVM path IS hardened (required by SLIP-0010 Ed25519)', () => {
    const path = svmPath(5)
    expect(path.endsWith("/5'")).toBe(true)
  })

  it('throws DERIVATION_FAILED for negative index', () => {
    expect(() => svmPath(-1)).toThrowError(expect.objectContaining({ code: 'DERIVATION_FAILED' }))
  })

  it('throws DERIVATION_FAILED for non-integer', () => {
    expect(() => svmPath(0.5)).toThrowError(expect.objectContaining({ code: 'DERIVATION_FAILED' }))
  })
})

// ─── nativePath() ─────────────────────────────────────────────────────────

describe('nativePath()', () => {
  it('returns correct path for index 0', () => {
    expect(nativePath(0)).toBe("m/44'/9999'/0'/0/0")
  })

  it('returns correct path for index 1', () => {
    expect(nativePath(1)).toBe("m/44'/9999'/0'/0/1")
  })

  it("path contains hardened Native coin type (9999')", () => {
    expect(nativePath(0)).toContain("9999'")
  })

  it('EVM and Native paths differ for the same index (different coin types)', () => {
    expect(evmPath(0)).not.toBe(nativePath(0))
  })

  it('EVM and SVM paths differ for the same index (different structure)', () => {
    expect(evmPath(0)).not.toBe(svmPath(0))
  })

  it('SVM and Native paths differ for the same index', () => {
    expect(svmPath(0)).not.toBe(nativePath(0))
  })

  it('throws DERIVATION_FAILED for negative index', () => {
    expect(() => nativePath(-1)).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })
})

// ─── assertValidAccountIndex() ────────────────────────────────────────────

describe('assertValidAccountIndex()', () => {
  it('does not throw for index 0', () => {
    expect(() => assertValidAccountIndex(0)).not.toThrow()
  })

  it('does not throw for index 1', () => {
    expect(() => assertValidAccountIndex(1)).not.toThrow()
  })

  it('does not throw for max valid index (2147483647)', () => {
    expect(() => assertValidAccountIndex(0x7fffffff)).not.toThrow()
  })

  it('throws for negative index (-1)', () => {
    expect(() => assertValidAccountIndex(-1)).toThrow(WalletError)
  })

  it('throws for 2147483648 (exceeds 31-bit max)', () => {
    expect(() => assertValidAccountIndex(0x80000000)).toThrow(WalletError)
  })

  it('throws for fractional index (1.5)', () => {
    expect(() => assertValidAccountIndex(1.5)).toThrow(WalletError)
  })

  it('throws for NaN', () => {
    expect(() => assertValidAccountIndex(NaN)).toThrow(WalletError)
  })

  it('throws for Infinity', () => {
    expect(() => assertValidAccountIndex(Infinity)).toThrow(WalletError)
  })

  it('error code is DERIVATION_FAILED', () => {
    expect(() => assertValidAccountIndex(-1)).toThrowError(
      expect.objectContaining({ code: 'DERIVATION_FAILED' }),
    )
  })
})
