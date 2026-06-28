/**
 * IndexedDBVaultAdapter — unit tests.
 *
 * Uses MinimalFakeIDBFactory (no network, no real IDB).
 * Covers all 8 IVaultStorageAdapter methods plus error paths and security properties.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDBVaultAdapter } from '../IndexedDBVaultAdapter'
import { VaultIntegrityChecker } from '../VaultIntegrityChecker'
import { MinimalFakeIDBFactory } from './helpers/MinimalFakeIDB'
import { WalletError } from '../../../domain/errors'
import type { VaultStorageRecord } from '../../../domain/storage'
import type { EncryptedVault } from '../../../domain/vault'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEncryptedVault(walletId: string, ciphertext = 'Y2lwaGVydGV4dA=='): EncryptedVault {
  return {
    version: 1,
    walletId,
    crypto: {
      algorithm: 'AES-GCM',
      ciphertext,
      iv: 'aXZpdmVjdG9y',
      salt: 'c2FsdHNhbHQ=',
      kdf: 'PBKDF2',
      kdfParams: { hash: 'SHA-256', iterations: 600_000, keyLength: 32 },
    },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

async function makeRecord(
  walletId: string,
  displayName: string,
  ciphertext?: string,
): Promise<VaultStorageRecord> {
  const checker = new VaultIntegrityChecker()
  const ev = makeEncryptedVault(walletId, ciphertext)
  const checksum = await checker.computeChecksum(ev.crypto.ciphertext, walletId)
  return {
    walletId,
    schemaVersion: 1,
    encryptedVault: ev,
    metadata: { displayName, vm: 'evm' },
    integrity: { checksum, algorithm: 'HMAC-SHA-256' },
  }
}

// ── Test factory ──────────────────────────────────────────────────────────────

function makeAdapter(): IndexedDBVaultAdapter {
  const factory = new MinimalFakeIDBFactory()
  return new IndexedDBVaultAdapter(factory as unknown as IDBFactory)
}

// ── save() ────────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.save()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('persists a record without throwing', async () => {
    const record = await makeRecord('w1', 'Wallet One')
    await expect(adapter.save(record)).resolves.toBeUndefined()
  })

  it('throws VAULT_ALREADY_EXISTS on duplicate walletId', async () => {
    const record = await makeRecord('dup', 'Duplicate')
    await adapter.save(record)
    await expect(adapter.save(record)).rejects.toMatchObject({
      code: 'VAULT_ALREADY_EXISTS',
    })
  })

  it('VAULT_ALREADY_EXISTS is a WalletError', async () => {
    const record = await makeRecord('dup2', 'Dup2')
    await adapter.save(record)
    const err = await adapter.save(record).catch((e) => e)
    expect(WalletError.isWalletError(err)).toBe(true)
  })

  it('allows saving multiple different walletIds', async () => {
    const r1 = await makeRecord('wallet-1', 'One')
    const r2 = await makeRecord('wallet-2', 'Two')
    await expect(adapter.save(r1)).resolves.toBeUndefined()
    await expect(adapter.save(r2)).resolves.toBeUndefined()
  })
})

// ── load() ────────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.load()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('returns null for a non-existent walletId', async () => {
    await expect(adapter.load('ghost')).resolves.toBeNull()
  })

  it('returns the saved record', async () => {
    const record = await makeRecord('load-1', 'Load Test')
    await adapter.save(record)
    const loaded = await adapter.load('load-1')
    expect(loaded).not.toBeNull()
    expect(loaded!.walletId).toBe('load-1')
    expect(loaded!.metadata.displayName).toBe('Load Test')
  })

  it('preserves all VaultStorageRecord fields', async () => {
    const record = await makeRecord('load-2', 'Fields Test')
    await adapter.save(record)
    const loaded = await adapter.load('load-2')
    expect(loaded!.schemaVersion).toBe(1)
    expect(loaded!.encryptedVault.crypto.algorithm).toBe('AES-GCM')
    expect(loaded!.integrity.algorithm).toBe('HMAC-SHA-256')
  })

  it('throws VAULT_CORRUPTED when checksum is invalid', async () => {
    const record = await makeRecord('corrupt-1', 'Corrupt')
    // Manually tamper the checksum
    const corrupted: VaultStorageRecord = {
      ...record,
      integrity: { checksum: 'a'.repeat(64), algorithm: 'HMAC-SHA-256' },
    }
    // Bypass adapter.save() integrity check by saving a pre-built corrupted record
    // We directly save with a tampered checksum (save() does not verify the checksum)
    await adapter.save(corrupted)
    await expect(adapter.load('corrupt-1')).rejects.toMatchObject({
      code: 'VAULT_CORRUPTED',
    })
  })

  it('throws STORAGE_VERSION_MISMATCH when schemaVersion is too new', async () => {
    const record = await makeRecord('future-1', 'Future Schema')
    // Manually set a future schema version
    const futureRecord = { ...record, schemaVersion: 99 as 1 }
    await adapter.save(futureRecord)
    await expect(adapter.load('future-1')).rejects.toMatchObject({
      code: 'STORAGE_VERSION_MISMATCH',
    })
  })
})

// ── replace() ─────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.replace()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('throws VAULT_NOT_FOUND when walletId does not exist', async () => {
    const record = await makeRecord('ghost', 'Ghost')
    await expect(adapter.replace('ghost', record)).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('overwrites an existing record atomically', async () => {
    const original = await makeRecord('rep-1', 'Original', 'Y2lwaGVydGV4dA==')
    await adapter.save(original)

    const updated = await makeRecord('rep-1', 'Updated', 'bmV3Y2lwaGVydGV4dA==')
    await expect(adapter.replace('rep-1', updated)).resolves.toBeUndefined()

    const loaded = await adapter.load('rep-1')
    expect(loaded!.metadata.displayName).toBe('Updated')
    expect(loaded!.encryptedVault.crypto.ciphertext).toBe('bmV3Y2lwaGVydGV4dA==')
  })

  it('only the replaced wallet is affected — siblings unchanged', async () => {
    const r1 = await makeRecord('sibling-1', 'Sibling One')
    const r2 = await makeRecord('sibling-2', 'Sibling Two')
    await adapter.save(r1)
    await adapter.save(r2)

    const r2v2 = await makeRecord('sibling-2', 'Sibling Two Updated')
    await adapter.replace('sibling-2', r2v2)

    const loaded1 = await adapter.load('sibling-1')
    expect(loaded1!.metadata.displayName).toBe('Sibling One')
  })
})

// ── delete() ──────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.delete()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('throws VAULT_NOT_FOUND when walletId does not exist', async () => {
    await expect(adapter.delete('ghost')).rejects.toMatchObject({
      code: 'VAULT_NOT_FOUND',
    })
  })

  it('removes the record from storage', async () => {
    const record = await makeRecord('del-1', 'Delete Me')
    await adapter.save(record)
    await adapter.delete('del-1')
    await expect(adapter.load('del-1')).resolves.toBeNull()
  })

  it('does not affect sibling records', async () => {
    const r1 = await makeRecord('del-keep', 'Keep')
    const r2 = await makeRecord('del-gone', 'Gone')
    await adapter.save(r1)
    await adapter.save(r2)
    await adapter.delete('del-gone')
    await expect(adapter.load('del-keep')).resolves.not.toBeNull()
    await expect(adapter.load('del-gone')).resolves.toBeNull()
  })

  it('record is gone after delete — exists() returns false', async () => {
    const record = await makeRecord('del-2', 'Delete 2')
    await adapter.save(record)
    await adapter.delete('del-2')
    await expect(adapter.exists('del-2')).resolves.toBe(false)
  })
})

// ── exists() ──────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.exists()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('returns false for a non-existent walletId', async () => {
    await expect(adapter.exists('no-such-wallet')).resolves.toBe(false)
  })

  it('returns true after saving a record', async () => {
    const record = await makeRecord('ex-1', 'Exists Test')
    await adapter.save(record)
    await expect(adapter.exists('ex-1')).resolves.toBe(true)
  })

  it('returns false after deleting a record', async () => {
    const record = await makeRecord('ex-2', 'Delete Then Check')
    await adapter.save(record)
    await adapter.delete('ex-2')
    await expect(adapter.exists('ex-2')).resolves.toBe(false)
  })
})

// ── list() ────────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.list()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('returns an empty array when the store is empty', async () => {
    await expect(adapter.list()).resolves.toEqual([])
  })

  it('returns WalletListEntry objects (not full VaultStorageRecords)', async () => {
    const record = await makeRecord('lst-1', 'Listing Test')
    await adapter.save(record)
    const list = await adapter.list()
    expect(list).toHaveLength(1)
    const entry = list[0]
    // WalletListEntry shape
    expect(entry).toHaveProperty('walletId', 'lst-1')
    expect(entry).toHaveProperty('displayName', 'Listing Test')
    expect(entry).toHaveProperty('createdAt')
    expect(entry).toHaveProperty('updatedAt')
    expect(entry).toHaveProperty('vm', 'evm')
    // Must NOT expose encryptedVault or integrity
    expect(entry).not.toHaveProperty('encryptedVault')
    expect(entry).not.toHaveProperty('integrity')
    expect(entry).not.toHaveProperty('schemaVersion')
  })

  it('returns all saved wallets', async () => {
    await adapter.save(await makeRecord('m-1', 'M1'))
    await adapter.save(await makeRecord('m-2', 'M2'))
    await adapter.save(await makeRecord('m-3', 'M3'))
    const list = await adapter.list()
    expect(list).toHaveLength(3)
  })

  it('sorts by createdAt ascending', async () => {
    const checker = new VaultIntegrityChecker()

    // Create records with different createdAt timestamps
    const makeRecordAt = async (
      walletId: string,
      name: string,
      ts: number,
    ): Promise<VaultStorageRecord> => {
      const ev: EncryptedVault = {
        version: 1,
        walletId,
        crypto: {
          algorithm: 'AES-GCM',
          ciphertext: 'Y2lwaGVydGV4dA==',
          iv: 'aXZpdmVjdG9y',
          salt: 'c2FsdHNhbHQ=',
          kdf: 'PBKDF2',
          kdfParams: { hash: 'SHA-256', iterations: 600_000, keyLength: 32 },
        },
        createdAt: ts,
        updatedAt: ts,
      }
      const checksum = await checker.computeChecksum(ev.crypto.ciphertext, walletId)
      return {
        walletId,
        schemaVersion: 1,
        encryptedVault: ev,
        metadata: { displayName: name, vm: 'evm' },
        integrity: { checksum, algorithm: 'HMAC-SHA-256' },
      }
    }

    await adapter.save(await makeRecordAt('sort-c', 'C', 3_000))
    await adapter.save(await makeRecordAt('sort-a', 'A', 1_000))
    await adapter.save(await makeRecordAt('sort-b', 'B', 2_000))

    const list = await adapter.list()
    expect(list.map((e) => e.displayName)).toEqual(['A', 'B', 'C'])
  })

  it('does not include deleted wallets', async () => {
    await adapter.save(await makeRecord('keep', 'Keep'))
    await adapter.save(await makeRecord('gone', 'Gone'))
    await adapter.delete('gone')
    const list = await adapter.list()
    expect(list).toHaveLength(1)
    expect(list[0].walletId).toBe('keep')
  })
})

// ── verify() ─────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.verify()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('returns { valid: true } for an intact record', async () => {
    const record = await makeRecord('vfy-1', 'Verify OK')
    await adapter.save(record)
    const result = await adapter.verify('vfy-1')
    expect(result.valid).toBe(true)
    expect(result.walletId).toBe('vfy-1')
    expect(result.schemaVersion).toBe(1)
    expect(result.errorCode).toBeUndefined()
  })

  it('returns { valid: false, errorCode: VAULT_CORRUPTED } for a non-existent record', async () => {
    const result = await adapter.verify('no-such')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VAULT_CORRUPTED')
  })

  it('returns { valid: false, errorCode: VAULT_CORRUPTED } for a tampered checksum', async () => {
    const record = await makeRecord('vfy-tamper', 'Tampered')
    const tampered: VaultStorageRecord = {
      ...record,
      integrity: { checksum: 'b'.repeat(64), algorithm: 'HMAC-SHA-256' },
    }
    await adapter.save(tampered)
    const result = await adapter.verify('vfy-tamper')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VAULT_CORRUPTED')
  })

  it('returns { valid: false, errorCode: STORAGE_VERSION_MISMATCH } for a future schemaVersion', async () => {
    const record = await makeRecord('vfy-future', 'Future')
    const future = { ...record, schemaVersion: 99 as 1 }
    await adapter.save(future)
    const result = await adapter.verify('vfy-future')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('STORAGE_VERSION_MISMATCH')
    expect(result.schemaVersion).toBe(99)
  })

  it('never rejects — always resolves to a VerificationResult', async () => {
    await expect(adapter.verify('never-saved')).resolves.toMatchObject({ valid: false })
  })
})

// ── clear() ───────────────────────────────────────────────────────────────────

describe('IndexedDBVaultAdapter.clear()', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('empties the vault store', async () => {
    await adapter.save(await makeRecord('clr-1', 'Clear One'))
    await adapter.save(await makeRecord('clr-2', 'Clear Two'))
    await adapter.clear()
    await expect(adapter.list()).resolves.toEqual([])
  })

  it('clear() on an already-empty store resolves without error', async () => {
    await expect(adapter.clear()).resolves.toBeUndefined()
  })

  it('exists() returns false for all wallets after clear()', async () => {
    await adapter.save(await makeRecord('c1', 'One'))
    await adapter.save(await makeRecord('c2', 'Two'))
    await adapter.clear()
    await expect(adapter.exists('c1')).resolves.toBe(false)
    await expect(adapter.exists('c2')).resolves.toBe(false)
  })
})

// ── Round-trip and integration ─────────────────────────────────────────────────

describe('IndexedDBVaultAdapter — round-trip', () => {
  let adapter: IndexedDBVaultAdapter

  beforeEach(() => {
    adapter = makeAdapter()
  })

  it('save → load → verify → delete → exists round-trip succeeds', async () => {
    const record = await makeRecord('rt-1', 'Round Trip')
    await adapter.save(record)

    const loaded = await adapter.load('rt-1')
    expect(loaded).not.toBeNull()

    const vfy = await adapter.verify('rt-1')
    expect(vfy.valid).toBe(true)

    await adapter.delete('rt-1')
    await expect(adapter.exists('rt-1')).resolves.toBe(false)
  })

  it('save → replace → load sees updated content', async () => {
    const original = await makeRecord('rtr-1', 'Original', 'b3JpZ2luYWw=')
    await adapter.save(original)

    const replacement = await makeRecord('rtr-1', 'Replaced', 'cmVwbGFjZWQ=')
    await adapter.replace('rtr-1', replacement)

    const loaded = await adapter.load('rtr-1')
    expect(loaded!.metadata.displayName).toBe('Replaced')
    expect(loaded!.encryptedVault.crypto.ciphertext).toBe('cmVwbGFjZWQ=')
  })

  it('multiple independent adapters on the same factory share no state', async () => {
    // Two separate factories = two separate in-memory databases
    const a1 = makeAdapter()
    const a2 = makeAdapter()
    await a1.save(await makeRecord('shared-key', 'Adapter One'))
    await expect(a2.exists('shared-key')).resolves.toBe(false)
  })
})

// ── Security: no plaintext in error messages ──────────────────────────────────

describe('IndexedDBVaultAdapter — security properties', () => {
  it('WalletError.message never contains sensitive key material', async () => {
    // VAULT_NOT_FOUND path
    const notFoundErr = await makeAdapter()
      .delete('ghost-sec')
      .catch((e) => e)
    expect(WalletError.isWalletError(notFoundErr)).toBe(true)
    expect((notFoundErr as WalletError).message.toLowerCase()).not.toContain('mnemonic')
    expect((notFoundErr as WalletError).message.toLowerCase()).not.toContain('private key')
    expect((notFoundErr as WalletError).message.toLowerCase()).not.toContain('seed')
  })

  it('VAULT_CORRUPTED error message does not contain ciphertext', async () => {
    const adapter = makeAdapter()
    const record = await makeRecord('sec-corrupt', 'Security Corrupt')
    const tampered: VaultStorageRecord = {
      ...record,
      integrity: { checksum: 'd'.repeat(64), algorithm: 'HMAC-SHA-256' },
    }
    await adapter.save(tampered)
    const err = await adapter.load('sec-corrupt').catch((e) => e)
    expect(WalletError.isWalletError(err)).toBe(true)
    // Must not leak the ciphertext value into the error message
    expect((err as WalletError).message).not.toContain(record.encryptedVault.crypto.ciphertext)
  })
})
