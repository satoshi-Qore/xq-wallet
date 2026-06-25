/**
 * IChainAdapter.ts — Common interface for all chain VM adapters.
 *
 * Each VM (EVM, SVM, Native) has a concrete implementation of this interface.
 * The AdapterFactory selects the correct adapter at runtime based on the VMType.
 *
 * Design principles:
 *   - Adapters are stateless singletons — safe to share across concurrent calls.
 *   - `sign()` accepts a pre-derived private key; the caller (WalletService) is
 *     responsible for zeroing it immediately after this call returns. (SEC-01)
 *   - `verify()` and `isValidAddress()` never throw for invalid cryptographic
 *     input — they return false. Only structural input errors (bad hex string
 *     format for publicKeyHex) throw a WalletError.
 *   - The adapter never stores, logs, or forwards any private key material.
 *
 * Architecture: ARCHITECTURE.md §7 — Chain Adapter Layer
 * Security: PRIN-SEC-01, PRIN-SEC-02
 */

import type { VMType } from '@/domain/chain'
import type { AddressEntry } from '@/domain/wallet'

// ─── Result / Parameter Types ──────────────────────────────────────────────

/**
 * Result returned by IChainAdapter.sign().
 *
 * EVM / Native: 64-byte compact secp256k1 ECDSA signature (r ‖ s).
 * SVM:          64-byte Ed25519 signature.
 */
export interface SignResult {
  /** Raw signature bytes. */
  readonly signature: Uint8Array
  /** Lowercase hex encoding of the signature bytes. */
  readonly signatureHex: string
}

/**
 * Parameters for IChainAdapter.verify().
 */
export interface VerifyParams {
  /**
   * Hex-encoded public key for the signing account.
   *
   * EVM / Native: 33-byte compressed secp256k1 public key (66 hex chars).
   * SVM:          32-byte Ed25519 public key (64 hex chars).
   */
  readonly publicKeyHex: string
  /** Original raw message bytes — identical to what was passed to sign(). */
  readonly message: Uint8Array
  /** Signature bytes as returned by sign(). */
  readonly signature: Uint8Array
}

// ─── IChainAdapter ─────────────────────────────────────────────────────────

/**
 * Common interface for all virtual-machine chain adapters.
 *
 * Implementations: EvmChainAdapter, SvmChainAdapter, NativeChainAdapter.
 * Factory: AdapterFactory.getAdapter(vm)
 */
export interface IChainAdapter {
  /** The virtual machine type this adapter handles. */
  readonly vm: VMType

  /**
   * Validates whether an address string is structurally correct for this VM.
   *
   * This is a format check only — it does not verify on-chain existence or
   * ownership. Returns false (never throws) for any invalid input.
   *
   * EVM / Native: must match /^0x[0-9a-fA-F]{40}$/
   * SVM:          must be valid base58-encoded 32-byte value
   *
   * @param address - Candidate address string.
   * @returns true if the address is well-formed, false otherwise.
   */
  isValidAddress(address: string): boolean

  /**
   * Returns the canonical display format of an address.
   *
   * EVM:    Applies EIP-55 mixed-case checksum encoding.
   * SVM:    Returns the address unchanged (base58 is already canonical).
   * Native: Returns lowercase hex (no checksum — format is provisional).
   *
   * @param address - Address string to format.
   * @returns Canonically formatted address.
   * @throws WalletError('INVALID_ADDRESS') if the address is structurally invalid.
   */
  formatAddress(address: string): string

  /**
   * Extracts the public key hex string from a derived AddressEntry.
   *
   * Validates that the entry's vm field matches this adapter's vm, then
   * returns entry.publicKeyHex directly.
   *
   * @param entry - Derived address entry from AccountMetadata.addresses.
   * @returns Hex-encoded public key bytes.
   * @throws WalletError('UNSUPPORTED_VM') if entry.vm does not match this adapter's vm.
   */
  getPublicKeyHex(entry: AddressEntry): string

  /**
   * Signs raw message bytes with a transiently provided private key.
   *
   * The adapter applies VM-appropriate pre-hashing before signing:
   *   EVM / Native: keccak256(message) — standard Ethereum signing convention.
   *   SVM:          raw message bytes — Ed25519 does not require pre-hashing.
   *
   * The private key is never stored, logged, or forwarded outside this call.
   * The caller MUST zero privateKey immediately after this method returns or throws.
   *
   * @param privateKey - 32-byte raw private key scalar.
   * @param message    - Raw bytes to sign. Pre-hashing is handled internally.
   * @returns SignResult containing signature bytes and lowercase hex encoding.
   * @throws WalletError('DERIVATION_FAILED') if the signing operation fails.
   */
  sign(privateKey: Uint8Array, message: Uint8Array): SignResult

  /**
   * Verifies a signature against the original message and a public key.
   *
   * The adapter applies the same pre-hashing as sign() before verification.
   * Returns false (never throws) for any cryptographically invalid input.
   *
   * @param params.publicKeyHex - Hex-encoded public key of the expected signer.
   * @param params.message      - Original raw message bytes (not pre-hashed).
   * @param params.signature    - Signature bytes from a prior sign() call.
   * @returns true if the signature is valid, false otherwise.
   * @throws WalletError('INVALID_ADDRESS') if publicKeyHex is not a valid hex string.
   */
  verify(params: VerifyParams): boolean
}
