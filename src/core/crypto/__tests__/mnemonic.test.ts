/**
 * mnemonic.test.ts — Unit tests for BIP-39 mnemonic generation, validation, normalisation.
 *
 * Test vectors sourced from the official BIP-39 reference implementation:
 *   https://github.com/trezor/python-mnemonic/blob/master/vectors.json
 */

import { describe, it, expect } from 'vitest'
import { generate, validate, normalize } from '../mnemonic'

// ─── Official BIP-39 Test Vectors (English) ─────────────────────────────────
// entropy → mnemonic mapping from the spec.
// These are deterministic given the entropy — we test the inverse (is the
// mnemonic valid?) since generate() uses a random entropy source.
const VALID_12_WORD =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const VALID_12_WORD_2 =
  'legal winner thank year wave sausage worth useful legal winner thank yellow'

const VALID_12_WORD_3 =
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'

const VALID_24_WORD =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

// ─── generate() ──────────────────────────────────────────────────────────────

describe('generate()', () => {
  it('returns 12 words when called with wordCount 12 (default)', () => {
    const m = generate(12)
    expect(m.trim().split(' ')).toHaveLength(12)
  })

  it('returns 12 words when called without arguments (default is 12)', () => {
    const m = generate()
    expect(m.trim().split(' ')).toHaveLength(12)
  })

  it('returns 24 words when called with wordCount 24', () => {
    const m = generate(24)
    expect(m.trim().split(' ')).toHaveLength(24)
  })

  it('produces a checksum-valid 12-word mnemonic', () => {
    const m = generate(12)
    expect(validate(m)).toBe(true)
  })

  it('produces a checksum-valid 24-word mnemonic', () => {
    const m = generate(24)
    expect(validate(m)).toBe(true)
  })

  it('returns lowercase words only', () => {
    const m = generate(12)
    expect(m).toBe(m.toLowerCase())
  })

  it('returns words separated by single spaces', () => {
    const m = generate(12)
    // Should match the pattern: word (space word)*
    expect(m).toMatch(/^\S+( \S+)*$/)
  })

  it('produces unique mnemonics on each call (probabilistic)', () => {
    // Birthday paradox: probability of collision in 12.7 attempts is negligible
    // for a 128-bit entropy space. 5 calls gives a collision probability of ~10^-36.
    const results = Array.from({ length: 5 }, () => generate(12))
    const unique = new Set(results)
    expect(unique.size).toBe(5)
  })
})

// ─── validate() ──────────────────────────────────────────────────────────────

describe('validate()', () => {
  describe('valid mnemonics', () => {
    it('returns true for valid 12-word BIP-39 vector 1', () => {
      expect(validate(VALID_12_WORD)).toBe(true)
    })

    it('returns true for valid 12-word BIP-39 vector 2', () => {
      expect(validate(VALID_12_WORD_2)).toBe(true)
    })

    it('returns true for valid 12-word BIP-39 vector 3', () => {
      expect(validate(VALID_12_WORD_3)).toBe(true)
    })

    it('returns true for valid 24-word BIP-39 vector', () => {
      expect(validate(VALID_24_WORD)).toBe(true)
    })

    it('returns true for valid mnemonic with uppercase input (case-insensitive)', () => {
      expect(validate(VALID_12_WORD.toUpperCase())).toBe(true)
    })

    it('returns true for valid mnemonic with mixed case', () => {
      expect(
        validate(
          'Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon Abandon About',
        ),
      ).toBe(true)
    })

    it('returns true for valid mnemonic with leading/trailing whitespace', () => {
      expect(validate(`  ${VALID_12_WORD}  `)).toBe(true)
    })

    it('returns true for valid mnemonic with multiple spaces between words', () => {
      expect(validate(VALID_12_WORD.replace(/ /g, '   '))).toBe(true)
    })
  })

  describe('invalid mnemonics', () => {
    it('returns false for wrong word count (3 words)', () => {
      expect(validate('abandon abandon abandon')).toBe(false)
    })

    it('returns false for wrong word count (11 words)', () => {
      expect(
        validate(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
        ),
      ).toBe(false)
    })

    it('returns false for wrong word count (13 words)', () => {
      expect(validate(`${VALID_12_WORD} abandon`)).toBe(false)
    })

    it('returns false for an unknown word in position 1', () => {
      const withUnknown = VALID_12_WORD.replace('abandon', 'notaword')
      expect(validate(withUnknown)).toBe(false)
    })

    it('returns false for an invalid checksum (words are valid but last word changed)', () => {
      // Replace 'about' (correct last word) with 'above' (wrong checksum)
      const badChecksum = VALID_12_WORD.replace(/about$/, 'above')
      expect(validate(badChecksum)).toBe(false)
    })

    it('returns false for all-same words (invalid checksum)', () => {
      expect(validate('abandon '.repeat(12).trim())).toBe(false)
    })

    it('returns false for an empty string', () => {
      expect(validate('')).toBe(false)
    })

    it('returns false for a plain sentence', () => {
      expect(validate('this is not a valid bip39 mnemonic phrase at all')).toBe(false)
    })
  })
})

// ─── normalize() ─────────────────────────────────────────────────────────────

describe('normalize()', () => {
  it('lowercases the entire input', () => {
    expect(normalize('ABANDON ABOUT')).toBe('abandon about')
  })

  it('trims leading whitespace', () => {
    expect(normalize('  hello world')).toBe('hello world')
  })

  it('trims trailing whitespace', () => {
    expect(normalize('hello world  ')).toBe('hello world')
  })

  it('trims both leading and trailing whitespace', () => {
    expect(normalize('   hello world   ')).toBe('hello world')
  })

  it('collapses multiple internal spaces to a single space', () => {
    expect(normalize('hello   world')).toBe('hello world')
  })

  it('collapses tabs to a single space', () => {
    expect(normalize('hello\tworld')).toBe('hello world')
  })

  it('applies NFKD Unicode normalisation', () => {
    // é can be represented as composed U+00E9 or decomposed e + U+0301
    const composed = 'é' // é (precomposed)
    const decomposed = 'é' // e + combining acute accent
    // After NFKD both should map to the same decomposed form
    expect(normalize(composed)).toBe(normalize(decomposed))
  })

  it('is idempotent — normalising twice gives the same result', () => {
    const once = normalize(VALID_12_WORD)
    const twice = normalize(once)
    expect(once).toBe(twice)
  })

  it('does not alter words that are already normalised', () => {
    expect(normalize(VALID_12_WORD)).toBe(VALID_12_WORD)
  })
})
