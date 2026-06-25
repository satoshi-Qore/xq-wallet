/**
 * src/core/crypto/index.ts — Public API for the cryptography layer.
 *
 * Import from this barrel rather than from individual files:
 *   import { generate, validate, mnemonicToSeed, createMasterNode } from '@/core/crypto'
 *
 * Nothing in this layer should be imported by React components directly.
 * Components call vaultService, which calls this layer.
 *
 * Architecture: ARCHITECTURE.md §5 — Crypto Layer
 */

// ── Mnemonic ─────────────────────────────────────────────────────────────
export { generate, validate, normalize } from './mnemonic'

// ── Seed Derivation ───────────────────────────────────────────────────────
export { mnemonicToSeed } from './seed'

// ── HD Key Operations ────────────────────────────────────────────────────
export { createMasterNode, derivePath, publicKeyToHex } from './hd'
export type { HDKey } from './hd'

// ── Granular Validation ───────────────────────────────────────────────────
// Used by the import-phrase UI step to show per-word error highlighting
export {
  validateWordCount,
  findUnknownWords,
  isChecksumValid,
  assertValidMnemonic,
} from './validation'

// ── Entropy ───────────────────────────────────────────────────────────────
// Exposed for testing and for any future utility that needs raw randomness
export { secureRandomBytes } from './entropy'
