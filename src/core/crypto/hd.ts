/**
 * hd.ts — BIP-32 HD key derivation.
 *
 * Wraps @scure/bip32 (audited by Cure53) for hierarchical deterministic key
 * management. All functions are pure and stateless.
 *
 * SECURITY INVARIANTS:
 *   - HDKey instances returned by these functions contain private key material.
 *   - They must NEVER be stored in Zustand, React state, component props,
 *     IndexedDB, or any serialised form. (SEC-01, SEC-02, SEC-03)
 *   - Derive the public key / address immediately, then discard the HDKey reference.
 *   - If a public-key-only view is needed (watch-only wallet), call HDKey.wipePrivateData()
 *     before passing the key outside the crypto layer.
 *
 * Supported derivation paths (BIP-44 m/purpose'/coin_type'/account'/change/index):
 *   EVM:    m/44'/60'/0'/0/n    — Ethereum and all EVM-compatible chains share one address
 *   SVM:    m/44'/501'/n'        — Solana (account-level hardened derivation)
 *   Native: m/44'/9999'/0'/0/n  — QoreChain (coin type TBD, placeholder 9999)
 *
 * Architecture: ARCHITECTURE.md §5.3 — HD Key Derivation
 * Security: PRIN-SEC-01, SEC-01, SEC-02
 */

import { HDKey } from '@scure/bip32'
import { WalletError } from '@/domain/errors'

// Re-export the HDKey type so consumers can annotate their variables
// without importing @scure/bip32 directly.
export type { HDKey }

// ─── Master Node ───────────────────────────────────────────────────────────

/**
 * Creates a BIP-32 master HD key from a 64-byte BIP-39 seed.
 *
 * The master node is the root of the entire HD wallet tree. All child keys
 * (accounts, addresses) are derived from it. Handle with extreme care —
 * it contains the master private key from which every address can be reconstructed.
 *
 * @param seed - 64-byte seed from mnemonicToSeed(). Must be exactly 64 bytes.
 * @returns The HD master key node (depth 0, index 0).
 * @throws WalletError('DERIVATION_FAILED') if seed length is wrong or derivation fails.
 *
 * @example
 * const seed = await mnemonicToSeed(mnemonic)
 * const master = createMasterNode(seed)
 * seed.fill(0) // zero the seed buffer immediately
 * const child = derivePath(master, "m/44'/60'/0'/0/0")
 * master.wipePrivateData() // zero the master key after all children are derived
 */
export function createMasterNode(seed: Uint8Array): HDKey {
  if (seed.length !== 64) {
    throw new WalletError(
      'DERIVATION_FAILED',
      `Seed must be exactly 64 bytes. Got ${seed.length} bytes.`,
    )
  }

  try {
    return HDKey.fromMasterSeed(seed)
  } catch (err) {
    throw new WalletError(
      'DERIVATION_FAILED',
      'Failed to create HD master key from the provided seed.',
      err,
    )
  }
}

// ─── Path Derivation ───────────────────────────────────────────────────────

/**
 * Derives a child HD key at the specified BIP-44 derivation path.
 *
 * Hardened derivation (path components with `'`) requires the parent's
 * private key to be present. This is always the case when masterNode
 * is produced by createMasterNode().
 *
 * @param masterNode - HD master key (from createMasterNode()).
 * @param path - BIP-44 derivation path string. Must start with "m/".
 * @returns The derived child HDKey. Contains publicKey (33 bytes, compressed).
 *          Contains privateKey if masterNode had a private key.
 * @throws WalletError('DERIVATION_FAILED') if the path is invalid or derivation fails.
 *
 * @example
 * const evmKey = derivePath(master, "m/44'/60'/0'/0/0")   // first EVM account
 * const solKey = derivePath(master, "m/44'/501'/0'")       // first Solana account
 */
export function derivePath(masterNode: HDKey, path: string): HDKey {
  if (!path.startsWith('m/')) {
    throw new WalletError(
      'DERIVATION_FAILED',
      `Invalid derivation path: "${path}". Path must start with "m/".`,
    )
  }

  try {
    const child = masterNode.derive(path)

    if (!child.publicKey) {
      throw new WalletError(
        'DERIVATION_FAILED',
        'Derived key has no public key. This is an unexpected error.',
      )
    }

    return child
  } catch (err) {
    if (WalletError.isWalletError(err)) throw err
    throw new WalletError(
      'DERIVATION_FAILED',
      'Failed to derive key at the specified path. The path may be invalid.',
      err,
    )
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────

/**
 * Encodes a compressed secp256k1 public key as a lowercase hex string.
 *
 * @param publicKey - 33-byte compressed public key (02/03 prefix + 32-byte X).
 * @returns 66-character lowercase hex string.
 *
 * @example
 * const hex = publicKeyToHex(child.publicKey!) // "02a1b2c3..."
 */
export function publicKeyToHex(publicKey: Uint8Array): string {
  return [...publicKey].map((b) => b.toString(16).padStart(2, '0')).join('')
}
