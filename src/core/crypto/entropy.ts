/**
 * entropy.ts — Cryptographically secure random byte generation.
 *
 * This module is the single source of randomness for the entire crypto layer.
 * It wraps globalThis.crypto.getRandomValues, which is the same primitive
 * used internally by @scure/bip39 and @noble/hashes.
 *
 * Explicitly exposed here for transparency, testability, and to ensure the
 * rest of the codebase never accidentally reaches for Math.random() or any
 * other non-cryptographic source. (SEC-04: Math.random() is banned.)
 *
 * Runtime requirements:
 *   - Browser: Web Crypto API (all modern browsers)
 *   - Node.js: 20+ (ships globalThis.crypto unconditionally)
 *              18–19 (available; Next.js 15 requires Node 18.18+)
 *
 * Architecture: ARCHITECTURE.md §5 — Crypto Layer
 * Security: PRIN-SEC-04
 */

/**
 * Generates `byteLength` cryptographically secure random bytes.
 *
 * @param byteLength - Number of bytes to generate. Must be a positive integer.
 * @returns A new Uint8Array filled with random bytes from the OS entropy pool.
 *
 * @example
 * // 16 bytes = 128 bits of entropy (for a 12-word mnemonic)
 * const entropy = secureRandomBytes(16)
 * // 32 bytes = 256 bits of entropy (for a 24-word mnemonic)
 * const entropy = secureRandomBytes(32)
 */
export function secureRandomBytes(byteLength: number): Uint8Array {
  const buffer = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(buffer)
  return buffer
}
