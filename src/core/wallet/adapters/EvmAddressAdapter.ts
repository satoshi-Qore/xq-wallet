/**
 * EvmAddressAdapter.ts — EVM address derivation.
 *
 * Derives an EIP-55 checksummed Ethereum address from a secp256k1 BIP-32 child key.
 *
 * Steps:
 *   1. Derive BIP-44 child key at m/44'/60'/0'/0/{accountIndex}
 *   2. Decompress the 33-byte compressed public key to 65 bytes (uncompressed)
 *   3. keccak256 of the 64-byte body (drop 0x04 prefix)
 *   4. Take the last 20 bytes as the raw address
 *   5. Apply EIP-55 mixed-case checksum
 *
 * Dependencies:
 *   @noble/hashes/sha3     — keccak_256 (transitive dep via @scure/bip32)
 *   @noble/curves/secp256k1 — point decompression (transitive dep via @scure/bip32)
 *
 * Architecture: ARCHITECTURE.md §5.3 — EVM Adapter
 * Security: PRIN-SEC-01/02 — private key is never accessed or stored.
 */

import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { WalletError } from '@/domain/errors'
import type { EVMAddressEntry } from '@/domain/wallet'
import { derivePath } from '@/core/crypto/hd'
import { evmPath } from '../paths'
import type { EvmDeriveInput } from './types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Applies EIP-55 mixed-case checksum encoding to a 20-byte hex address.
 *
 * Algorithm: for each hex character at position i, if keccak256(lowercase_address)[i] ≥ 8
 * then uppercase the character. The result is a 42-char "0x..." string.
 *
 * @param addr20hex — 40-character lowercase hex string (WITHOUT "0x" prefix)
 */
function toChecksumAddress(addr20hex: string): string {
  const lower = addr20hex.toLowerCase()
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)))
  const checksummed = [...lower]
    .map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c))
    .join('')
  return `0x${checksummed}`
}

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Derives an EVM address entry from a BIP-32 master node.
 *
 * @param input.masterNode   — BIP-32 HD master key (from createMasterNode())
 * @param input.accountIndex — Account-level index (0-based)
 * @returns EVMAddressEntry with EIP-55 checksummed address and 33-byte compressed publicKeyHex
 * @throws WalletError('DERIVATION_FAILED') on any cryptographic failure
 */
export function deriveEvmAddress(input: EvmDeriveInput): EVMAddressEntry {
  const { masterNode, accountIndex } = input
  const path = evmPath(accountIndex)
  const child = derivePath(masterNode, path)

  // child.publicKey is guaranteed non-null by derivePath() — it throws if null
  const compressed = child.publicKey as Uint8Array

  // Decompress 33-byte compressed key to 65-byte uncompressed (0x04 + x + y)
  let uncompressed: Uint8Array
  try {
    const point = secp256k1.ProjectivePoint.fromHex(bytesToHex(compressed))
    uncompressed = point.toRawBytes(false)
  } catch (err) {
    throw new WalletError(
      'DERIVATION_FAILED',
      'Failed to decompress EVM public key from the derived child node.',
      err,
    )
  }

  // keccak256 of the 64-byte (x,y) body, take last 20 bytes as address
  const hash = keccak_256(uncompressed.slice(1))
  const address = toChecksumAddress(bytesToHex(hash.slice(12)))

  return {
    vm: 'evm',
    address,
    publicKeyHex: bytesToHex(compressed),
    derivationPath: path,
  }
}
