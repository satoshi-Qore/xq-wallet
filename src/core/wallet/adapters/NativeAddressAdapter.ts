/**
 * NativeAddressAdapter.ts — QoreChain (Native VM) address derivation.
 *
 * Uses secp256k1 BIP-32/BIP-44 derivation (same key curve as EVM), but with
 * a distinct coin type (9999) and a different derivation path, ensuring Native
 * addresses are completely independent from EVM addresses even for the same
 * account index.
 *
 * Address format (Sprint 2 PLACEHOLDER):
 *   "0x" + lowercase hex of keccak256(uncompressed_pubkey[1:])[last 20 bytes]
 *
 * IMPORTANT: This format is provisional. The real QoreChain SDK address encoding
 * MUST be substituted here before Sprint 3 testnet deployment. The coin type
 * (9999) must also be replaced with the officially registered SLIP-0044 value.
 * These are hard blockers — tracked in ARCHITECTURE.md §5.3.
 *
 * Dependencies:
 *   @noble/hashes/sha3      — keccak_256 (transitive dep via @scure/bip32)
 *   @noble/curves/secp256k1 — point decompression (transitive dep via @scure/bip32)
 *
 * Architecture: ARCHITECTURE.md §5.3 — Native Adapter
 * Security: PRIN-SEC-01/02 — private key is never accessed or stored.
 */

import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { WalletError } from '@/domain/errors'
import type { NativeAddressEntry } from '@/domain/wallet'
import { derivePath } from '@/core/crypto/hd'
import { nativePath } from '../paths'
import type { NativeDeriveInput } from './types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Derives a Native (QoreChain) address entry from a BIP-32 master node.
 *
 * @param input.masterNode   — BIP-32 HD master key (from createMasterNode())
 * @param input.accountIndex — Account-level index (0-based)
 * @param input.chainId      — Chain identifier (e.g. "qorechain-devnet")
 * @returns NativeAddressEntry with provisional address and 33-byte compressed publicKeyHex
 * @throws WalletError('DERIVATION_FAILED') on any cryptographic failure
 */
export function deriveNativeAddress(input: NativeDeriveInput): NativeAddressEntry {
  const { masterNode, accountIndex, chainId } = input
  const path = nativePath(accountIndex)
  const child = derivePath(masterNode, path)

  // child.publicKey is guaranteed non-null by derivePath()
  const compressed = child.publicKey as Uint8Array

  // Decompress 33-byte compressed key to 65-byte uncompressed (0x04 + x + y)
  let uncompressed: Uint8Array
  try {
    const point = secp256k1.ProjectivePoint.fromHex(bytesToHex(compressed))
    uncompressed = point.toRawBytes(false)
  } catch (err) {
    throw new WalletError(
      'DERIVATION_FAILED',
      'Failed to decompress Native public key from the derived child node.',
      err,
    )
  }

  // Provisional address: lowercase hex of keccak256(x || y)[last 20 bytes]
  // No EIP-55 checksum — this is not an Ethereum address and the format is TBD.
  const hash = keccak_256(uncompressed.slice(1))
  const address = `0x${bytesToHex(hash.slice(12))}`

  return {
    vm: 'native',
    chainId,
    address,
    publicKeyHex: bytesToHex(compressed),
    derivationPath: path,
  }
}
