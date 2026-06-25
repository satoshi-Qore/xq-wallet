/**
 * wordlist.ts — BIP-39 English wordlist helpers for the import UI.
 *
 * Provides autocomplete suggestions and word-level validation without
 * exposing the raw 2048-word array directly to component code.
 *
 * Security: the wordlist is public BIP-39 data. No secrets here.
 */

import { wordlist } from '@scure/bip39/wordlists/english'

/**
 * Returns true if the given word (case-insensitive, trimmed) is in the
 * BIP-39 English wordlist.
 */
export function isKnownWord(word: string): boolean {
  return wordlist.includes(word.trim().toLowerCase())
}

/**
 * Returns up to `max` BIP-39 English words that start with the given prefix.
 * Returns an empty array if prefix is empty or has no matches.
 *
 * @param prefix - The typed prefix (case-insensitive).
 * @param max    - Maximum suggestions to return. Default: 5.
 */
export function getWordSuggestions(prefix: string, max = 5): string[] {
  const trimmed = prefix.trim().toLowerCase()
  if (!trimmed) return []
  const matches: string[] = []
  for (const word of wordlist) {
    if (word.startsWith(trimmed)) {
      matches.push(word)
      if (matches.length >= max) break
    }
  }
  return matches
}

/** Total number of words in the BIP-39 English wordlist (always 2048). */
export const WORDLIST_SIZE = wordlist.length
