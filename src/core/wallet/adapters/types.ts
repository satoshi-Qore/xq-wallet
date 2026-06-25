/**
 * types.ts — Input types for VM-specific address derivation adapters.
 *
 * Each adapter receives only what it needs:
 *   - EVM / Native: secp256k1 BIP-32 master node (from @scure/bip32)
 *   - SVM:          raw 64-byte seed (SLIP-0010 Ed25519 derives from the seed directly)
 *
 * Architecture: ARCHITECTURE.md §5.3 — Wallet Adapters
 */

import type { HDKey } from '@/core/crypto/hd'

// ─── Input Types ───────────────────────────────────────────────────────────

/** Input for the EVM address adapter. Uses secp256k1 BIP-32/BIP-44 derivation. */
export interface EvmDeriveInput {
  /** BIP-32 HD master key — created once per unlock from the 64-byte seed */
  readonly masterNode: HDKey
  /** Account-level index (0-based). Determines derivation path depth. */
  readonly accountIndex: number
}

/**
 * Input for the SVM address adapter.
 *
 * Receives the raw 64-byte seed rather than an HDKey because SLIP-0010 for
 * Ed25519 derives its master key via HMAC-SHA512("ed25519 seed", seed) —
 * a completely separate spec from secp256k1 BIP-32 used by @scure/bip32.
 *
 * Security: seed is sensitive — callers MUST zero it (seed.fill(0)) immediately
 * after the call returns or throws. (SEC-01)
 */
export interface SvmDeriveInput {
  /** 64-byte BIP-39 seed. Must be zeroed by the caller after use. */
  readonly seed: Uint8Array
  /** Account-level index (0-based). */
  readonly accountIndex: number
  /** Chain identifier stored in the returned SVMAddressEntry (e.g. "solana"). */
  readonly chainId: string
}

/** Input for the Native (QoreChain) address adapter. Uses secp256k1 BIP-32/BIP-44 derivation. */
export interface NativeDeriveInput {
  /** BIP-32 HD master key */
  readonly masterNode: HDKey
  /** Account-level index (0-based). */
  readonly accountIndex: number
  /** Chain identifier stored in the returned NativeAddressEntry (e.g. "qorechain-devnet"). */
  readonly chainId: string
}
