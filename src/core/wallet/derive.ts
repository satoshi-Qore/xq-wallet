/**
 * derive.ts — Public wallet derivation API.
 *
 * Provides four public async functions that derive address entries and account
 * metadata from a BIP-39 mnemonic. All functions:
 *   1. Validate inputs before touching any key material
 *   2. Derive the 64-byte seed from the mnemonic via PBKDF2-HMAC-SHA512
 *   3. Delegate address derivation to the appropriate VM adapter
 *   4. Zero the seed in a finally block (SEC-01)
 *
 * Chain-agnostic design: VM-specific logic lives entirely in adapters/.
 * This module only wires inputs → adapters → domain types.
 *
 * Architecture: ARCHITECTURE.md §5.3 — Wallet Derivation
 * Security: PRIN-SEC-01 (no key material in return values or exceptions)
 *           PRIN-SEC-02 (seed zeroed immediately after use)
 */

import { mnemonicToSeed } from '@/core/crypto/seed'
import { createMasterNode, derivePath } from '@/core/crypto/hd'
import { WalletError } from '@/domain/errors'
import type {
  EVMAddressEntry,
  NativeAddressEntry,
  SVMAddressEntry,
  AccountMetadata,
  AddressEntry,
} from '@/domain/wallet'
import { assertValidAccountIndex, evmPath, nativePath } from './paths'
import { deriveEvmAddress } from './adapters/EvmAddressAdapter'
import { deriveSvmAddress, deriveEd25519PrivateKey } from './adapters/SvmAddressAdapter'
import { deriveNativeAddress } from './adapters/NativeAddressAdapter'

// ─── Options ───────────────────────────────────────────────────────────────

/**
 * Options for deriveAllAccounts().
 *
 * Specify which chains to derive addresses for. At minimum pass one non-empty array.
 * An account with no chains is technically valid but practically useless.
 */
export interface DeriveAllAccountsOptions {
  /**
   * SVM chain IDs to derive addresses for.
   * Each entry produces one SVMAddressEntry in the returned account.
   * Example: ["solana", "eclipse"]
   */
  readonly svmChainIds: readonly string[]

  /**
   * Native (QoreChain) chain IDs to derive addresses for.
   * Each entry produces one NativeAddressEntry in the returned account.
   * Example: ["qorechain-devnet", "qorechain-testnet"]
   */
  readonly nativeChainIds: readonly string[]

  /**
   * Optional display name for the account.
   * Defaults to "Account {accountIndex + 1}" if not provided.
   */
  readonly accountName?: string
}

// ─── Individual Derivation Functions ───────────────────────────────────────

/**
 * Derives a single EVM address entry.
 *
 * Uses secp256k1 BIP-44 path m/44'/60'/0'/0/{accountIndex}.
 * One EVM address covers all EVM-compatible chains (Ethereum, Base, Arbitrum…).
 *
 * @param mnemonic     — BIP-39 mnemonic (any case; normalised internally).
 * @param accountIndex — Account-level index, 0-based.
 * @returns EVMAddressEntry with EIP-55 checksummed address.
 * @throws WalletError('INVALID_MNEMONIC') for invalid mnemonic.
 * @throws WalletError('DERIVATION_FAILED') for invalid index or derivation error.
 */
export async function deriveEvmAccount(
  mnemonic: string,
  accountIndex: number,
): Promise<EVMAddressEntry> {
  assertValidAccountIndex(accountIndex)

  const seed = await mnemonicToSeed(mnemonic)
  try {
    const masterNode = createMasterNode(seed)
    return deriveEvmAddress({ masterNode, accountIndex })
  } finally {
    seed.fill(0) // SEC-01: zero seed immediately after use
  }
}

/**
 * Derives a single SVM (Solana-compatible) address entry via SLIP-0010 Ed25519.
 *
 * Uses path m/44'/501'/{accountIndex}' (all hardened, Ledger/Backpack style).
 *
 * @param mnemonic     — BIP-39 mnemonic.
 * @param accountIndex — Account-level index, 0-based.
 * @param chainId      — Chain identifier stored in the entry (e.g. "solana").
 * @returns SVMAddressEntry with base58-encoded Solana address.
 * @throws WalletError('INVALID_MNEMONIC') for invalid mnemonic.
 * @throws WalletError('DERIVATION_FAILED') for invalid index or derivation error.
 */
export async function deriveSvmAccount(
  mnemonic: string,
  accountIndex: number,
  chainId: string,
): Promise<SVMAddressEntry> {
  assertValidAccountIndex(accountIndex)
  assertValidChainId(chainId)

  const seed = await mnemonicToSeed(mnemonic)
  try {
    return deriveSvmAddress({ seed, accountIndex, chainId })
  } finally {
    seed.fill(0) // SEC-01
  }
}

/**
 * Derives a single Native (QoreChain) address entry.
 *
 * Uses secp256k1 BIP-44 path m/44'/9999'/0'/0/{accountIndex}.
 * Address format is provisional — see NativeAddressAdapter.ts.
 *
 * @param mnemonic     — BIP-39 mnemonic.
 * @param accountIndex — Account-level index, 0-based.
 * @param chainId      — Chain identifier (e.g. "qorechain-devnet").
 * @returns NativeAddressEntry with provisional lowercase hex address.
 * @throws WalletError('INVALID_MNEMONIC') for invalid mnemonic.
 * @throws WalletError('DERIVATION_FAILED') for invalid index or derivation error.
 */
export async function deriveNativeAccount(
  mnemonic: string,
  accountIndex: number,
  chainId: string,
): Promise<NativeAddressEntry> {
  assertValidAccountIndex(accountIndex)
  assertValidChainId(chainId)

  const seed = await mnemonicToSeed(mnemonic)
  try {
    const masterNode = createMasterNode(seed)
    return deriveNativeAddress({ masterNode, accountIndex, chainId })
  } finally {
    seed.fill(0) // SEC-01
  }
}

/**
 * Derives ALL configured addresses for one account index and assembles
 * them into an AccountMetadata record.
 *
 * Always derives:
 *   - One EVMAddressEntry (covers all EVM chains with a single key)
 *
 * Conditionally derives (one per entry in the respective options array):
 *   - SVMAddressEntry per svmChainIds entry
 *   - NativeAddressEntry per nativeChainIds entry
 *
 * The seed is derived exactly once and shared across all adapters,
 * then zeroed in the finally block regardless of success or failure.
 *
 * @param mnemonic     — BIP-39 mnemonic.
 * @param accountIndex — Account-level index, 0-based.
 * @param options      — Which chains to include and optional display name.
 * @returns AccountMetadata with all derived addresses and a stable UUID.
 * @throws WalletError('INVALID_MNEMONIC') for invalid mnemonic.
 * @throws WalletError('DERIVATION_FAILED') for invalid index or derivation error.
 */
export async function deriveAllAccounts(
  mnemonic: string,
  accountIndex: number,
  options: DeriveAllAccountsOptions,
): Promise<AccountMetadata> {
  assertValidAccountIndex(accountIndex)

  const seed = await mnemonicToSeed(mnemonic)
  try {
    const masterNode = createMasterNode(seed)
    const addresses: AddressEntry[] = []

    // EVM — single key covers all EVM chains
    addresses.push(deriveEvmAddress({ masterNode, accountIndex }))

    // SVM — one entry per configured chain
    for (const chainId of options.svmChainIds) {
      assertValidChainId(chainId)
      addresses.push(deriveSvmAddress({ seed, accountIndex, chainId }))
    }

    // Native — one entry per configured chain
    for (const chainId of options.nativeChainIds) {
      assertValidChainId(chainId)
      addresses.push(deriveNativeAddress({ masterNode, accountIndex, chainId }))
    }

    return {
      id: globalThis.crypto.randomUUID(),
      name: options.accountName ?? `Account ${accountIndex + 1}`,
      index: accountIndex,
      addresses,
      createdAt: Date.now(),
    }
  } finally {
    seed.fill(0) // SEC-01: zero seed once — covers all adapters above
  }
}

// ─── Internal Validators ────────────────────────────────────────────────────

/** Chain IDs must be non-empty strings. Full registry validation is Sprint 5. */
function assertValidChainId(chainId: string): void {
  if (typeof chainId !== 'string' || chainId.trim().length === 0) {
    throw new WalletError('DERIVATION_FAILED', 'Chain ID must be a non-empty string.')
  }
}

// ─── Private Key Derivation (for signing) ──────────────────────────────────
//
// These exports are intentionally NOT re-exported from the public barrel
// (src/core/wallet/index.ts). They exist solely for WalletService.signMessage()
// which needs to derive a private key transiently, use it, and zero it.
// SEC-01: caller must zero the returned Uint8Array immediately after use.

/**
 * Derives the raw 32-byte private key for the specified account and VM.
 *
 * Called only by WalletService.signMessage(). The returned key material MUST
 * be zeroed by the caller immediately after use (SEC-01).
 *
 * @param mnemonic     - Plaintext BIP-39 mnemonic (from WalletService session).
 * @param accountIndex - BIP-44 account index (0-based).
 * @param vm           - Virtual machine type ('evm' | 'svm' | 'native').
 * @returns 32-byte private key scalar. Caller is responsible for zeroing.
 * @throws WalletError('DERIVATION_FAILED') on any key derivation failure.
 */
export async function derivePrivateKeyForSigning(
  mnemonic: string,
  accountIndex: number,
  vm: 'evm' | 'svm' | 'native',
): Promise<Uint8Array> {
  assertValidAccountIndex(accountIndex)
  const seed = await mnemonicToSeed(mnemonic)
  try {
    if (vm === 'svm') {
      // SLIP-0010 Ed25519 path: m/44'/501'/{accountIndex}'
      return deriveEd25519PrivateKey(seed, accountIndex)
    }
    // secp256k1 BIP-32/44 path — EVM and Native share the same curve
    const masterNode = createMasterNode(seed)
    const path = vm === 'evm' ? evmPath(accountIndex) : nativePath(accountIndex)
    const child = derivePath(masterNode, path)
    if (!child.privateKey) {
      throw new WalletError('DERIVATION_FAILED', 'BIP-32 child key has no private key material.')
    }
    // Copy into a new buffer — HDKey.privateKey is the library's internal slice
    return new Uint8Array(child.privateKey)
  } finally {
    seed.fill(0) // SEC-01: zero seed regardless of success or failure
  }
}
