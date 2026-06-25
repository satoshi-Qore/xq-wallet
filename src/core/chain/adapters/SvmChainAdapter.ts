/**
 * SvmChainAdapter.ts — Chain adapter for SVM (Solana-compatible) networks.
 *
 * Covers Solana and compatible chains (Eclipse, Sonic, etc.). Each SVM chain
 * has its own SLIP-0010 Ed25519 key pair — addresses are chain-specific.
 *
 * Signing algorithm:  Ed25519, message signed directly (no pre-hashing — Ed25519
 *                     internally applies SHA-512 as part of the signature scheme).
 * Address validation: base58-decode + length == 32 check.
 * Address formatting: base58 is already canonical — no transformation needed.
 *
 * Dependencies (all transitive via @scure/bip32 — no new installs needed):
 *   @noble/curves/ed25519  — Ed25519 sign / verify
 *   @scure/base            — base58 decode for validation
 *
 * Architecture: ARCHITECTURE.md §7.2 — SVM Chain Adapter
 * Security: PRIN-SEC-01 — private key never stored or forwarded.
 */

import { ed25519 } from '@noble/curves/ed25519'
import { base58 } from '@scure/base'
import { WalletError } from '@/domain/errors'
import type { AddressEntry } from '@/domain/wallet'
import type { IChainAdapter, SignResult, VerifyParams } from './IChainAdapter'

// ─── Helpers ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new WalletError('INVALID_ADDRESS', `Invalid hex string length: ${hex.length}`)
  }
  const result = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) {
      throw new WalletError('INVALID_ADDRESS', `Non-hex character in public key at position ${i}`)
    }
    result[i / 2] = byte
  }
  return result
}

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Chain adapter for SVM (Solana-compatible) virtual machines.
 *
 * Stateless singleton — instantiated once by AdapterFactory.
 */
export class SvmChainAdapter implements IChainAdapter {
  /** @inheritdoc */
  readonly vm = 'svm' as const

  /**
   * Validates an SVM address by attempting base58 decoding and checking
   * that the result is exactly 32 bytes (Ed25519 public key length).
   * @inheritdoc
   */
  isValidAddress(address: string): boolean {
    try {
      const decoded = base58.decode(address)
      return decoded.length === 32
    } catch {
      return false
    }
  }

  /**
   * SVM addresses are already in canonical base58 form — returns unchanged.
   * @inheritdoc
   */
  formatAddress(address: string): string {
    if (!this.isValidAddress(address)) {
      throw new WalletError(
        'INVALID_ADDRESS',
        `"${address}" is not a valid SVM address. Expected a base58-encoded 32-byte Ed25519 public key.`,
      )
    }
    return address
  }

  /** @inheritdoc */
  getPublicKeyHex(entry: AddressEntry): string {
    if (entry.vm !== 'svm') {
      throw new WalletError(
        'UNSUPPORTED_VM',
        `SvmChainAdapter requires an SVM address entry. Got: ${entry.vm}`,
      )
    }
    return entry.publicKeyHex
  }

  /**
   * Signs with Ed25519. Message bytes are passed directly — Ed25519 applies
   * internal SHA-512 hashing as part of the signature scheme (no pre-hashing).
   * Returns a 64-byte Ed25519 signature.
   * @inheritdoc
   */
  sign(privateKey: Uint8Array, message: Uint8Array): SignResult {
    try {
      const signature = ed25519.sign(message, privateKey)
      return { signature, signatureHex: bytesToHex(signature) }
    } catch (err) {
      throw new WalletError('DERIVATION_FAILED', 'SVM Ed25519 signing failed.', err)
    }
  }

  /**
   * Verifies an Ed25519 signature against the raw message and public key.
   * @inheritdoc
   */
  verify({ publicKeyHex, message, signature }: VerifyParams): boolean {
    try {
      const pubkeyBytes = hexToBytes(publicKeyHex)
      return ed25519.verify(signature, message, pubkeyBytes)
    } catch {
      return false
    }
  }
}
