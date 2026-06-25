/**
 * validation.test.ts — Unit tests for granular BIP-39 validation helpers.
 *
 * Tests each check in isolation so the UI layer can provide precise error
 * messages per validation step (word count → unknown word → checksum).
 */

import { describe, it, expect } from 'vitest'
import {
  validateWordCount,
  findUnknownWords,
  isChecksumValid,
  assertValidMnemonic,
} from '../validation'
import { WalletError } from '@/domain/errors'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

// 12 valid BIP-39 words but wrong checksum (last word changed)
const BAD_CHECKSUM_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon above'

// ─── validateWordCount() ─────────────────────────────────────────────────────

describe('validateWordCount()', () => {
  it('returns 12 for a 12-word mnemonic', () => {
    expect(validateWordCount(VALID_12)).toBe(12)
  })

  it('returns 24 for a 24-word mnemonic', () => {
    expect(validateWordCount(VALID_24)).toBe(24)
  })

  it('ignores leading/trailing whitespace', () => {
    expect(validateWordCount(`  ${VALID_12}  `)).toBe(12)
  })

  it('ignores multiple internal spaces', () => {
    expect(validateWordCount(VALID_12.replace(/ /g, '   '))).toBe(12)
  })

  it("throws WalletError('INVALID_WORD_COUNT') for 3 words", () => {
    expect(() => validateWordCount('abandon abandon abandon')).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  it("throws WalletError('INVALID_WORD_COUNT') for 11 words", () => {
    const eleven = VALID_12.split(' ').slice(0, 11).join(' ')
    expect(() => validateWordCount(eleven)).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  it("throws WalletError('INVALID_WORD_COUNT') for 13 words", () => {
    expect(() => validateWordCount(`${VALID_12} extra`)).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  it("throws WalletError('INVALID_WORD_COUNT') for an empty string", () => {
    expect(() => validateWordCount('')).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  it('throws a WalletError instance (not a generic Error)', () => {
    expect(() => validateWordCount('too short')).toThrow(WalletError)
  })
})

// ─── findUnknownWords() ───────────────────────────────────────────────────────

describe('findUnknownWords()', () => {
  it('returns an empty array for a fully valid mnemonic', () => {
    expect(findUnknownWords(VALID_12)).toEqual([])
  })

  it('returns an empty array for a valid 24-word mnemonic', () => {
    expect(findUnknownWords(VALID_24)).toEqual([])
  })

  it('returns the unknown word when one word is invalid', () => {
    const withUnknown =
      'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const result = findUnknownWords(withUnknown)
    expect(result).toContain('notaword')
    expect(result).toHaveLength(1)
  })

  it('returns all unknown words when multiple words are invalid', () => {
    const withTwo =
      'notaword invalid abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const result = findUnknownWords(withTwo)
    expect(result).toContain('notaword')
    expect(result).toContain('invalid')
    expect(result).toHaveLength(2)
  })

  it('is case-insensitive (lowercases before checking)', () => {
    // "Abandon" (capitalised) should still be recognised as a BIP-39 word
    const withCapital =
      'Abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    expect(findUnknownWords(withCapital)).toEqual([])
  })

  it('returns an empty array even if the checksum word is wrong (word is still in wordlist)', () => {
    // "above" is in the BIP-39 wordlist — wrong for checksum but not an unknown word
    expect(findUnknownWords(BAD_CHECKSUM_12)).toEqual([])
  })

  it('returns the word that appears multiple times if it is invalid', () => {
    const repeated =
      'notaword notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const result = findUnknownWords(repeated)
    expect(result).toHaveLength(2)
    expect(result.every((w) => w === 'notaword')).toBe(true)
  })
})

// ─── isChecksumValid() ────────────────────────────────────────────────────────

describe('isChecksumValid()', () => {
  it('returns true for a valid 12-word mnemonic', () => {
    expect(isChecksumValid(VALID_12)).toBe(true)
  })

  it('returns true for a valid 24-word mnemonic', () => {
    expect(isChecksumValid(VALID_24)).toBe(true)
  })

  it('returns false when the last word is wrong (invalid checksum)', () => {
    expect(isChecksumValid(BAD_CHECKSUM_12)).toBe(false)
  })

  it('returns false for a completely invalid string', () => {
    expect(isChecksumValid('this is not a mnemonic at all foo bar baz qux quux')).toBe(false)
  })

  it('returns false for unknown words (cannot compute checksum)', () => {
    const withUnknown =
      'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    expect(isChecksumValid(withUnknown)).toBe(false)
  })
})

// ─── assertValidMnemonic() ────────────────────────────────────────────────────

describe('assertValidMnemonic()', () => {
  it('does not throw for a valid 12-word mnemonic', () => {
    expect(() => assertValidMnemonic(VALID_12)).not.toThrow()
  })

  it('does not throw for a valid 24-word mnemonic', () => {
    expect(() => assertValidMnemonic(VALID_24)).not.toThrow()
  })

  it('does not throw for valid mnemonic with extra whitespace', () => {
    expect(() => assertValidMnemonic(`  ${VALID_12}  `)).not.toThrow()
  })

  it('does not throw for valid mnemonic with uppercase words', () => {
    expect(() => assertValidMnemonic(VALID_12.toUpperCase())).not.toThrow()
  })

  // ── Priority ordering: word count checked first ─────────────────────────────

  it("throws 'INVALID_WORD_COUNT' for 3 words (before wordlist check)", () => {
    expect(() => assertValidMnemonic('notaword notaword notaword')).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  it("throws 'INVALID_WORD_COUNT' for 11 words", () => {
    const eleven = VALID_12.split(' ').slice(0, 11).join(' ')
    expect(() => assertValidMnemonic(eleven)).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORD_COUNT' }),
    )
  })

  // ── Wordlist check second ───────────────────────────────────────────────────

  it("throws 'UNKNOWN_WORD' for a 12-word mnemonic with one invalid word", () => {
    const withUnknown =
      'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    expect(() => assertValidMnemonic(withUnknown)).toThrowError(
      expect.objectContaining({ code: 'UNKNOWN_WORD' }),
    )
  })

  it("throws 'UNKNOWN_WORD' when multiple words are unknown", () => {
    const withTwo =
      'foo bar abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    expect(() => assertValidMnemonic(withTwo)).toThrowError(
      expect.objectContaining({ code: 'UNKNOWN_WORD' }),
    )
  })

  // ── Checksum check last ────────────────────────────────────────────────────

  it("throws 'INVALID_CHECKSUM' when all words are in the wordlist but checksum fails", () => {
    // All words are valid BIP-39 words, but "above" is wrong for checksum
    expect(() => assertValidMnemonic(BAD_CHECKSUM_12)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CHECKSUM' }),
    )
  })

  // ── Error type guarantee ────────────────────────────────────────────────────

  it('always throws a WalletError instance (not a generic Error)', () => {
    expect(() => assertValidMnemonic('bad phrase')).toThrow(WalletError)
  })

  it('error message does not contain the mnemonic words (SEC-01)', () => {
    // The unknown word itself should not appear in the error message
    const unknownWord = 'mycryptoword'
    const m = `${unknownWord} abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`
    try {
      assertValidMnemonic(m)
    } catch (err) {
      if (WalletError.isWalletError(err)) {
        expect(err.message).not.toContain(unknownWord)
      }
    }
  })
})
