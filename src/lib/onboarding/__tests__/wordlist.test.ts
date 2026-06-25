/**
 * wordlist.test.ts
 *
 * Tests for isKnownWord() and getWordSuggestions() wordlist helpers.
 */

import { describe, it, expect } from 'vitest'
import { isKnownWord, getWordSuggestions, WORDLIST_SIZE } from '../wordlist'

// ─── WORDLIST_SIZE ─────────────────────────────────────────────────────────

describe('WORDLIST_SIZE', () => {
  it('is 2048', () => expect(WORDLIST_SIZE).toBe(2048))
})

// ─── isKnownWord() ─────────────────────────────────────────────────────────

describe('isKnownWord()', () => {
  it('returns true for "abandon" (first BIP-39 word)', () =>
    expect(isKnownWord('abandon')).toBe(true))

  it('returns true for "zoo" (last BIP-39 word)', () => expect(isKnownWord('zoo')).toBe(true))

  it('returns false for a made-up word', () => expect(isKnownWord('notaword')).toBe(false))

  it('is case-insensitive for uppercase input', () => expect(isKnownWord('ABANDON')).toBe(true))

  it('is case-insensitive for mixed case', () => expect(isKnownWord('AbAnDoN')).toBe(true))

  it('strips surrounding whitespace', () => expect(isKnownWord(' abandon ')).toBe(true))

  it('returns false for empty string', () => expect(isKnownWord('')).toBe(false))

  it('returns false for a valid word with typo', () => expect(isKnownWord('abadon')).toBe(false))

  it('returns true for "about"', () => expect(isKnownWord('about')).toBe(true))
})

// ─── getWordSuggestions() ──────────────────────────────────────────────────

describe('getWordSuggestions()', () => {
  it('returns empty array for empty prefix', () => expect(getWordSuggestions('')).toHaveLength(0))

  it('returns matches for prefix "aba"', () => {
    const suggestions = getWordSuggestions('aba')
    expect(suggestions.length).toBeGreaterThan(0)
    suggestions.forEach((w) => expect(w).toMatch(/^aba/))
  })

  it('respects the max parameter (default 5)', () => {
    const suggestions = getWordSuggestions('a', 3)
    expect(suggestions.length).toBeLessThanOrEqual(3)
  })

  it('default max is 5', () => {
    const suggestions = getWordSuggestions('a')
    expect(suggestions.length).toBeLessThanOrEqual(5)
  })

  it('returns empty for a prefix with no matches', () =>
    expect(getWordSuggestions('zzzz')).toHaveLength(0))

  it('exact match is included in suggestions', () => {
    const suggestions = getWordSuggestions('abandon')
    expect(suggestions).toContain('abandon')
  })

  it('all suggestions are lowercase BIP-39 words', () => {
    const suggestions = getWordSuggestions('ab', 10)
    suggestions.forEach((w) => {
      expect(w).toBe(w.toLowerCase())
      expect(isKnownWord(w)).toBe(true)
    })
  })

  it('is case-insensitive: "ABa" matches same as "aba"', () => {
    const lower = getWordSuggestions('aba')
    const upper = getWordSuggestions('ABA')
    expect(lower).toEqual(upper)
  })

  it('returns empty for a prefix with leading whitespace only', () =>
    expect(getWordSuggestions('   ')).toHaveLength(0))
})
