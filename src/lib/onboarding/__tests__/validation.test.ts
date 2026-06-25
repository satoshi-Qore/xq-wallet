/**
 * validation.test.ts
 *
 * Comprehensive tests for all pure validation functions:
 * validatePassword, validatePasswordMatch, validatePasswordPair,
 * validateMnemonicWords, mnemonicSummaryError, pickVerifyIndices,
 * checkVerifyAnswers, isImportWordCount.
 */

import { describe, it, expect } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  IMPORT_WORD_COUNTS,
  isImportWordCount,
  validatePassword,
  validatePasswordMatch,
  validatePasswordPair,
  validateMnemonicWords,
  mnemonicSummaryError,
  pickVerifyIndices,
  checkVerifyAnswers,
} from '../validation'

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'

// ─── MIN_PASSWORD_LENGTH ───────────────────────────────────────────────────

describe('MIN_PASSWORD_LENGTH', () => {
  it('is 8', () => expect(MIN_PASSWORD_LENGTH).toBe(8))
})

// ─── IMPORT_WORD_COUNTS ────────────────────────────────────────────────────

describe('IMPORT_WORD_COUNTS', () => {
  it('contains exactly 5 values', () => expect(IMPORT_WORD_COUNTS).toHaveLength(5))
  it('contains 12', () => expect(IMPORT_WORD_COUNTS).toContain(12))
  it('contains 15', () => expect(IMPORT_WORD_COUNTS).toContain(15))
  it('contains 18', () => expect(IMPORT_WORD_COUNTS).toContain(18))
  it('contains 21', () => expect(IMPORT_WORD_COUNTS).toContain(21))
  it('contains 24', () => expect(IMPORT_WORD_COUNTS).toContain(24))
})

// ─── isImportWordCount ─────────────────────────────────────────────────────

describe('isImportWordCount()', () => {
  it('returns true for 12', () => expect(isImportWordCount(12)).toBe(true))
  it('returns true for 24', () => expect(isImportWordCount(24)).toBe(true))
  it('returns false for 11', () => expect(isImportWordCount(11)).toBe(false))
  it('returns false for 13', () => expect(isImportWordCount(13)).toBe(false))
  it('returns false for 0', () => expect(isImportWordCount(0)).toBe(false))
})

// ─── validatePassword() ────────────────────────────────────────────────────

describe('validatePassword()', () => {
  it('returns valid for exactly 8 characters', () => {
    const result = validatePassword('12345678')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns valid for long passwords', () => {
    expect(validatePassword('a'.repeat(100)).valid).toBe(true)
  })

  it('returns invalid for 7 characters', () => {
    const result = validatePassword('1234567')
    expect(result.valid).toBe(false)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('8')
  })

  it('returns invalid for empty string', () => {
    expect(validatePassword('').valid).toBe(false)
  })

  it('error message mentions the minimum length', () => {
    const { error } = validatePassword('short')
    expect(error).toContain(String(MIN_PASSWORD_LENGTH))
  })
})

// ─── validatePasswordMatch() ───────────────────────────────────────────────

describe('validatePasswordMatch()', () => {
  it('returns valid when passwords match', () => {
    const result = validatePasswordMatch('password1', 'password1')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns invalid when passwords differ', () => {
    const result = validatePasswordMatch('password1', 'password2')
    expect(result.valid).toBe(false)
    expect(result.error).not.toBeNull()
  })

  it('error message mentions mismatch or do not match', () => {
    const { error } = validatePasswordMatch('abc', 'xyz')
    expect(error?.toLowerCase()).toMatch(/match|mismatch/)
  })

  it('both empty is a match', () => {
    expect(validatePasswordMatch('', '').valid).toBe(true)
  })

  it('whitespace difference is detected', () => {
    expect(validatePasswordMatch('pass word', 'password').valid).toBe(false)
  })
})

// ─── validatePasswordPair() ────────────────────────────────────────────────

describe('validatePasswordPair()', () => {
  it('returns valid for matching passwords meeting minimum length', () => {
    expect(validatePasswordPair('correcthorse', 'correcthorse').valid).toBe(true)
  })

  it('returns invalid for short password (even if matching)', () => {
    const result = validatePasswordPair('short', 'short')
    expect(result.valid).toBe(false)
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH))
  })

  it('returns invalid for mismatched passwords', () => {
    const result = validatePasswordPair('longpassword1', 'longpassword2')
    expect(result.valid).toBe(false)
    expect(result.error?.toLowerCase()).toMatch(/match|mismatch/)
  })

  it('length is checked before mismatch', () => {
    // Both fail: too short AND mismatch. Length error should be returned.
    const result = validatePasswordPair('abc', 'xyz')
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH))
  })
})

// ─── validateMnemonicWords() ───────────────────────────────────────────────

describe('validateMnemonicWords()', () => {
  it('marks an all-empty 12-word array as incomplete', () => {
    const result = validateMnemonicWords(Array(12).fill(''))
    expect(result.isComplete).toBe(false)
    expect(result.isValid).toBe(false)
    expect(result.filledCount).toBe(0)
  })

  it('identifies unknown words', () => {
    const words = Array(12).fill('abandon')
    words[3] = 'notaword'
    const result = validateMnemonicWords(words)
    expect(result.unknownWordIndices).toContain(3)
  })

  it('marks all-known partial phrase as incomplete', () => {
    const words = Array(12).fill('abandon')
    words[11] = ''
    const result = validateMnemonicWords(words)
    expect(result.isComplete).toBe(false)
    expect(result.filledCount).toBe(11)
  })

  it('validates a correct 12-word mnemonic', () => {
    const result = validateMnemonicWords(VALID_12.split(' '))
    expect(result.isComplete).toBe(true)
    expect(result.unknownWordIndices).toHaveLength(0)
    expect(result.checksumValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  it('validates a correct 24-word mnemonic', () => {
    const result = validateMnemonicWords(VALID_24.split(' '))
    expect(result.isValid).toBe(true)
    expect(result.wordCount).toBe(24)
  })

  it('detects invalid checksum (wrong last word)', () => {
    const words = VALID_12.split(' ')
    words[11] = 'zoo' // valid BIP-39 word but wrong checksum
    const result = validateMnemonicWords(words)
    expect(result.checksumValid).toBe(false)
    expect(result.isValid).toBe(false)
  })

  it('checksumValid is null when phrase is incomplete', () => {
    const words = Array(12).fill('abandon')
    words[0] = ''
    const result = validateMnemonicWords(words)
    expect(result.checksumValid).toBeNull()
  })

  it('is case-insensitive for word lookup', () => {
    const words = VALID_12.split(' ').map((w) => w.toUpperCase())
    const result = validateMnemonicWords(words)
    expect(result.unknownWordIndices).toHaveLength(0)
    expect(result.isValid).toBe(true)
  })

  it('strips leading/trailing whitespace from each word', () => {
    const words = VALID_12.split(' ').map((w) => ` ${w} `)
    const result = validateMnemonicWords(words)
    expect(result.unknownWordIndices).toHaveLength(0)
    expect(result.isValid).toBe(true)
  })

  it('counts filled words correctly with sparse entries', () => {
    const words = ['abandon', '', 'abandon', '', 'abandon', '', '', '', '', '', '', '']
    const result = validateMnemonicWords(words)
    expect(result.filledCount).toBe(3)
  })
})

// ─── mnemonicSummaryError() ────────────────────────────────────────────────

describe('mnemonicSummaryError()', () => {
  it('returns null for a valid mnemonic', () => {
    const result = validateMnemonicWords(VALID_12.split(' '))
    expect(mnemonicSummaryError(result)).toBeNull()
  })

  it('returns null for empty input (not started yet)', () => {
    const result = validateMnemonicWords(Array(12).fill(''))
    expect(mnemonicSummaryError(result)).toBeNull()
  })

  it('returns unknown-word error when there are unknown words', () => {
    const words = Array(12).fill('abandon')
    words[2] = 'notaword'
    const result = validateMnemonicWords(words)
    const error = mnemonicSummaryError(result)
    expect(error).not.toBeNull()
    expect(error).toMatch(/word/)
  })

  it('returns checksum error when all words are known but checksum fails', () => {
    const words = VALID_12.split(' ')
    words[11] = 'zoo'
    const result = validateMnemonicWords(words)
    const error = mnemonicSummaryError(result)
    expect(error).not.toBeNull()
    expect(error?.toLowerCase()).toMatch(/checksum/)
  })

  it('uses plural for multiple unknown words', () => {
    const words = Array(12).fill('notaword')
    const result = validateMnemonicWords(words)
    const error = mnemonicSummaryError(result)
    expect(error).toMatch(/\d+ words/)
  })

  it('uses singular for one unknown word', () => {
    const words = VALID_12.split(' ')
    words[0] = 'notaword'
    const result = validateMnemonicWords(words)
    // Only 1 unknown, rest are filled with valid words
    const error = mnemonicSummaryError(result)
    expect(error).toMatch(/1 word[^s]/)
  })
})

// ─── pickVerifyIndices() ───────────────────────────────────────────────────

describe('pickVerifyIndices()', () => {
  it('returns exactly count indices', () => {
    const indices = pickVerifyIndices(12, 4)
    expect(indices).toHaveLength(4)
  })

  it('all indices are within [0, length)', () => {
    const indices = pickVerifyIndices(12, 4)
    indices.forEach((i) => {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(12)
    })
  })

  it('indices are unique', () => {
    const indices = pickVerifyIndices(12, 4)
    const unique = new Set(indices)
    expect(unique.size).toBe(4)
  })

  it('returns sorted ascending indices', () => {
    for (let n = 0; n < 20; n++) {
      const indices = pickVerifyIndices(24, 4)
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1])
      }
    }
  })

  it('clamps count to length', () => {
    const indices = pickVerifyIndices(3, 10)
    expect(indices).toHaveLength(3)
  })
})

// ─── checkVerifyAnswers() ──────────────────────────────────────────────────

describe('checkVerifyAnswers()', () => {
  it('returns true when all answers are correct', () => {
    const mnemonic = VALID_12
    const words = mnemonic.split(' ')
    const indices = [0, 3, 7, 11]
    const answers: Record<number, string> = {}
    indices.forEach((i) => {
      answers[i] = words[i]
    })
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(true)
  })

  it('returns false when one answer is wrong', () => {
    const mnemonic = VALID_12
    const indices = [0, 3, 7, 11]
    const answers: Record<number, string> = {
      0: 'abandon',
      3: 'abandon',
      7: 'abandon',
      11: 'wrong',
    }
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(false)
  })

  it('is case-insensitive', () => {
    const mnemonic = VALID_12
    const indices = [0]
    const answers: Record<number, string> = { 0: 'ABANDON' }
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(true)
  })

  it('ignores leading/trailing whitespace in answers', () => {
    const mnemonic = VALID_12
    const indices = [0]
    const answers: Record<number, string> = { 0: ' abandon ' }
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(true)
  })

  it('returns false when an answer is missing', () => {
    const mnemonic = VALID_12
    const indices = [0, 5]
    const answers: Record<number, string> = { 0: 'abandon' }
    // Index 5 is missing from answers
    expect(checkVerifyAnswers(mnemonic, indices, answers)).toBe(false)
  })

  it('returns true for empty indices array', () => {
    expect(checkVerifyAnswers(VALID_12, [], {})).toBe(true)
  })
})
