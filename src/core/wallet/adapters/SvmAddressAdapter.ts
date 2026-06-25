/**
 * SvmAddressAdapter.ts — Solana-compatible address derivation via SLIP-0010 Ed25519.
 *
 * @scure/bip32 uses secp256k1 only (BIP-32 spec). Solana requires Ed25519 keys
 * derived via SLIP-0010, a separate spec that uses HMAC-SHA512 with hardened-only
 * derivation. This adapter implements SLIP-0010 using audited @noble primitives.
 *
 * SLIP-0010 Master Key Generation:
 *   I  = HMAC-SHA512(Key = "ed25519 seed", Data = seed)
 *   IL = I[0:32]   ← master private key
 *   IR = I[32:64]  ← master chain code
 *
 * SLIP-0010 Hardened Child Key Derivation (Ed25519 — hardened only):
 *   data = 0x00 || parentKey || ser32(index | 0x80000000)
 *   I    = HMAC-SHA512(Key = parentChainCode, Data = data)
 *   IL   = I[0:32]   ← child private key
 *   IR   = I[32:64]  ← child chain code
 *
 * Derivation path: m/44'/501'/{accountIndex}' (all hardened, 3-level)
 *
 * Address format: base58(Ed25519PublicKey) — identical to Solana's native format.
 *
 * Dependencies:
 *   @noble/hashes/hmac      — HMAC (transitive dep via @scure/bip32)
 *   @noble/hashes/sha512    — SHA-512 (transitive dep via @scure/bip32)
 *   @noble/curves/ed25519   — Ed25519 public key generation (transitive dep via @scure/bip32)
 *   @scure/base             — base58 encoding (transitive dep via @scure/bip32)
 *
 * Reference: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
 *
 * Architecture: ARCHITECTURE.md §5.3 — SVM Adapter
 * Security: PRIN-SEC-01/02 — private key is derived in memory and never stored or logged.
 */

import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha512'
import { ed25519 } from '@noble/curves/ed25519'
import { base58 } from '@scure/base'
import { WalletError } from '@/domain/errors'
import type { SVMAddressEntry } from '@/domain/wallet'
import { svmPath } from '../paths'
import type { SvmDeriveInput } from './types'

// ─── SLIP-0010 Ed25519 Implementation ─────────────────────────────────────

const ED25519_SEED_KEY = new TextEncoder().encode('ed25519 seed')

interface KeyAndChainCode {
  key: Uint8Array // 32-byte private key
  chainCode: Uint8Array // 32-byte chain code
}

/**
 * SLIP-0010 master key derivation for Ed25519.
 * I = HMAC-SHA512(Key="ed25519 seed", Data=seed)
 */
function slip10Master(seed: Uint8Array): KeyAndChainCode {
  const I = hmac(sha512, ED25519_SEED_KEY, seed)
  return { key: I.slice(0, 32), chainCode: I.slice(32) }
}

/**
 * SLIP-0010 hardened child key derivation.
 * Ed25519 ONLY supports hardened derivation (index ≥ 2^31).
 */
function slip10HardenedChild(
  parentKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number,
): KeyAndChainCode {
  // Force hardened: index | 0x80000000, interpreted as unsigned 32-bit BE integer
  const hardenedIndex = (index | 0x80000000) >>> 0

  // Data = 0x00 || parentKey(32) || ser32(hardenedIndex)(4) = 37 bytes
  const data = new Uint8Array(37)
  data[0] = 0x00
  data.set(parentKey, 1)
  new DataView(data.buffer).setUint32(33, hardenedIndex, false) // big-endian

  const I = hmac(sha512, parentChainCode, data)
  return { key: I.slice(0, 32), chainCode: I.slice(32) }
}

// ─── Internal: Ed25519 key derivation ─────────────────────────────────────

/**
 * Derives a 32-byte Ed25519 private key for Solana path m/44'/501'/{accountIndex}'.
 *
 * Internal — exported only for unit testing of the SLIP-0010 implementation.
 * Callers must zero the returned Uint8Array after use.
 */
export function deriveEd25519PrivateKey(seed: Uint8Array, accountIndex: number): Uint8Array {
  const master = slip10Master(seed)
  const afterPurpose = slip10HardenedChild(master.key, master.chainCode, 44) // /44'
  const afterCoin = slip10HardenedChild(afterPurpose.key, afterPurpose.chainCode, 501) // /501'
  const afterIndex = slip10HardenedChild(afterCoin.key, afterCoin.chainCode, accountIndex) // /{index}'
  return afterIndex.key
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Adapter ───────────────────────────────────────────────────────────────

/**
 * Derives a Solana-compatible address entry from the raw 64-byte BIP-39 seed.
 *
 * @param input.seed         — 64-byte BIP-39 seed. Must be zeroed by caller after use.
 * @param input.accountIndex — Account-level index (0-based).
 * @param input.chainId      — Chain identifier (e.g. "solana", "eclipse", "sonic").
 * @returns SVMAddressEntry with base58-encoded address and 32-byte Ed25519 publicKeyHex.
 * @throws WalletError('DERIVATION_FAILED') on any cryptographic failure.
 */
export function deriveSvmAddress(input: SvmDeriveInput): SVMAddressEntry {
  const { seed, accountIndex, chainId } = input
  const path = svmPath(accountIndex)

  let privateKey: Uint8Array
  try {
    privateKey = deriveEd25519PrivateKey(seed, accountIndex)
  } catch (err) {
    if (WalletError.isWalletError(err)) throw err
    throw new WalletError('DERIVATION_FAILED', 'SLIP-0010 Ed25519 key derivation failed.', err)
  }

  const publicKey = ed25519.getPublicKey(privateKey)
  const address = base58.encode(publicKey)

  return {
    vm: 'svm',
    chainId,
    address,
    publicKeyHex: bytesToHex(publicKey),
    derivationPath: path,
  }
}
