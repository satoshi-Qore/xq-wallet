/**
 * paths.ts — BIP-44 derivation path builders per VM.
 *
 * All paths follow the BIP-44 structure:
 *   m / purpose' / coin_type' / account' / change / address_index
 *
 * For EVM and Native, the standard BIP-44 layout (account=0, change=0) is used,
 * and the account index varies at the address_index level.
 *
 * For SVM (Solana), SLIP-0010 requires all-hardened paths. The Solana community
 * commonly uses m/44'/501'/{index}' (Ledger / Backpack style, 3 levels).
 *
 * Coin types:
 *   60   — Ethereum (SLIP-0044 registered) — covers all EVM-compatible chains
 *   501  — Solana   (SLIP-0044 registered)
 *   9999 — QoreChain (PLACEHOLDER — must be replaced before mainnet)
 *
 * Architecture: ARCHITECTURE.md §5.3 — Derivation Paths
 * Security: paths are public metadata — no key material involved here.
 */

import { WalletError } from '@/domain/errors'

// ─── Coin Types ────────────────────────────────────────────────────────────

/** SLIP-0044 coin type for Ethereum and all EVM-compatible chains */
export const EVM_COIN_TYPE = 60 as const

/** SLIP-0044 coin type for Solana */
export const SVM_COIN_TYPE = 501 as const

/**
 * Provisional coin type for QoreChain.
 *
 * HARD BLOCKER: Replace this value with the officially registered SLIP-0044
 * coin type before any testnet or mainnet deployment. Using 9999 in production
 * will produce addresses incompatible with the registered coin type.
 */
export const NATIVE_COIN_TYPE = 9999 as const

// ─── Path Builders ─────────────────────────────────────────────────────────

/**
 * BIP-44 derivation path for EVM chains.
 *
 * Pattern: m/44'/60'/0'/0/{accountIndex}
 * The account index varies at the address_index level (standard BIP-44 layout).
 *
 * @param accountIndex — Non-negative integer ≤ 2 147 483 647.
 * @throws WalletError('DERIVATION_FAILED') for invalid index.
 */
export function evmPath(accountIndex: number): string {
  assertValidAccountIndex(accountIndex)
  return `m/44'/${EVM_COIN_TYPE}'/0'/0/${accountIndex}`
}

/**
 * SLIP-0010 / BIP-44 derivation path for Solana-compatible chains.
 *
 * Pattern: m/44'/501'/{accountIndex}'
 * All path components are hardened — required by SLIP-0010 for Ed25519.
 * Uses 3-level path (Ledger / Backpack style).
 *
 * @param accountIndex — Non-negative integer ≤ 2 147 483 647.
 * @throws WalletError('DERIVATION_FAILED') for invalid index.
 */
export function svmPath(accountIndex: number): string {
  assertValidAccountIndex(accountIndex)
  return `m/44'/${SVM_COIN_TYPE}'/${accountIndex}'`
}

/**
 * BIP-44 derivation path for Native (QoreChain) chains.
 *
 * Pattern: m/44'/9999'/0'/0/{accountIndex}
 * Provisional coin type — see NATIVE_COIN_TYPE constant above.
 *
 * @param accountIndex — Non-negative integer ≤ 2 147 483 647.
 * @throws WalletError('DERIVATION_FAILED') for invalid index.
 */
export function nativePath(accountIndex: number): string {
  assertValidAccountIndex(accountIndex)
  return `m/44'/${NATIVE_COIN_TYPE}'/0'/0/${accountIndex}`
}

// ─── Validator ─────────────────────────────────────────────────────────────

/**
 * Validates that an account index is safe to use in a BIP-44 path.
 *
 * Valid range: [0, 2 147 483 647] (non-negative 31-bit integer).
 * The upper bound comes from BIP-32 hardened key derivation: indices ≥ 2^31
 * are reserved for hardened derivation. We reserve the full 31-bit range
 * for non-hardened components and validate separately for hardened paths.
 *
 * @throws WalletError('DERIVATION_FAILED') for out-of-range or non-integer values.
 */
export function assertValidAccountIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new WalletError(
      'DERIVATION_FAILED',
      `Account index must be a non-negative integer not exceeding 2 147 483 647. Got: ${index}.`,
    )
  }
}
