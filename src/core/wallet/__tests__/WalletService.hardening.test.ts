/**
 * WalletService — P0.3.1 hardening tests.
 *
 * Covers Fix 1 (production guard via enforceRealPersistence option)
 * and Fix 4 (KDF parameter validation).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WalletService } from '../WalletService'
import { NoOpVaultPersistenceService } from '../../persistence/NoOpVaultPersistenceService'
import { VaultPersistenceService } from '../../../infrastructure/persistence/VaultPersistenceService'
import { IndexedDBVaultAdapter } from '../../../infrastructure/persistence/IndexedDBVaultAdapter'
import { VaultIntegrityChecker } from '../../../infrastructure/persistence/VaultIntegrityChecker'
import { MinimalFakeIDBFactory } from '../../../infrastructure/persistence/__tests__/helpers/MinimalFakeIDB'
import { WalletError } from '../../../domain/errors'
import type { IVaultPersistenceService } from '../../persistence/IVaultPersistenceService'
import type { EncryptedVault } from '../../../domain/vault'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'correct-horse-battery'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRealPersistence(): IVaultPersistenceService {
  const factory = new MinimalFakeIDBFactory()
  const checker = new VaultIntegrityChecker()
  const adapter = new IndexedDBVaultAdapter(factory as unknown as IDBFactory, checker)
  return new VaultPersistenceService(adapter, checker)
}

function makeTamperedStub(vault: EncryptedVault, iterations: number): IVaultPersistenceService {
  const tampered: EncryptedVault = {
    ...vault,
    crypto: {
      ...vault.crypto,
      kdfParams: { ...vault.crypto.kdfParams, iterations },
    },
  }
  return {
    createWallet: async () => {},
    loadWallet: async (_id: string) => tampered,
    deleteWallet: async () => {},
    rotatePassword: async () => {},
    listWallets: async () => [],
    verifyIntegrity: async (walletId: string) => ({
      valid: false as const,
      walletId,
      schemaVersion: 0,
      errorCode: 'VAULT_CORRUPTED' as const,
    }),
  }
}

// ── Fix 1: enforceRealPersistence guard ───────────────────────────────────────

describe('WalletService — enforceRealPersistence guard (Fix 1)', () => {
  it('does NOT throw with enforceRealPersistence: false (default) + NoOp service', () => {
    expect(
      () => new WalletService({ pbkdf2Iterations: 1, enforceRealPersistence: false }),
    ).not.toThrow()
  })

  it('does NOT throw when enforceRealPersistence is omitted (backward compatible)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 1 })).not.toThrow()
  })

  it('throws PERSISTENCE_NOT_CONFIGURED with enforceRealPersistence: true + default NoOp', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 1, enforceRealPersistence: true })).toThrow(
      expect.objectContaining({ code: 'PERSISTENCE_NOT_CONFIGURED' }),
    )
  })

  it('throws PERSISTENCE_NOT_CONFIGURED with enforceRealPersistence: true + explicit NoOp', () => {
    expect(
      () =>
        new WalletService({
          pbkdf2Iterations: 1,
          enforceRealPersistence: true,
          persistenceService: new NoOpVaultPersistenceService(),
        }),
    ).toThrow(expect.objectContaining({ code: 'PERSISTENCE_NOT_CONFIGURED' }))
  })

  it('does NOT throw with enforceRealPersistence: true + real persistence service', () => {
    const real = makeRealPersistence()
    expect(
      () =>
        new WalletService({
          pbkdf2Iterations: 1,
          enforceRealPersistence: true,
          persistenceService: real,
        }),
    ).not.toThrow()
  })

  it('thrown error is a WalletError instance', () => {
    let caught: unknown
    try {
      new WalletService({ pbkdf2Iterations: 1, enforceRealPersistence: true })
    } catch (e) {
      caught = e
    }
    expect(WalletError.isWalletError(caught)).toBe(true)
  })

  it('error message does not contain sensitive data', () => {
    let caught: Error | null = null
    try {
      new WalletService({ pbkdf2Iterations: 1, enforceRealPersistence: true })
    } catch (e) {
      if (e instanceof Error) caught = e
    }
    expect(caught).not.toBeNull()
    expect(caught!.message).not.toMatch(/mnemonic|seed|private|secret|key/i)
  })
})

// ── Fix 4: KDF parameter validation in constructor ────────────────────────────

describe('WalletService — KDF parameter validation in constructor (Fix 4)', () => {
  it('accepts the default iteration count (600 000)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 600_000 })).not.toThrow()
  })

  it('accepts 1 (minimum — used in tests)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 1 })).not.toThrow()
  })

  it('accepts 10 000 000 (maximum)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 10_000_000 })).not.toThrow()
  })

  it('throws INVALID_KDF_PARAMS for 0', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 0 })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for negative values', () => {
    expect(() => new WalletService({ pbkdf2Iterations: -1 })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for 10 000 001 (exceeds maximum)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 10_000_001 })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for float (1.5)', () => {
    expect(() => new WalletService({ pbkdf2Iterations: 1.5 })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for NaN', () => {
    expect(() => new WalletService({ pbkdf2Iterations: NaN })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for Infinity', () => {
    expect(() => new WalletService({ pbkdf2Iterations: Infinity })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('throws INVALID_KDF_PARAMS for value exceeding Number.MAX_SAFE_INTEGER', () => {
    expect(() => new WalletService({ pbkdf2Iterations: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      expect.objectContaining({ code: 'INVALID_KDF_PARAMS' }),
    )
  })

  it('thrown error is a WalletError instance', () => {
    let caught: unknown
    try {
      new WalletService({ pbkdf2Iterations: 0 })
    } catch (e) {
      caught = e
    }
    expect(WalletError.isWalletError(caught)).toBe(true)
  })
})

// ── Fix 4: KDF validation in decryptVault (via openWallet) ───────────────────

describe('WalletService — KDF validation in decryptVault (Fix 4)', () => {
  let svc: WalletService

  beforeEach(() => {
    svc = new WalletService({ pbkdf2Iterations: 1 })
  })

  it('importWallet + unlockWallet work normally with iterations=1', async () => {
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    svc.lockWallet()
    await expect(svc.unlockWallet(PASSWORD)).resolves.toBeUndefined()
  })

  it('decryptVault rejects a vault with 0 iterations — INVALID_KDF_PARAMS', async () => {
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vault = (svc as any).encryptedVault as EncryptedVault
    const stub = makeTamperedStub(vault, 0)
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService: stub })
    await expect(svc2.openWallet('w1', PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_KDF_PARAMS',
    })
  })

  it('decryptVault rejects a vault with iterations exceeding MAX (10 000 001)', async () => {
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vault = (svc as any).encryptedVault as EncryptedVault
    const stub = makeTamperedStub(vault, 10_000_001)
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService: stub })
    await expect(svc2.openWallet('w1', PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_KDF_PARAMS',
    })
  })

  it('decryptVault rejects a vault with non-integer iterations (1.5)', async () => {
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vault = (svc as any).encryptedVault as EncryptedVault
    const stub = makeTamperedStub(vault, 1.5)
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService: stub })
    await expect(svc2.openWallet('w1', PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_KDF_PARAMS',
    })
  })
})
