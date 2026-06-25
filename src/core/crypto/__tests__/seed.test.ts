/**
 * seed.test.ts — Unit tests for BIP-39 seed derivation.
 *
 * BIP-39 seed test vectors from the official spec:
 *   https://github.com/trezor/python-mnemonic/blob/master/vectors.json
 *
 * The spec uses passphrase "TREZOR" for all vectors. We also test without
 * passphrase (empty string) for Sprint 2 usage.
 */

import { describe, it, expect } from 'vitest'
import { mnemonicToSeed } from '../seed'
import { WalletError } from '@/domain/errors'

// ─── BIP-39 Official Test Vectors ────────────────────────────────────────────
// Each entry: [mnemonic, passphrase, expected_seed_hex]
// Source: https://github.com/trezor/python-mnemonic/blob/master/vectors.json
const SPEC_VECTORS: [string, string, string][] = [
  [
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    'TREZOR',
    'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  ],
  [
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
    'TREZOR',
    '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
  ],
  [
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    'TREZOR',
    'd71de856f81a8acc65e6fc851a38d4d7ec216fd0796d0a6827a3ad6ed5511a30fa280f12eb2e47ed2ac03b5c462a0358d18d69fe4f985ec81778c1b370b652a8',
  ],
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Spec Vector Tests ────────────────────────────────────────────────────────

describe('mnemonicToSeed() — BIP-39 spec vectors', () => {
  for (const [mnemonic, passphrase, expectedHex] of SPEC_VECTORS) {
    const label = mnemonic.split(' ').slice(0, 3).join(' ') + '...'

    it(`produces the correct seed for "${label}" with passphrase "${passphrase}"`, async () => {
      const seed = await mnemonicToSeed(mnemonic, passphrase)
      // Full 64-byte (128 hex char) seed from the official spec.
      // startsWith on equal-length strings is equivalent to strict equality.
      const actualHex = toHex(seed)
      expect(actualHex.startsWith(expectedHex)).toBe(true)
    })
  }
})

// ─── Functional Tests ─────────────────────────────────────────────────────────

describe('mnemonicToSeed()', () => {
  const VALID_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  it('returns a Uint8Array', async () => {
    const seed = await mnemonicToSeed(VALID_MNEMONIC)
    expect(seed).toBeInstanceOf(Uint8Array)
  })

  it('returns exactly 64 bytes (512-bit seed)', async () => {
    const seed = await mnemonicToSeed(VALID_MNEMONIC)
    expect(seed.length).toBe(64)
  })

  it('is deterministic — same mnemonic produces same seed', async () => {
    const seed1 = await mnemonicToSeed(VALID_MNEMONIC)
    const seed2 = await mnemonicToSeed(VALID_MNEMONIC)
    expect(toHex(seed1)).toBe(toHex(seed2))
  })

  it('produces different seeds for different mnemonics', async () => {
    const seed1 = await mnemonicToSeed(VALID_MNEMONIC)
    const seed2 = await mnemonicToSeed(
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    )
    expect(toHex(seed1)).not.toBe(toHex(seed2))
  })

  it('produces different seeds with different passphrases', async () => {
    const seedNoPass = await mnemonicToSeed(VALID_MNEMONIC, '')
    const seedWithPass = await mnemonicToSeed(VALID_MNEMONIC, 'TREZOR')
    expect(toHex(seedNoPass)).not.toBe(toHex(seedWithPass))
  })

  it('normalises the mnemonic — uppercase input gives same seed as lowercase', async () => {
    const seedLower = await mnemonicToSeed(VALID_MNEMONIC)
    const seedUpper = await mnemonicToSeed(VALID_MNEMONIC.toUpperCase())
    expect(toHex(seedLower)).toBe(toHex(seedUpper))
  })

  it('normalises the mnemonic — extra whitespace gives same seed', async () => {
    const seedNormal = await mnemonicToSeed(VALID_MNEMONIC)
    const seedPadded = await mnemonicToSeed(`  ${VALID_MNEMONIC}  `)
    expect(toHex(seedNormal)).toBe(toHex(seedPadded))
  })

  it('normalises the mnemonic — extra internal spaces give same seed', async () => {
    const seedNormal = await mnemonicToSeed(VALID_MNEMONIC)
    const seedSpaced = await mnemonicToSeed(VALID_MNEMONIC.replace(/ /g, '   '))
    expect(toHex(seedNormal)).toBe(toHex(seedSpaced))
  })

  it('defaults passphrase to empty string', async () => {
    const seedExplicit = await mnemonicToSeed(VALID_MNEMONIC, '')
    const seedDefault = await mnemonicToSeed(VALID_MNEMONIC)
    expect(toHex(seedExplicit)).toBe(toHex(seedDefault))
  })

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('throws WalletError for an invalid mnemonic', async () => {
    await expect(mnemonicToSeed('not a valid mnemonic')).rejects.toBeInstanceOf(WalletError)
  })

  it("throws WalletError with code 'INVALID_MNEMONIC'", async () => {
    await expect(mnemonicToSeed('invalid mnemonic phrase')).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws for wrong word count (3 words)', async () => {
    await expect(mnemonicToSeed('abandon abandon abandon')).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws for invalid checksum', async () => {
    // 'about' changed to 'above' — wrong checksum
    const badChecksum =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon above'
    await expect(mnemonicToSeed(badChecksum)).rejects.toMatchObject({
      code: 'INVALID_MNEMONIC',
    })
  })

  it('throws WalletError (not a generic Error) for invalid mnemonic', async () => {
    try {
      await mnemonicToSeed('bad mnemonic')
      throw new Error('should have thrown')
    } catch (err) {
      expect(WalletError.isWalletError(err)).toBe(true)
    }
  })
})
