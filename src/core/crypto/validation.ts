/**
 * validation.ts — Granular BIP-39 mnemonic validation helpers.
 *
 * Provides targeted checks that return specific WalletError codes, enabling
 * the import UI to show precise per-word error highlighting rather than a
 * single generic "invalid mnemonic" message.
 *
 * Dependency note: All checksum logic is delegated to @scure/bip39 —
 * we never implement BIP-39 math ourselves.
 *
 * Architecture: ARCHITECTURE.md §5.1 — Validation
 * Security: PRIN-SEC-01 (errors must not contain mnemonic words)
 */

import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { WalletError } from '@/domain/errors'
import type { WordCount } from '@/domain/wallet'

// ─── Constants ─────────────────────────────────────────────────────────────

const VALID_WORD_COUNTS = new Set<number>([12, 24])

// ─── Individual Checks ─────────────────────────────────────────────────────

/**
 * Validates that the mnemonic has exactly 12 or 24 words.
 *
 * @param mnemonic - Raw mnemonic string (any case, any whitespace).
 * @returns The word count as WordCount (12 | 24) if valid.
 * @throws WalletError('INVALID_WORD_COUNT') if word count is not 12 or 24.
 */
export function validateWordCount(mnemonic: string): WordCount {
  const words = mnemonic.trim().split(/\s+/).filter(Boolean)
  const count = words.length

  if (!VALID_WORD_COUNTS.has(count)) {
    throw new WalletError('INVALID_WORD_COUNT', `Mnemonic must be 12 or 24 words. Got ${count}.`)
  }

  return count as WordCount
}

/**
 * Returns any words in the mnemonic that are NOT in the BIP-39 English wordlist.
 *
 * An empty array means all words are valid BIP-39 words.
 * Intended for UI use: highlight the specific word inputs that are wrong.
 *
 * @param mnemonic - Normalised mnemonic string (lowercase, single-spaced).
 *                   Call normalize() from mnemonic.ts first if input is raw.
 * @returns Array of unrecognised word strings (empty if all are valid).
 */
export function findUnknownWords(mnemonic: string): string[] {
  const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean)

  return words.filter((word) => !wordlist.includes(word))
}

/**
 * Validates the BIP-39 checksum embedded in the final word of the mnemonic.
 *
 * The checksum is the first ENT/32 bits of SHA-256(entropy), where ENT is
 * the entropy length in bits (128 for 12-word, 256 for 24-word). It is
 * encoded in the last word along with the last few entropy bits.
 *
 * Preconditions: word count must be valid and all words must be in the wordlist.
 * Returns false (not throws) to allow callers to distinguish checksum errors
 * from word-not-found errors.
 *
 * @param mnemonic - Normalised mnemonic string.
 * @returns true if the BIP-39 checksum is valid, false otherwise.
 */
export function isChecksumValid(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().toLowerCase().normalize('NFKD'), wordlist)
}

// ─── Compound Validation ───────────────────────────────────────────────────

/**
 * Fully validates a BIP-39 mnemonic and throws a typed WalletError on any failure.
 *
 * Runs checks in order — the first failure throws immediately:
 *   1. INVALID_WORD_COUNT — not 12 or 24 words
 *   2. UNKNOWN_WORD       — one or more words not in the BIP-39 wordlist
 *   3. INVALID_CHECKSUM   — last word encodes a wrong checksum
 *
 * On success, returns void. Callers can assume the mnemonic is safe to pass
 * to mnemonicToSeed().
 *
 * @param mnemonic - Raw mnemonic string (any case, any whitespace).
 * @throws WalletError with code 'INVALID_WORD_COUNT' | 'UNKNOWN_WORD' | 'INVALID_CHECKSUM'
 */
export function assertValidMnemonic(mnemonic: string): void {
  // Step 1: word count
  validateWordCount(mnemonic)

  // Step 2: wordlist membership
  const normalised = mnemonic.trim().toLowerCase().normalize('NFKD')
  const unknownWords = findUnknownWords(normalised)

  if (unknownWords.length > 0) {
    throw new WalletError(
      'UNKNOWN_WORD',
      // SECURITY: error message must not include the actual unknown words
      // (they could be partial mnemonic words — treat as sensitive)
      `${unknownWords.length} word(s) in your phrase are not in the BIP-39 wordlist. Check each word carefully.`,
    )
  }

  // Step 3: checksum
  if (!isChecksumValid(normalised)) {
    throw new WalletError(
      'INVALID_CHECKSUM',
      'The mnemonic checksum is invalid. The last word may be incorrect, or a word may be in the wrong position.',
    )
  }
}
