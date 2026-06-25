/**
 * NativeChainAdapter.ts — Chain adapter for QoreChain's native VM.
 *
 * Uses the same secp256k1 curve as EVM but a distinct BIP-44 coin type (9999)
 * and derivation path, ensuring native addresses are completely independent
 * from EVM addresses for the same account index.
 *
 * Address format (Sprint 2 PLACEHOLDER):
 *   "0x" + lowercase 40-hex-char keccak256 digest — no EIP-55 checksum.
 *   The real QoreChain address encoding must be substituted before Sprint 3
 *   testnet deployment (hard blocker: QORECHAIN_INTEGRATION_PLAN.md §OQ-1).
 *
 * Signing algorithm:  ECDSA over secp256k1, message hashed with keccak256.
 * Address validation: /^0x[0-9a-fA-F]{40}$/ (same structure as EVM).
 * Address formatting: Returns lowercase hex (no checksum — format is TBD).
 *
 * Dependencies (all transitive via @scure/bip32 — no new installs needed):
 *   @noble/curves/secp256k1  — ECDSA sign / verify
 *   @noble/hashes/sha3       — keccak256
 *
 * Architecture: ARCHITECTURE.md §7.3 — Native Chain Adapter
 * Security: PRIN-SEC-01 — private key never stored or forwarded.
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
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

/** Pattern: '0x' prefix + exactly 40 hex characters (provisional native format). */
const NATIVE_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Chain adapter for QoreChain's native virtual machine.
 *
 * Stateless singleton — instantiated once by AdapterFactory.
 *
 * @remarks
 * The address format is provisional (keccak256-based hex) and MUST be replaced
 * with the official QoreChain address encoding before any testnet deployment.
 */
export class NativeChainAdapter implements IChainAdapter {
  /** @inheritdoc */
  readonly vm = 'native' as const

  /** @inheritdoc */
  isValidAddress(address: string): boolean {
    return NATIVE_ADDRESS_RE.test(address)
  }

  /**
   * Returns the address in lowercase hex form (no EIP-55 — not an EVM address).
   * @inheritdoc
   */
  formatAddress(address: string): string {
    if (!NATIVE_ADDRESS_RE.test(address)) {
      throw new WalletError(
        'INVALID_ADDRESS',
        `"${address}" is not a valid native address. Expected 0x followed by 40 hex characters.`,
      )
    }
    return `0x${address.slice(2).toLowerCase()}`
  }

  /** @inheritdoc */
  getPublicKeyHex(entry: AddressEntry): string {
    if (entry.vm !== 'native') {
      throw new WalletError(
        'UNSUPPORTED_VM',
        `NativeChainAdapter requires a native address entry. Got: ${entry.vm}`,
      )
    }
    return entry.publicKeyHex
  }

  /**
   * Signs using ECDSA over secp256k1. Message is keccak256-hashed before signing.
   * Returns a 64-byte compact (r ‖ s) signature.
   * @inheritdoc
   */
  sign(privateKey: Uint8Array, message: Uint8Array): SignResult {
    try {
      const msgHash = keccak_256(message)
      const sig = secp256k1.sign(msgHash, privateKey)
      const signature = sig.toCompactRawBytes()
      return { signature, signatureHex: bytesToHex(signature) }
    } catch (err) {
      throw new WalletError('DERIVATION_FAILED', 'Native ECDSA signing failed.', err)
    }
  }

  /**
   * Verifies an ECDSA signature. The message is keccak256-hashed before verification.
   * @inheritdoc
   */
  verify({ publicKeyHex, message, signature }: VerifyParams): boolean {
    try {
      const msgHash = keccak_256(message)
      const pubkeyBytes = hexToBytes(publicKeyHex)
      return secp256k1.verify(signature, msgHash, pubkeyBytes)
    } catch {
      return false
    }
  }
}
