/**
 * Wallet domain types.
 *
 * Pure TypeScript types — no logic, no imports from outside domain/.
 * These types define the public (non-secret) shape of wallets and accounts.
 * Key material (mnemonic, private keys) is NEVER in these types.
 *
 * Architecture: ARCHITECTURE.md §4 — Domain Models
 * Security: PRIN-SEC-01 — no mnemonic in any store or serialised type
 */

import type { VMType } from './chain'

// ─── Primitives ────────────────────────────────────────────────────────────

/** BIP-39 word count. Only 12 and 24 are supported. */
export type WordCount = 12 | 24

// ─── Address Entries ───────────────────────────────────────────────────────
//
// One HD account index may have multiple AddressEntries — one per enabled VM.
// Discriminated union on `vm` enables exhaustive type narrowing at usage sites.

/**
 * EVM address entry.
 *
 * One address covers ALL EVM chains (Ethereum, Base, Arbitrum, etc.)
 * because EVM chains share the same secp256k1 key and keccak256 address scheme.
 * Only the active chain context changes — the address itself does not.
 */
export interface EVMAddressEntry {
  readonly vm: 'evm'
  /** EIP-55 checksum address: "0x..." */
  readonly address: string
  /** 33-byte compressed secp256k1 public key, lowercase hex */
  readonly publicKeyHex: string
  /** BIP-44 path: m/44'/60'/0'/0/{index} */
  readonly derivationPath: string
}

/**
 * Native QoreChain address entry.
 *
 * Per-chain because devnet/testnet/mainnet may use different address prefixes
 * or encoding schemes once the QoreChain SDK defines them.
 */
export interface NativeAddressEntry {
  readonly vm: 'native'
  /** ChainDefinition.id: "qorechain-devnet" | "qorechain-testnet" | "qorechain-mainnet" */
  readonly chainId: string
  /**
   * Chain-specific address encoding.
   * Format is TBD until the QoreChain SDK defines it (Sprint 3).
   */
  readonly address: string
  readonly publicKeyHex: string
  /**
   * BIP-44 path: m/44'/9999'/0'/0/{index}
   * Coin type 9999 is a placeholder — MUST be replaced with the registered
   * SLIP-0044 coin type before mainnet launch. This is a hard blocker.
   */
  readonly derivationPath: string
}

/**
 * SVM (Solana-compatible) address entry.
 *
 * Per-chain because Eclipse and Sonic may diverge from Solana's address format.
 */
export interface SVMAddressEntry {
  readonly vm: 'svm'
  /** ChainDefinition.id: "solana" | "eclipse" | "sonic" */
  readonly chainId: string
  /** Base58Check-encoded public key (Solana-style address) */
  readonly address: string
  readonly publicKeyHex: string
  /** BIP-44 path: m/44'/501'/{index}' */
  readonly derivationPath: string
}

/** Discriminated union over all address entry types. */
export type AddressEntry = EVMAddressEntry | NativeAddressEntry | SVMAddressEntry

// ─── Account ───────────────────────────────────────────────────────────────

/**
 * A single derived account within a wallet.
 *
 * Contains ONLY public information — no secrets.
 * One account index maps to one or more AddressEntries (one per enabled VM/chain).
 *
 * Sprint 2: only NativeAddressEntry records are populated during wallet creation.
 * EVM and SVM entries are added in Sprint 3 when those VMs are enabled.
 */
export interface AccountMetadata {
  /** Stable UUID — generated at account creation, never changes */
  readonly id: string
  /** User-editable display name. Default: "Account 1", "Account 2", etc. */
  name: string
  /** BIP-44 account-level index (0-based). Determines derivation path. */
  readonly index: number
  /**
   * Derived addresses for each enabled VM/chain.
   * Grows as the user enables additional VMs or chains.
   */
  readonly addresses: AddressEntry[]
  /** Unix timestamp (ms) when this account was first derived */
  readonly createdAt: number
}

// ─── Wallet ────────────────────────────────────────────────────────────────

/**
 * Wallet metadata — persisted in plaintext (public information only).
 *
 * The mnemonic is NEVER in this type. It lives exclusively inside the
 * EncryptedVault, accessible only via vaultService.decryptVault().
 *
 * One WalletMetadata record corresponds to exactly one mnemonic (EncryptedVault).
 */
export interface WalletMetadata {
  /**
   * Stable UUID — generated at wallet creation, never changes.
   * This ID is used as the key in the "vaults" IndexedDB object store.
   */
  readonly id: string
  /** User-editable wallet name. Default: "My Wallet" */
  name: string
  /** BIP-39 word count used when this wallet was created */
  readonly wordCount: WordCount
  /** All accounts derived from this wallet's mnemonic */
  readonly accounts: AccountMetadata[]
  /** ID of the currently selected account */
  activeAccountId: string
  /** Unix timestamp (ms) when this wallet was created */
  readonly createdAt: number
  /** Unix timestamp (ms) of the last successful unlock. null if never unlocked. */
  lastUnlockedAt: number | null
  /**
   * Schema version for forward-compatible migration.
   * Must be incremented whenever the WalletMetadata shape changes.
   * Current version: 1
   */
  readonly version: number
}

// ─── Type Helpers ──────────────────────────────────────────────────────────

/** Type guard: narrows AddressEntry to EVMAddressEntry */
export function isEVMAddress(entry: AddressEntry): entry is EVMAddressEntry {
  return entry.vm === 'evm'
}

/** Type guard: narrows AddressEntry to NativeAddressEntry */
export function isNativeAddress(entry: AddressEntry): entry is NativeAddressEntry {
  return entry.vm === 'native'
}

/** Type guard: narrows AddressEntry to SVMAddressEntry */
export function isSVMAddress(entry: AddressEntry): entry is SVMAddressEntry {
  return entry.vm === 'svm'
}

/** Returns the address entries for a given VM from an account */
export function getAddressesByVM(account: AccountMetadata, vm: VMType): AddressEntry[] {
  return account.addresses.filter((a) => a.vm === vm)
}
