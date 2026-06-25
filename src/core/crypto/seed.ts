/**
 * seed.ts — BIP-39 seed derivation.
 *
 * Converts a mnemonic phrase into a 64-byte seed via PBKDF2-HMAC-SHA512
 * with 2048 iterations (BIP-39 specification §5).
 *
 * This function is async because @scure/bip39 delegates PBKDF2 to the Web Crypto
 * API (crypto.subtle.deriveBits), which is non-blocking. This keeps the UI
 * responsive during wallet unlock — critical on mobile or low-power hardware.
 *
 * The optional BIP-39 passphrase ("25th word") is distinct from the vault
 * password used in AES-GCM encryption. Sprint 2 does not expose the passphrase
 * in the UI; it defaults to the empty string per the BIP-39 spec.
 *
 * Architecture: ARCHITECTURE.md §5.2 — Seed Derivation
 * Security: PRIN-SEC-01 (mnemonic validated, not logged), PRIN-SEC-04
 */

import { mnemonicToSeed as scureMnemonicToSeed } from '@scure/bip39'
import { WalletError } from '@/domain/errors'
import { normalize, validate } from './mnemonic'

// ─── Seed Derivation ───────────────────────────────────────────────────────

/**
 * Derives a 64-byte BIP-39 seed from a mnemonic phrase.
 *
 * Steps performed:
 *   1. Normalise the mnemonic (trim, lowercase, NFKD, single-space)
 *   2. Validate with @scure/bip39 — word count, wordlist membership, checksum
 *   3. Derive the seed via PBKDF2-HMAC-SHA512 (2048 rounds, 512-bit output)
 *
 * The returned seed is passed directly to createMasterNode() in hd.ts.
 * It must not be stored, logged, or placed in any persistent state. (SEC-01)
 *
 * @param mnemonic - BIP-39 mnemonic phrase. Any case; extra whitespace tolerated.
 * @param passphrase - Optional BIP-39 passphrase ("25th word"). Default: empty string.
 *                     This is NOT the vault encryption password.
 * @returns Promise resolving to a 64-byte (512-bit) seed as Uint8Array.
 * @throws WalletError('INVALID_MNEMONIC') if the mnemonic fails validation.
 *
 * @example
 * const seed = await mnemonicToSeed(mnemonic)
 * const masterNode = createMasterNode(seed)
 * seed.fill(0) // zero out the seed buffer after use
 */
export async function mnemonicToSeed(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
  const normalised = normalize(mnemonic)

  if (!validate(normalised)) {
    throw new WalletError(
      'INVALID_MNEMONIC',
      'The mnemonic phrase is invalid. Ensure all words are correct and try again.',
    )
  }

  return scureMnemonicToSeed(normalised, passphrase)
}
