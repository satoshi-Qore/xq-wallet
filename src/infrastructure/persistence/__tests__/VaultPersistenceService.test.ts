/**
 * VaultPersistenceService — unit tests.
 *
 * Uses two test strategies:
 *   1. Integration-style: MinimalFakeIDBFactory → IndexedDBVaultAdapter →
 *      VaultPersistenceService.  Tests the full stack without a browser.
 *
 *   2. Spy adapters: hand-rolled IVaultStorageAdapter stubs that control
 *      specific error paths (quota exceeded, verify failure, etc.).
 *
 * Covers all 6 IVaultPersistenceService methods plus NullVaultPersistenceService.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { VaultPersistenceService } from '../VaultPersistenceService'
import { NullVaultPersistenceService } from '../NullVaultPersistenceService'
import { IndexedDBVaultAdapter } from '../IndexedDBVaultAdapter'
import { VaultIntegrityChecker } from '../VaultIntegrityChecker'
import { MinimalFakeIDBFactory } from './helpers/MinimalFakeIDB'
import { WalletError } from '../../../domain/errors'
import type { IVaultStorageAdapter } from '../../../core/persistence/IVaultStorageAdapter'
import type {
  VaultStorageRecord,
  WalletListEntry,
  VerificationResult,
} from '../../../domain/storage'
import type { EncryptedVault } from '../../../domain/vault'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEncryptedVault(
  walletId: string,
  ciphertext = 'Y2lwaGVydGV4dA==',
  createdAt = 1_700_000_000_000,
): EncryptedVault {
  return {
    version: 1,
    walletId,
    crypto: {
      algorithm: 'AES-GCM',
      ciphertext,
      iv: 'AAAAAAAAAAAAAAAA', // 12 bytes (AES-GCM requirement)
      salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 32 bytes (PBKDF2 requirement)
      kdf: 'PBKDF2',
      kdfParams: { hash: 'SHA-256', iterations: 600_000, keyLength: 32 },
    },
    createdAt,
    updatedAt: createdAt,
  }
}

// ── Integration test factory ──────────────────────────────────────────────────

function makeService(): {
  service: VaultPersistenceService
  checker: VaultIntegrityChecker
  adapter: IndexedDBVaultAdapter
} {
  const factory = new MinimalFakeIDBFactory()
  const checker = new VaultIntegrityChecker()
  const adapter = new IndexedDBVaultAdapter(factory as unknown as IDBFactory, checker)
  const service = new VaultPersistenceService(adapter, checker)
  return { service, checker, adapter }
}

// ── Spy adapter helpers ───────────────────────────────────────────────────────

interface SpyAdapter extends IVaultStorageAdapter {
  readonly store: Map<string, VaultStorageRecord>
  readonly deleteCalls: string[]
}

function makeSpyAdapter(overrides: Partial<IVaultStorageAdapter> = {}): SpyAdapter {
  const store = new Map<string, VaultStorageRecord>()
  const deleteCalls: string[] = []
  const checker = new VaultIntegrityChecker()

  const base: SpyAdapter = {
    store,
    deleteCalls,

    async save(record) {
      if (store.has(record.walletId)) {
        throw new WalletError('VAULT_ALREADY_EXISTS', `'${record.walletId}' already exists.`)
      }
      store.set(record.walletId, record)
    },

    async load(walletId) {
      return store.get(walletId) ?? null
    },

    async replace(walletId, record) {
      if (!store.has(walletId)) {
        throw new WalletError('VAULT_NOT_FOUND', `'${walletId}' not found.`)
      }
      store.set(walletId, record)
    },

    async delete(walletId) {
      if (!store.has(walletId)) {
        throw new WalletError('VAULT_NOT_FOUND', `'${walletId}' not found.`)
      }
      deleteCalls.push(walletId)
      store.delete(walletId)
    },

    async exists(walletId) {
      return store.has(walletId)
    },

    async list(): Promise<WalletListEntry[]> {
      return [...store.values()]
        .map((r) => ({
          walletId: r.walletId,
          displayName: r.metadata.displayName,
          createdAt: r.encryptedVault.createdAt,
          updatedAt: r.encryptedVault.updatedAt,
          vm: r.metadata.vm,
        }))
        .sort((a, b) => a.createdAt - b.createdAt)
    },

    async verify(walletId): Promise<VerificationResult> {
      const r = store.get(walletId)
      if (!r) {
        return {
          valid: false,
          walletId,
          schemaVersion: 0,
          errorCode: 'VAULT_CORRUPTED',
          errorDetail: 'Record not found.',
        }
      }
      const valid = await checker.verify(r)
      if (!valid) {
        return {
          valid: false,
          walletId,
          schemaVersion: r.schemaVersion,
          errorCode: 'VAULT_CORRUPTED',
          errorDetail: 'HMAC checksum mismatch.',
        }
      }
      return { valid: true, walletId, schemaVersion: r.schemaVersion }
    },

    async clear() {
      store.clear()
    },
    ...overrides,
  }

  return base
}

// ── VaultPersistenceService.createWallet() ────────────────────────────────────

describe('VaultPersistenceService.createWallet()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('creates a record and resolves without throwing', async () => {
    const ev = makeEncryptedVault('w1')
    await expect(
      service.createWallet('w1', ev, { displayName: 'My Wallet', vm: 'evm' }),
    ).resolves.toBeUndefined()
  })

  it('persisted record can be loaded back', async () => {
    const ev = makeEncryptedVault('w2', 'abc123cipher')
    await service.createWallet('w2', ev, { displayName: 'Test', vm: 'svm' })
    const loaded = await service.loadWallet('w2')
    expect(loaded.crypto.ciphertext).toBe('abc123cipher')
    expect(loaded.walletId).toBe('w2')
  })

  it('stores correct schemaVersion in the record', async () => {
    const spy = makeSpyAdapter()
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)
    const ev = makeEncryptedVault('w-ver')
    await svc.createWallet('w-ver', ev, { displayName: 'Version Test', vm: 'evm' })
    const stored = spy.store.get('w-ver')
    expect(stored?.schemaVersion).toBe(1)
  })

  it('stores integrity checksum and algorithm', async () => {
    const spy = makeSpyAdapter()
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)
    const ev = makeEncryptedVault('w-int')
    await svc.createWallet('w-int', ev, { displayName: 'Integrity', vm: 'evm' })
    const stored = spy.store.get('w-int')
    expect(stored?.integrity.algorithm).toBe('HMAC-SHA-256')
    expect(stored?.integrity.checksum).toHaveLength(64)
  })

  it('checksum is keyed by walletId — different ids produce different checksums', async () => {
    const spy = makeSpyAdapter()
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)
    const ciphertext = 'same-ciphertext'
    await svc.createWallet('id-a', makeEncryptedVault('id-a', ciphertext), {
      displayName: 'A',
      vm: 'evm',
    })
    await svc.createWallet('id-b', makeEncryptedVault('id-b', ciphertext), {
      displayName: 'B',
      vm: 'evm',
    })
    const a = spy.store.get('id-a')?.integrity.checksum
    const b = spy.store.get('id-b')?.integrity.checksum
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).not.toBe(b)
  })

  it('stores correct public metadata', async () => {
    const spy = makeSpyAdapter()
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)
    const ev = makeEncryptedVault('w-meta')
    await svc.createWallet('w-meta', ev, { displayName: 'Custom Name', vm: 'native' })
    const stored = spy.store.get('w-meta')
    expect(stored?.metadata.displayName).toBe('Custom Name')
    expect(stored?.metadata.vm).toBe('native')
  })

  it('throws VAULT_ALREADY_EXISTS when walletId is a duplicate', async () => {
    const ev = makeEncryptedVault('dup')
    await service.createWallet('dup', ev, { displayName: 'First', vm: 'evm' })
    await expect(
      service.createWallet('dup', makeEncryptedVault('dup', 'other'), {
        displayName: 'Second',
        vm: 'evm',
      }),
    ).rejects.toMatchObject({ code: 'VAULT_ALREADY_EXISTS' })
  })

  it('propagates STORAGE_QUOTA_EXCEEDED from the adapter', async () => {
    const spy = makeSpyAdapter({
      async save() {
        throw new WalletError('STORAGE_QUOTA_EXCEEDED', 'Quota exceeded.')
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    await expect(
      svc.createWallet('w-quota', makeEncryptedVault('w-quota'), {
        displayName: 'Quota',
        vm: 'evm',
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' })
  })

  it('throws VAULT_CORRUPTED and issues compensating delete when post-write verify fails', async () => {
    const spy = makeSpyAdapter({
      async verify(walletId): Promise<VerificationResult> {
        return {
          valid: false,
          walletId,
          schemaVersion: 0,
          errorCode: 'VAULT_CORRUPTED',
          errorDetail: 'Simulated storage corruption.',
        }
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())

    await expect(
      svc.createWallet('w-corrupt', makeEncryptedVault('w-corrupt'), {
        displayName: 'C',
        vm: 'evm',
      }),
    ).rejects.toMatchObject({ code: 'VAULT_CORRUPTED' })

    expect(spy.deleteCalls).toContain('w-corrupt')
    expect(spy.store.has('w-corrupt')).toBe(false)
  })

  it('does not expose ciphertext in error messages', async () => {
    const sensitiveCiphertext = 'super-secret-base64-data'
    const spy = makeSpyAdapter({
      async save() {
        throw new WalletError('STORAGE_UNAVAILABLE', 'DB unavailable.')
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())

    let thrownMessage = ''
    try {
      await svc.createWallet('w-sec', makeEncryptedVault('w-sec', sensitiveCiphertext), {
        displayName: 'Sec',
        vm: 'evm',
      })
    } catch (err) {
      if (err instanceof Error) thrownMessage = err.message
    }
    expect(thrownMessage).not.toContain(sensitiveCiphertext)
  })
})

// ── VaultPersistenceService.loadWallet() ─────────────────────────────────────

describe('VaultPersistenceService.loadWallet()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('returns the EncryptedVault for an existing wallet', async () => {
    const ev = makeEncryptedVault('load-1', 'cipher-load-1')
    await service.createWallet('load-1', ev, { displayName: 'L1', vm: 'evm' })
    const loaded = await service.loadWallet('load-1')
    expect(loaded).toMatchObject({ walletId: 'load-1', crypto: { ciphertext: 'cipher-load-1' } })
  })

  it('throws VAULT_NOT_FOUND for a missing walletId', async () => {
    await expect(service.loadWallet('no-such-wallet')).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('throws VAULT_CORRUPTED when adapter.load detects corruption', async () => {
    const spy = makeSpyAdapter({
      async load(_walletId) {
        throw new WalletError('VAULT_CORRUPTED', 'Checksum mismatch.')
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    await expect(svc.loadWallet('corrupt-id')).rejects.toMatchObject({ code: 'VAULT_CORRUPTED' })
  })

  it('propagates STORAGE_VERSION_MISMATCH from adapter.load', async () => {
    const spy = makeSpyAdapter({
      async load(_walletId) {
        throw new WalletError('STORAGE_VERSION_MISMATCH', 'Schema too new.')
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    await expect(svc.loadWallet('versioned-id')).rejects.toMatchObject({
      code: 'STORAGE_VERSION_MISMATCH',
    })
  })

  it('round-trips multiple wallets without cross-contamination', async () => {
    const ev1 = makeEncryptedVault('rt-1', 'cipher-rt-1')
    const ev2 = makeEncryptedVault('rt-2', 'cipher-rt-2')
    await service.createWallet('rt-1', ev1, { displayName: 'RT1', vm: 'evm' })
    await service.createWallet('rt-2', ev2, { displayName: 'RT2', vm: 'svm' })
    const loaded1 = await service.loadWallet('rt-1')
    const loaded2 = await service.loadWallet('rt-2')
    expect(loaded1.crypto.ciphertext).toBe('cipher-rt-1')
    expect(loaded2.crypto.ciphertext).toBe('cipher-rt-2')
  })
})

// ── VaultPersistenceService.deleteWallet() ────────────────────────────────────

describe('VaultPersistenceService.deleteWallet()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('removes the record — loadWallet throws VAULT_NOT_FOUND afterwards', async () => {
    const ev = makeEncryptedVault('del-1')
    await service.createWallet('del-1', ev, { displayName: 'Del', vm: 'evm' })
    await service.deleteWallet('del-1')
    await expect(service.loadWallet('del-1')).rejects.toMatchObject({ code: 'VAULT_NOT_FOUND' })
  })

  it('removes the record from listWallets()', async () => {
    const ev = makeEncryptedVault('del-list')
    await service.createWallet('del-list', ev, { displayName: 'ToDelete', vm: 'evm' })
    await service.deleteWallet('del-list')
    const list = await service.listWallets()
    expect(list.find((e) => e.walletId === 'del-list')).toBeUndefined()
  })

  it('throws VAULT_NOT_FOUND when deleting a non-existent walletId', async () => {
    await expect(service.deleteWallet('ghost-wallet')).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('does not affect other wallets', async () => {
    await service.createWallet('keep', makeEncryptedVault('keep'), {
      displayName: 'Keep',
      vm: 'evm',
    })
    await service.createWallet('gone', makeEncryptedVault('gone'), {
      displayName: 'Gone',
      vm: 'evm',
    })
    await service.deleteWallet('gone')
    const loaded = await service.loadWallet('keep')
    expect(loaded.walletId).toBe('keep')
  })
})

// ── VaultPersistenceService.rotatePassword() ──────────────────────────────────

describe('VaultPersistenceService.rotatePassword()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('replaces the stored ciphertext — loadWallet returns the new EncryptedVault', async () => {
    const ev = makeEncryptedVault('rot-1', 'old-ciphertext')
    await service.createWallet('rot-1', ev, { displayName: 'Rotate', vm: 'evm' })

    const newEv = makeEncryptedVault('rot-1', 'new-ciphertext')
    await service.rotatePassword('rot-1', newEv)

    const loaded = await service.loadWallet('rot-1')
    expect(loaded.crypto.ciphertext).toBe('new-ciphertext')
  })

  it('preserves public metadata (displayName and vm) after rotation', async () => {
    const ev = makeEncryptedVault('rot-meta')
    await service.createWallet('rot-meta', ev, { displayName: 'Precious Name', vm: 'svm' })

    const newEv = makeEncryptedVault('rot-meta', 'rotated-cipher')
    await service.rotatePassword('rot-meta', newEv)

    const list = await service.listWallets()
    const entry = list.find((e) => e.walletId === 'rot-meta')
    expect(entry?.displayName).toBe('Precious Name')
    expect(entry?.vm).toBe('svm')
  })

  it('recomputes the integrity checksum for the new ciphertext', async () => {
    const spy = makeSpyAdapter()
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)

    const ev = makeEncryptedVault('rot-check', 'old-ct')
    await svc.createWallet('rot-check', ev, { displayName: 'RC', vm: 'evm' })
    const oldChecksum = spy.store.get('rot-check')?.integrity.checksum

    const newEv = makeEncryptedVault('rot-check', 'new-ct')
    await svc.rotatePassword('rot-check', newEv)
    const newChecksum = spy.store.get('rot-check')?.integrity.checksum

    expect(newChecksum).toHaveLength(64)
    expect(newChecksum).not.toBe(oldChecksum)
  })

  it('throws VAULT_NOT_FOUND when walletId does not exist', async () => {
    const newEv = makeEncryptedVault('ghost', 'new-cipher')
    await expect(service.rotatePassword('ghost', newEv)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('preserves the original record when replace() throws (atomic failure)', async () => {
    const spy = makeSpyAdapter({
      async replace(_walletId, _record) {
        throw new WalletError('STORAGE_UNAVAILABLE', 'IDB transaction aborted.')
      },
    })
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)

    const ev = makeEncryptedVault('atomic', 'original-cipher')
    await svc.createWallet('atomic', ev, { displayName: 'Atomic', vm: 'evm' })

    const newEv = makeEncryptedVault('atomic', 'rotated-cipher')
    await expect(svc.rotatePassword('atomic', newEv)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })

    expect(spy.store.get('atomic')?.encryptedVault.crypto.ciphertext).toBe('original-cipher')
  })

  it('throws VAULT_CORRUPTED when post-rotation verify fails', async () => {
    let verifyCallCount = 0
    const spy = makeSpyAdapter({
      async verify(walletId): Promise<VerificationResult> {
        verifyCallCount++
        if (verifyCallCount === 1) {
          return { valid: true, walletId, schemaVersion: 1 }
        }
        return {
          valid: false,
          walletId,
          schemaVersion: 0,
          errorCode: 'VAULT_CORRUPTED',
          errorDetail: 'Simulated post-rotation corruption.',
        }
      },
    })
    const checker = new VaultIntegrityChecker()
    const svc = new VaultPersistenceService(spy, checker)

    const ev = makeEncryptedVault('rot-corrupt', 'original')
    await svc.createWallet('rot-corrupt', ev, { displayName: 'C', vm: 'evm' })

    const newEv = makeEncryptedVault('rot-corrupt', 'new-cipher')
    await expect(svc.rotatePassword('rot-corrupt', newEv)).rejects.toMatchObject({
      code: 'VAULT_CORRUPTED',
    })
    expect(verifyCallCount).toBe(2)
  })
})

// ── VaultPersistenceService.listWallets() ─────────────────────────────────────

describe('VaultPersistenceService.listWallets()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('returns an empty array when no wallets exist', async () => {
    await expect(service.listWallets()).resolves.toEqual([])
  })

  it('returns public entry for a single wallet', async () => {
    const ev = makeEncryptedVault('list-1', 'ct', 1_700_000_001_000)
    await service.createWallet('list-1', ev, { displayName: 'List One', vm: 'evm' })
    const entries = await service.listWallets()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      walletId: 'list-1',
      displayName: 'List One',
      vm: 'evm',
    })
  })

  it('sorts multiple wallets by createdAt ascending', async () => {
    await service.createWallet('newest', makeEncryptedVault('newest', 'c', 1_700_000_003_000), {
      displayName: 'Newest',
      vm: 'evm',
    })
    await service.createWallet('oldest', makeEncryptedVault('oldest', 'c', 1_700_000_001_000), {
      displayName: 'Oldest',
      vm: 'evm',
    })
    await service.createWallet('middle', makeEncryptedVault('middle', 'c', 1_700_000_002_000), {
      displayName: 'Middle',
      vm: 'evm',
    })
    const entries = await service.listWallets()
    expect(entries.map((e) => e.walletId)).toEqual(['oldest', 'middle', 'newest'])
  })

  it('does not include ciphertext or key material in entries', async () => {
    const ev = makeEncryptedVault('no-ct', 'sensitive-ciphertext')
    await service.createWallet('no-ct', ev, { displayName: 'Secure', vm: 'evm' })
    const entries = await service.listWallets()
    const entry = entries[0]
    expect(JSON.stringify(entry)).not.toContain('sensitive-ciphertext')
    expect(JSON.stringify(entry)).not.toContain('ciphertext')
    expect(JSON.stringify(entry)).not.toContain('AES-GCM')
  })

  it('reflects deletions immediately', async () => {
    await service.createWallet('a', makeEncryptedVault('a'), { displayName: 'A', vm: 'evm' })
    await service.createWallet('b', makeEncryptedVault('b'), { displayName: 'B', vm: 'evm' })
    await service.deleteWallet('a')
    const entries = await service.listWallets()
    expect(entries).toHaveLength(1)
    expect(entries[0].walletId).toBe('b')
  })
})

// ── VaultPersistenceService.verifyIntegrity() ─────────────────────────────────

describe('VaultPersistenceService.verifyIntegrity()', () => {
  let service: VaultPersistenceService

  beforeEach(() => {
    ;({ service } = makeService())
  })

  it('returns valid:true for a freshly-created wallet', async () => {
    const ev = makeEncryptedVault('vi-1')
    await service.createWallet('vi-1', ev, { displayName: 'VI', vm: 'evm' })
    const result = await service.verifyIntegrity('vi-1')
    expect(result.valid).toBe(true)
    expect(result.walletId).toBe('vi-1')
    expect(result.schemaVersion).toBe(1)
  })

  it('returns valid:false for a missing walletId', async () => {
    const result = await service.verifyIntegrity('does-not-exist')
    expect(result.valid).toBe(false)
    expect(result.walletId).toBe('does-not-exist')
  })

  it('returns valid:false for a corrupted record', async () => {
    const spy = makeSpyAdapter({
      async verify(walletId): Promise<VerificationResult> {
        return {
          valid: false,
          walletId,
          schemaVersion: 1,
          errorCode: 'VAULT_CORRUPTED',
          errorDetail: 'Checksum mismatch.',
        }
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    const result = await svc.verifyIntegrity('bad-record')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VAULT_CORRUPTED')
  })

  it('never throws — always resolves', async () => {
    await expect(service.verifyIntegrity('any-id')).resolves.toBeDefined()
  })

  it('returns valid:true after successful rotatePassword', async () => {
    const ev = makeEncryptedVault('vi-rot', 'old-ct')
    await service.createWallet('vi-rot', ev, { displayName: 'VI Rot', vm: 'evm' })
    await service.rotatePassword('vi-rot', makeEncryptedVault('vi-rot', 'new-ct'))
    const result = await service.verifyIntegrity('vi-rot')
    expect(result.valid).toBe(true)
  })
})

// ── NullVaultPersistenceService ───────────────────────────────────────────────

describe('NullVaultPersistenceService', () => {
  const nullService = new NullVaultPersistenceService()
  const ev = makeEncryptedVault('null-w')

  it('createWallet() throws STORAGE_UNAVAILABLE', async () => {
    await expect(
      nullService.createWallet('null-w', ev, { displayName: 'N', vm: 'evm' }),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
  })

  it('loadWallet() throws STORAGE_UNAVAILABLE', async () => {
    await expect(nullService.loadWallet('null-w')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })

  it('deleteWallet() throws STORAGE_UNAVAILABLE', async () => {
    await expect(nullService.deleteWallet('null-w')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })

  it('rotatePassword() throws STORAGE_UNAVAILABLE', async () => {
    await expect(nullService.rotatePassword('null-w', ev)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })

  it('listWallets() throws STORAGE_UNAVAILABLE', async () => {
    await expect(nullService.listWallets()).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })

  it('verifyIntegrity() never throws — returns valid:false', async () => {
    const result = await nullService.verifyIntegrity('null-w')
    expect(result.valid).toBe(false)
    expect(result.walletId).toBe('null-w')
    expect(result.errorCode).toBeDefined()
  })

  it('thrown errors are WalletError instances', async () => {
    try {
      await nullService.loadWallet('x')
    } catch (err) {
      expect(WalletError.isWalletError(err)).toBe(true)
    }
  })

  it('thrown error messages do not contain sensitive data patterns', async () => {
    try {
      await nullService.createWallet('x', ev, { displayName: 'N', vm: 'evm' })
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).not.toMatch(/mnemonic|seed|private|secret|key/i)
      }
    }
  })
})

// ── Security properties ───────────────────────────────────────────────────────

describe('VaultPersistenceService — security properties', () => {
  it('error messages never contain ciphertext', async () => {
    const sensitiveText = 'super-secret-base64-aes-gcm-ciphertext'
    const spy = makeSpyAdapter({
      async save() {
        throw new WalletError('STORAGE_UNAVAILABLE', 'DB down.')
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    let thrownErr: Error | null = null
    try {
      await svc.createWallet('s1', makeEncryptedVault('s1', sensitiveText), {
        displayName: 'S',
        vm: 'evm',
      })
    } catch (err) {
      if (err instanceof Error) thrownErr = err
    }
    expect(thrownErr).not.toBeNull()
    expect(thrownErr!.message).not.toContain(sensitiveText)
  })

  it('WalletError.internalCause is not forwarded in the public message', async () => {
    const spy = makeSpyAdapter({
      async load() {
        throw new WalletError('VAULT_CORRUPTED', 'Corrupted.', new Error('internal debug info'))
      },
    })
    const svc = new VaultPersistenceService(spy, new VaultIntegrityChecker())
    try {
      await svc.loadWallet('w')
    } catch (err) {
      if (WalletError.isWalletError(err)) {
        expect(err.message).not.toContain('internal debug info')
      }
    }
  })
})
