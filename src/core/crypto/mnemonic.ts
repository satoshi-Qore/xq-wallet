/**
 * mnemonic.ts — BIP-39 mnemonic generation, validation, and normalisation.
 *
 * All functions are pure and stateless. No React, no Zustand, no browser DOM.
 * Uses @scure/bip39 (audited by Cure53) — no custom BIP-39 implementation.
 *
 * Architecture: ARCHITECTURE.md §5.1 — Mnemonic
 * Security: PRIN-SEC-04 (no Math.random), PRIN-SEC-01 (mnemonic never logged)
 */

import { generateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import type { WordCount } from '@/domain/wallet'

// ─── Generation ────────────────────────────────────────────────────────────

/**
 * Generates a new BIP-39 mnemonic phrase using cryptographically secure entropy.
 *
 * Internally uses @scure/bip39 which calls crypto.getRandomValues() — never
 * Math.random(). (SEC-04)
 *
 * Entropy mapping:
 *   12 words = 128 bits of entropy (16 bytes)
 *   24 words = 256 bits of entropy (32 bytes)
 *
 * @param wordCount - Number of words to generate. Default: 12.
 * @returns Space-separated lowercase mnemonic string. Words are from the BIP-39
 *          English wordlist. Checksum is embedded in the last word.
 */
export function generate(wordCount: WordCount = 12): string {
  const strength = wordCount === 12 ? 128 : 256
  return generateMnemonic(wordlist, strength)
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validates a BIP-39 mnemonic phrase.
 *
 * Internally checks:
 *   1. Word count is valid (12 or 24)
 *   2. Every word is in the BIP-39 English wordlist
 *   3. Checksum bits are correct (last word encodes a checksum)
 *
 * Normalises the input before validation — case-insensitive, trims whitespace.
 *
 * @param mnemonic - Raw mnemonic string. Any case, any whitespace.
 * @returns true if the mnemonic is a valid BIP-39 phrase, false otherwise.
 */
export function validate(mnemonic: string): boolean {
  return validateMnemonic(normalize(mnemonic), wordlist)
}

// ─── Normalisation ─────────────────────────────────────────────────────────

/**
 * Normalises a mnemonic string to canonical BIP-39 form.
 *
 * Operations applied (in order):
 *   1. trim()         — remove leading/trailing whitespace
 *   2. toLowerCase()  — BIP-39 wordlist is lowercase
 *   3. normalize('NFKD') — Unicode compatibility decomposition (BIP-39 spec §5)
 *   4. replace(/\s+/g, ' ') — collapse multiple spaces between words
 *
 * This is a pure transformation — it does NOT validate the result.
 * Use validate() or assertValidMnemonic() (from validation.ts) after normalising.
 *
 * @param mnemonic - Raw input string.
 * @returns Normalised mnemonic string.
 */
export function normalize(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().normalize('NFKD').replace(/\s+/g, ' ')
}
