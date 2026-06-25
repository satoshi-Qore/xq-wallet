/**
 * validation.ts — Onboarding presentation-layer validation helpers.
 *
 * Pure functions only — no store imports, no service imports, no side effects.
 * Mirrors the invariants enforced by WalletService and the crypto layer so the
 * UI can surface errors immediately without a round-trip.
 *
 * Security: no secret data passes through here. Errors are safe to display.
 * Architecture: src/lib/onboarding/ is a UI-layer utility barrel.
 */

import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

// ─── Constants ─────────────────────────────────────────────────────────────

/** Minimum password length — must match WalletService.MIN_PASSWORD_LENGTH */
export const MIN_PASSWORD_LENGTH = 8

/** All BIP-39 word counts. Import supports all; create only generates 12 or 24. */
export const IMPORT_WORD_COUNTS = [12, 15, 18, 21, 24] as const
export type ImportWordCount = (typeof IMPORT_WORD_COUNTS)[number]

const IMPORT_WORD_COUNT_SET = new Set<number>(IMPORT_WORD_COUNTS)

export function isImportWordCount(n: number): n is ImportWordCount {
  return IMPORT_WORD_COUNT_SET.has(n)
}

// ─── Password Validation ───────────────────────────────────────────────────

export interface PasswordValidation {
  valid: boolean
  error: string | null
}

/**
 * Validates a password against the minimum length requirement.
 * Mirrors the check inside WalletService.assertValidPassword().
 */
export function validatePassword(password: string): PasswordValidation {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }
  return { valid: true, error: null }
}

/**
 * Checks that two password fields match.
 * Call validatePassword() first to ensure each field meets minimum length.
 */
export function validatePasswordMatch(password: string, confirm: string): PasswordValidation {
  if (password !== confirm) {
    return { valid: false, error: 'Passwords do not match.' }
  }
  return { valid: true, error: null }
}

/**
 * Validates both fields together.
 * Returns the first error found: length failure before mismatch.
 */
export function validatePasswordPair(password: string, confirm: string): PasswordValidation {
  const len = validatePassword(password)
  if (!len.valid) return len
  return validatePasswordMatch(password, confirm)
}

// ─── Mnemonic Validation ───────────────────────────────────────────────────

export interface MnemonicValidation {
  /**
   * Number of word slots in the current grid.
   * Derived from words.length — not independently validated here.
   */
  wordCount: number
  /** How many slots have a non-empty entry */
  filledCount: number
  /** 0-based indices of filled words that are not in the BIP-39 English wordlist */
  unknownWordIndices: number[]
  /**
   * BIP-39 checksum result.
   * null  — not enough words filled to check yet
   * true  — checksum valid
   * false — checksum invalid (wrong last word or corrupted phrase)
   */
  checksumValid: boolean | null
  /** All word slots contain a non-empty value */
  isComplete: boolean
  /** All slots filled, all words known, and checksum valid */
  isValid: boolean
}

/**
 * Validates the words array from the import phrase UI.
 * Does NOT throw — returns a structured result for per-word error highlighting.
 *
 * @param words - Array of strings (may contain empty strings for unfilled slots).
 */
export function validateMnemonicWords(words: string[]): MnemonicValidation {
  const wordCount = words.length
  const filledCount = words.filter((w) => w.trim().length > 0).length
  const isComplete = filledCount === wordCount && words.every((w) => w.trim().length > 0)

  const unknownWordIndices = words.reduce<number[]>((acc, w, i) => {
    const trimmed = w.trim().toLowerCase()
    if (trimmed.length > 0 && !wordlist.includes(trimmed)) {
      acc.push(i)
    }
    return acc
  }, [])

  let checksumValid: boolean | null = null
  if (isComplete && unknownWordIndices.length === 0) {
    try {
      checksumValid = validateMnemonic(words.map((w) => w.trim().toLowerCase()).join(' '), wordlist)
    } catch {
      checksumValid = false
    }
  }

  const isValid = isComplete && unknownWordIndices.length === 0 && checksumValid === true

  return { wordCount, filledCount, unknownWordIndices, checksumValid, isComplete, isValid }
}

/**
 * Returns a single human-readable error string for the mnemonic, or null.
 * Suitable for display below the word grid.
 */
export function mnemonicSummaryError(result: MnemonicValidation): string | null {
  if (result.unknownWordIndices.length > 0) {
    const n = result.unknownWordIndices.length
    return `${n} word${n === 1 ? '' : 's'} not recognised. Check your recovery phrase.`
  }
  if (result.checksumValid === false) {
    return 'Recovery phrase checksum is invalid. Please check all words are correct.'
  }
  return null
}

// ─── Verification Quiz Helpers ─────────────────────────────────────────────

/**
 * Picks `count` unique random indices from [0, length).
 * Deterministic for a given seed so tests can control randomness.
 */
export function pickVerifyIndices(length: number, count: number): number[] {
  const indices: number[] = []
  const pool = Array.from({ length }, (_, i) => i)
  for (let i = 0; i < Math.min(count, length); i++) {
    const pick = Math.floor(Math.random() * (pool.length - i)) + i
    ;[pool[i], pool[pick]] = [pool[pick], pool[i]]
    indices.push(pool[i])
  }
  return indices.sort((a, b) => a - b)
}

/**
 * Checks verification answers against the expected mnemonic.
 * @param mnemonic - Space-separated mnemonic string
 * @param indices  - Word indices that were quizzed
 * @param answers  - User's answers keyed by index
 */
export function checkVerifyAnswers(
  mnemonic: string,
  indices: number[],
  answers: Readonly<Record<number, string>>,
): boolean {
  const words = mnemonic.trim().split(/\s+/)
  return indices.every((i) => (answers[i] ?? '').trim().toLowerCase() === words[i].toLowerCase())
}
