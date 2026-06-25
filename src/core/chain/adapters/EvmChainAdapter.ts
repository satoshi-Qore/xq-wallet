/**
 * EvmChainAdapter.ts — Chain adapter for EVM-compatible networks.
 *
 * Covers all EVM chains (Ethereum, Base, Arbitrum, etc.) — a single secp256k1
 * key pair produces the same address on every EVM chain.
 *
 * Signing algorithm:  ECDSA over secp256k1, message hashed with keccak256.
 * Address validation: /^0x[0-9a-fA-F]{40}$/ (structural only — no on-chain check).
 * Address formatting: EIP-55 mixed-case checksum encoding.
 *
 * Dependencies (all transitive via @scure/bip32 — no new installs needed):
 *   @noble/curves/secp256k1  — ECDSA sign / verify
 *   @noble/hashes/sha3       — keccak256
 *
 * Architecture: ARCHITECTURE.md §7.1 — EVM Chain Adapter
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

/**
 * Applies EIP-55 mixed-case checksum encoding to a 20-byte raw address.
 *
 * @param addr20hex - 40 lowercase hex characters WITHOUT '0x' prefix.
 * @returns 42-character '0x...' EIP-55 checksummed address.
 */
function toChecksumAddress(addr20hex: string): string {
  const lower = addr20hex.toLowerCase()
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)))
  const checksummed = [...lower]
    .map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c))
    .join('')
  return `0x${checksummed}`
}

/** Pattern: optional '0x' prefix + exactly 40 hex characters. */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Chain adapter for EVM-compatible virtual machines.
 *
 * Stateless singleton — instantiated once by AdapterFactory.
 */
export class EvmChainAdapter implements IChainAdapter {
  /** @inheritdoc */
  readonly vm = 'evm' as const

  /** @inheritdoc */
  isValidAddress(address: string): boolean {
    return EVM_ADDRESS_RE.test(address)
  }

  /**
   * Applies EIP-55 checksum to a raw hex EVM address.
   * @inheritdoc
   */
  formatAddress(address: string): string {
    if (!EVM_ADDRESS_RE.test(address)) {
      throw new WalletError(
        'INVALID_ADDRESS',
        `"${address}" is not a valid EVM address. Expected 0x followed by 40 hex characters.`,
      )
    }
    return toChecksumAddress(address.slice(2).toLowerCase())
  }

  /** @inheritdoc */
  getPublicKeyHex(entry: AddressEntry): string {
    if (entry.vm !== 'evm') {
      throw new WalletError(
        'UNSUPPORTED_VM',
        `EvmChainAdapter requires an EVM address entry. Got: ${entry.vm}`,
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
      throw new WalletError('DERIVATION_FAILED', 'EVM ECDSA signing failed.', err)
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
