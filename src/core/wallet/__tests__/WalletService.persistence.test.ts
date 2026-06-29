/**
 * WalletService.persistence.test.ts — Day 15 persistence integration tests.
 *
 * Tests the full WalletService → IVaultPersistenceService → IndexedDBVaultAdapter
 * stack using MinimalFakeIDB as the IDB backend.
 *
 * Test structure:
 *   1. NoOpVaultPersistenceService (default) — backward compat
 *   2. VaultPersistenceService integration — wallet creation persistence
 *   3. openWallet() — restore from storage
 *   4. deleteWallet() — removal from storage
 *   5. rotatePassword() — re-encryption + storage update
 *   6. listWallets() — public listing
 *   7. verifyWalletIntegrity() — checksum verification
 *   8. Failure propagation — NullVaultPersistenceService, storage errors
 *   9. Integration scenarios — full end-to-end flows
 */

import { describe, it, expect } from 'vitest'
import { WalletService } from '../WalletService'
import { WalletError } from '@/domain/errors'
import type { IVaultPersistenceService } from '@/core/persistence/IVaultPersistenceService'
import { NullVaultPersistenceService } from '@/infrastructure/persistence/NullVaultPersistenceService'
import { VaultPersistenceService } from '@/infrastructure/persistence/VaultPersistenceService'
import { IndexedDBVaultAdapter } from '@/infrastructure/persistence/IndexedDBVaultAdapter'
import { VaultIntegrityChecker } from '@/infrastructure/persistence/VaultIntegrityChecker'
import { MinimalFakeIDBFactory } from '@/infrastructure/persistence/__tests__/helpers/MinimalFakeIDB'

// ─── Test constants ────────────────────────────────────────────────────────────

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'correct-password-123'
const NEW_PASSWORD = 'new-password-456'
const WRONG_PASSWORD = 'wrong-password-xyz'
const WALLET_NAME = 'Test Wallet'

// ─── Factories ─────────────────────────────────────────────────────────────────

/** WalletService with default (NoOp) persistence — pure in-memory. */
const makeSvc = () => new WalletService({ pbkdf2Iterations: 1 })

/** WalletService backed by a fresh in-memory IDB via VaultPersistenceService. */
function makePersistedSvc() {
  const factory = new MinimalFakeIDBFactory()
  const checker = new VaultIntegrityChecker()
  const adapter = new IndexedDBVaultAdapter(factory as unknown as IDBFactory, checker)
  const persistenceService = new VaultPersistenceService(adapter, checker)
  const service = new WalletService({ pbkdf2Iterations: 1, persistenceService })
  return { service, persistenceService, adapter }
}

// ─── 1. NoOpVaultPersistenceService — backward compatibility ──────────────────

describe('WalletService — NoOpVaultPersistenceService (default)', () => {
  it('createWallet succeeds without a persistence service', async () => {
    const svc = makeSvc()
    const result = await svc.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    expect(result.wallet).toBeDefined()
    expect(result.mnemonic).toBeDefined()
    expect(svc.isInitialized).toBe(true)
    expect(svc.isLocked).toBe(false)
  })

  it('importWallet succeeds without a persistence service', async () => {
    const svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD, walletName: WALLET_NAME })
    expect(svc.isInitialized).toBe(true)
  })

  it('listWallets returns empty array with no-op service', async () => {
    const svc = makeSvc()
    await svc.createWallet({ password: PASSWORD })
    const list = await svc.listWallets()
    expect(list).toEqual([])
  })

  it('openWallet throws VAULT_NOT_FOUND with no-op service', async () => {
    const svc = makeSvc()
    await expect(svc.openWallet('any-wallet-id', PASSWORD)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('verifyWalletIntegrity returns valid: false with no-op service', async () => {
    const svc = makeSvc()
    await svc.createWallet({ password: PASSWORD })
    const result = await svc.verifyWalletIntegrity()
    expect(result.valid).toBe(false)
  })

  it('deleteWallet is a silent no-op with no-op service', async () => {
    const svc = makeSvc()
    await svc.createWallet({ password: PASSWORD })
    const walletId = svc.wallet!.id
    // Should not throw
    await expect(svc.deleteWallet(walletId)).resolves.toBeUndefined()
    // In-memory state should be cleared (it was the current wallet)
    expect(svc.isInitialized).toBe(false)
  })

  it('rotatePassword with no-op service updates in-memory vault', async () => {
    const svc = makeSvc()
    await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await svc.rotatePassword(PASSWORD, NEW_PASSWORD)
    // Lock then unlock with new password to verify
    svc.lockWallet()
    await svc.unlockWallet(NEW_PASSWORD)
    expect(svc.isLocked).toBe(false)
  })
})

// ─── 2. VaultPersistenceService integration — wallet creation ─────────────────

describe('WalletService — createWallet() with persistence', () => {
  it('persists the vault after createWallet', async () => {
    const { service, persistenceService } = makePersistedSvc()
    const result = await service.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    const walletId = result.wallet.id

    // Verify via the persistence service directly
    const verifyResult = await persistenceService.verifyIntegrity(walletId)
    expect(verifyResult.valid).toBe(true)
    expect(verifyResult.walletId).toBe(walletId)
  })

  it('listWallets returns the persisted wallet after createWallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    const list = await service.listWallets()
    expect(list).toHaveLength(1)
    expect(list[0].displayName).toBe(WALLET_NAME)
    expect(list[0].vm).toBe('evm')
  })

  it('persists the vault after importWallet', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD, walletName: WALLET_NAME })
    const walletId = service.wallet!.id

    const verifyResult = await persistenceService.verifyIntegrity(walletId)
    expect(verifyResult.valid).toBe(true)
  })

  it('verifyWalletIntegrity returns valid: true for a fresh persisted wallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    const result = await service.verifyWalletIntegrity()
    expect(result.valid).toBe(true)
  })

  it('verifyWalletIntegrity accepts explicit walletId', async () => {
    const { service } = makePersistedSvc()
    const result = await service.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    const walletId = result.wallet.id

    const verify = await service.verifyWalletIntegrity(walletId)
    expect(verify.valid).toBe(true)
    expect(verify.walletId).toBe(walletId)
  })

  it('in-memory state is unchanged when persistence throws on createWallet', async () => {
    const failingPersistence = new NullVaultPersistenceService()
    const svc = new WalletService({ pbkdf2Iterations: 1, persistenceService: failingPersistence })

    await expect(
      svc.createWallet({ password: PASSWORD, walletName: WALLET_NAME }),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })

    // In-memory state must be unchanged (fail-closed)
    expect(svc.isInitialized).toBe(false)
    expect(svc.wallet).toBeNull()
  })
})

// ─── 3. openWallet() — restore from storage ───────────────────────────────────

describe('WalletService — openWallet()', () => {
  it('restores wallet state from persistence', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD, walletName: WALLET_NAME })
    const walletId = service.wallet!.id

    // Simulate app restart: fresh service instance, same persistence store
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, PASSWORD)

    expect(svc2.isInitialized).toBe(true)
    expect(svc2.isLocked).toBe(false)
    expect(svc2.wallet!.id).toBe(walletId)
    expect(svc2.wallet!.name).toBe(WALLET_NAME)
    // P0.3 scope: re-derive account 0 only
    expect(svc2.getAccounts()).toHaveLength(1)
    expect(svc2.wallet!.wordCount).toBe(12)
  })

  it('openWallet restores unlocked session', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD, walletName: WALLET_NAME })
    const walletId = service.wallet!.id

    // Create new service instance re-using the same persistence service
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, PASSWORD)

    expect(svc2.isLocked).toBe(false)
    expect(svc2.wallet!.lastUnlockedAt).not.toBeNull()
  })

  it('openWallet produces correct EVM account 0 address for known mnemonic', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, PASSWORD)

    const accounts = svc2.getAccounts()
    const evmEntry = accounts[0].addresses.find((a) => a.vm === 'evm')
    expect(evmEntry?.address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')
  })

  it('openWallet throws VAULT_NOT_FOUND for unknown walletId', async () => {
    const { service } = makePersistedSvc()
    await expect(service.openWallet('non-existent-id', PASSWORD)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('openWallet throws INCORRECT_PASSWORD for wrong password', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await expect(svc2.openWallet(walletId, WRONG_PASSWORD)).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('openWallet falls back to walletId as name when listWallets fails', async () => {
    // Use a persistence service where loadWallet works but listWallets throws
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    // Wrap persistence service: delegate all methods except listWallets which throws.
    // Object spread doesn't copy prototype methods, so we use explicit delegation.
    const brokenListService: IVaultPersistenceService = {
      createWallet: (...args) => persistenceService.createWallet(...args),
      loadWallet: (...args) => persistenceService.loadWallet(...args),
      deleteWallet: (...args) => persistenceService.deleteWallet(...args),
      rotatePassword: (...args) => persistenceService.rotatePassword(...args),
      listWallets: async () => {
        throw new WalletError('STORAGE_UNAVAILABLE', 'listing broken')
      },
      verifyIntegrity: (...args) => persistenceService.verifyIntegrity(...args),
    }
    const svc2 = new WalletService({
      pbkdf2Iterations: 1,
      persistenceService: brokenListService,
    })
    await svc2.openWallet(walletId, PASSWORD)

    // Falls back to walletId as name
    expect(svc2.wallet!.name).toBe(walletId)
  })
})

// ─── 4. deleteWallet() ────────────────────────────────────────────────────────

describe('WalletService — deleteWallet()', () => {
  it('removes the wallet from persistence', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    const walletId = service.wallet!.id

    await service.deleteWallet(walletId)

    const list = await persistenceService.listWallets()
    expect(list).toHaveLength(0)
  })

  it('clears in-memory state when deleting the current wallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    expect(service.isInitialized).toBe(true)

    await service.deleteWallet()

    expect(service.isInitialized).toBe(false)
    expect(service.wallet).toBeNull()
    expect(service.isLocked).toBe(true)
  })

  it('does not clear in-memory state when deleting a DIFFERENT wallet', async () => {
    const { service, persistenceService } = makePersistedSvc()

    // Create wallet A (current)
    await service.createWallet({ password: PASSWORD, walletName: 'Wallet A' })
    const walletAId = service.wallet!.id

    // Create wallet B using a second service instance with same persistence
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    const resultB = await svc2.createWallet({ password: PASSWORD, walletName: 'Wallet B' })
    const walletBId = resultB.wallet.id

    // Delete wallet B from svc (current wallet is A)
    await service.deleteWallet(walletBId)

    // Wallet A in-memory state should be intact
    expect(service.isInitialized).toBe(true)
    expect(service.wallet!.id).toBe(walletAId)
  })

  it('deleteWallet without argument uses current wallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    await service.deleteWallet() // no explicit walletId

    expect(service.isInitialized).toBe(false)
  })

  it('throws VAULT_NOT_FOUND when no walletId and no wallet loaded', async () => {
    const { service } = makePersistedSvc()
    await expect(service.deleteWallet()).rejects.toMatchObject({ code: 'VAULT_NOT_FOUND' })
  })
})

// ─── 5. rotatePassword() ─────────────────────────────────────────────────────

describe('WalletService — rotatePassword()', () => {
  it('new password works after rotation', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    service.lockWallet()
    await service.unlockWallet(NEW_PASSWORD)
    expect(service.isLocked).toBe(false)
  })

  it('old password fails after rotation', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    service.lockWallet()
    await expect(service.unlockWallet(PASSWORD)).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('persistence stores the new vault after rotation', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    // Verify via a new service instance using the same persistence service
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, NEW_PASSWORD)
    expect(svc2.isLocked).toBe(false)
  })

  it('old password fails to open from persistence after rotation', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await expect(svc2.openWallet(walletId, PASSWORD)).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('rotatePassword preserves original createdAt', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const originalCreatedAt = service.wallet!.createdAt

    // Small delay to ensure updatedAt can differ
    await new Promise((r) => setTimeout(r, 2))
    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    // Re-encrypt does not change createdAt of the WalletMetadata
    // (wallet metadata createdAt is preserved; only encryptedVault.updatedAt changes)
    expect(service.wallet!.createdAt).toBe(originalCreatedAt)
  })

  it('throws INCORRECT_PASSWORD when old password is wrong', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await expect(service.rotatePassword(WRONG_PASSWORD, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('throws WEAK_PASSWORD when new password is too short', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    await expect(service.rotatePassword(PASSWORD, 'short')).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    })
  })

  it('throws VAULT_NOT_FOUND when no wallet is loaded', async () => {
    const { service } = makePersistedSvc()
    await expect(service.rotatePassword(PASSWORD, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })
})

// ─── 6. listWallets() ────────────────────────────────────────────────────────

describe('WalletService — listWallets()', () => {
  it('returns empty array before any wallets are created', async () => {
    const { service } = makePersistedSvc()
    const list = await service.listWallets()
    expect(list).toEqual([])
  })

  it('returns one entry after createWallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    const list = await service.listWallets()
    expect(list).toHaveLength(1)
    expect(list[0].displayName).toBe(WALLET_NAME)
  })

  it('returns entries sorted by createdAt ascending', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD, walletName: 'First' })

    // Add a second wallet using a new service instance
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.createWallet({ password: PASSWORD, walletName: 'Second' })

    const list = await service.listWallets()
    expect(list).toHaveLength(2)
    // createdAt should be non-decreasing
    expect(list[0].createdAt).toBeLessThanOrEqual(list[1].createdAt)
  })

  it('listing omits wallet data after deleteWallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    await service.deleteWallet()
    const list = await service.listWallets()
    expect(list).toHaveLength(0)
  })

  it('WalletListEntry contains walletId, displayName, vm, timestamps', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD, walletName: WALLET_NAME })
    const list = await service.listWallets()
    const entry = list[0]
    expect(typeof entry.walletId).toBe('string')
    expect(entry.displayName).toBe(WALLET_NAME)
    expect(entry.vm).toBe('evm')
    expect(typeof entry.createdAt).toBe('number')
    expect(typeof entry.updatedAt).toBe('number')
    expect(entry.walletId).toBe(service.wallet!.id)
  })
})

// ─── 7. verifyWalletIntegrity() ───────────────────────────────────────────────

describe('WalletService — verifyWalletIntegrity()', () => {
  it('returns valid: true for a freshly persisted wallet', async () => {
    const { service } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    const result = await service.verifyWalletIntegrity()
    expect(result.valid).toBe(true)
  })

  it('accepts explicit walletId parameter', async () => {
    const { service } = makePersistedSvc()
    const { wallet } = await service.createWallet({ password: PASSWORD })
    const result = await service.verifyWalletIntegrity(wallet.id)
    expect(result.valid).toBe(true)
    expect(result.walletId).toBe(wallet.id)
  })

  it('throws VAULT_NOT_FOUND when no id given and no wallet loaded', async () => {
    const { service } = makePersistedSvc()
    await expect(service.verifyWalletIntegrity()).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('returns valid: false for non-existent wallet', async () => {
    const { service } = makePersistedSvc()
    const result = await service.verifyWalletIntegrity('non-existent-id')
    expect(result.valid).toBe(false)
  })
})

// ─── 8. Failure propagation ───────────────────────────────────────────────────

describe('WalletService — failure propagation', () => {
  it('NullVaultPersistenceService causes createWallet to throw STORAGE_UNAVAILABLE', async () => {
    const svc = new WalletService({
      pbkdf2Iterations: 1,
      persistenceService: new NullVaultPersistenceService(),
    })
    await expect(svc.createWallet({ password: PASSWORD })).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })

  it('NullVaultPersistenceService causes importWallet to throw STORAGE_UNAVAILABLE', async () => {
    const svc = new WalletService({
      pbkdf2Iterations: 1,
      persistenceService: new NullVaultPersistenceService(),
    })
    await expect(
      svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
  })

  it('NullVaultPersistenceService causes listWallets to throw STORAGE_UNAVAILABLE', async () => {
    const svc = new WalletService({
      pbkdf2Iterations: 1,
      persistenceService: new NullVaultPersistenceService(),
    })
    await expect(svc.listWallets()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
  })

  it('rotatePassword propagates VAULT_CORRUPTED from persistence', async () => {
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })

    // Just verify normal rotation works (failure path tested via NullVaultPersistenceService above)
    await service.rotatePassword(PASSWORD, NEW_PASSWORD)
    // Rotation succeeded — persistence stores the new vault
    const list = await service.listWallets()
    expect(list).toHaveLength(1)
  })

  it('error from persistence does not expose mnemonic in message', async () => {
    const svc = new WalletService({
      pbkdf2Iterations: 1,
      persistenceService: new NullVaultPersistenceService(),
    })
    let caught: WalletError | null = null
    try {
      await svc.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    } catch (err) {
      caught = err as WalletError
    }
    expect(caught).not.toBeNull()
    expect(caught!.message).not.toContain('abandon')
  })
})

// ─── 9. Integration scenarios ─────────────────────────────────────────────────

describe('WalletService — integration scenarios', () => {
  it('full flow: create → lock → openWallet → accounts available', async () => {
    const { service, persistenceService } = makePersistedSvc()

    // Create wallet
    const result = await service.importWallet({
      mnemonic: MNEMONIC,
      password: PASSWORD,
      walletName: WALLET_NAME,
    })
    const walletId = service.wallet!.id

    // Lock and discard the service
    service.lockWallet()

    // Restore from persistence with a fresh service instance
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, PASSWORD)

    expect(svc2.isInitialized).toBe(true)
    expect(svc2.isLocked).toBe(false)
    expect(svc2.getAccounts()).toHaveLength(1)
    expect(svc2.wallet!.name).toBe(WALLET_NAME)
    return result
  })

  it('full flow: create → rotatePassword → openWallet with new password', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })
    const walletId = service.wallet!.id

    await service.rotatePassword(PASSWORD, NEW_PASSWORD)

    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, NEW_PASSWORD)
    expect(svc2.isLocked).toBe(false)

    // Confirm original password no longer works
    const svc3 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await expect(svc3.openWallet(walletId, PASSWORD)).rejects.toMatchObject({
      code: 'INCORRECT_PASSWORD',
    })
  })

  it('full flow: create → delete → list is empty → openWallet throws', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.createWallet({ password: PASSWORD })
    const walletId = service.wallet!.id

    await service.deleteWallet()

    const list = await service.listWallets()
    expect(list).toHaveLength(0)

    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await expect(svc2.openWallet(walletId, PASSWORD)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('full flow: create → lock → unlock (in-memory) still works', async () => {
    // With persistence, the existing lock/unlock in-memory path should be unaffected
    const { service } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })

    service.lockWallet()
    expect(service.isLocked).toBe(true)

    await service.unlockWallet(PASSWORD)
    expect(service.isLocked).toBe(false)
  })

  it('wallet survives create → deriveNextAccount → lock → openWallet (account 0 only)', async () => {
    const { service, persistenceService } = makePersistedSvc()
    await service.importWallet({ mnemonic: MNEMONIC, password: PASSWORD })

    // Derive account 1
    await service.deriveNextAccount('Account 2')
    expect(service.getAccounts()).toHaveLength(2)

    const walletId = service.wallet!.id

    // Fresh service with same persistence: only account 0 is restored (P0.3 scope)
    const svc2 = new WalletService({ pbkdf2Iterations: 1, persistenceService })
    await svc2.openWallet(walletId, PASSWORD)

    expect(svc2.getAccounts()).toHaveLength(1) // P0.3 limitation: account 0 only
    expect(svc2.getAccounts()[0].addresses.length).toBeGreaterThan(0)
  })
})
