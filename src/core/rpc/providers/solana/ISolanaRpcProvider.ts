/**
 * ISolanaRpcProvider.ts — Solana-specific RPC provider interface.
 *
 * Extends IRpcProvider with Solana JSON-RPC passthrough methods whose names
 * and signatures mirror the official Solana JSON-RPC API
 * (https://docs.solana.com/api/http).
 *
 * Naming convention: method names match the Solana RPC method names (camelCase,
 * no prefix) so Sprint 3 implementations wrap JsonRpcClient.call('getSlot', ...).
 *
 * Note: ISolanaRpcProvider.getBalance() shadows IRpcProvider.getBalance().
 * The Solana-specific version returns a raw lamport count rather than a
 * domain Balance object. To avoid the naming collision the lamport-level
 * method is named getSolanaBalance() in this interface; IRpcProvider.getBalance()
 * remains the unified wallet-facing method.
 *
 * Architecture: ARCHITECTURE.md §5.7 — Provider Implementations (Day 11)
 *
 * Sprint 3: SolanaRpcProvider will implement this interface using JsonRpcClient.
 * Sprint 4: Add getTokenAccountsByOwner, getProgramAccounts for SPL tokens.
 */

import type { IRpcProvider } from '../../IRpcProvider'

// ─── Supporting Types ─────────────────────────────────────────────────────────

/** Commitment level for Solana RPC calls. */
export type SolanaCommitment = 'processed' | 'confirmed' | 'finalized'

/**
 * Account data payload — two forms depending on the requested encoding:
 * - binary:     [base58/base64-encoded data, encoding name]
 * - jsonParsed: structured object parsed by the node
 */
export type SolanaAccountData =
  | readonly [string, string]
  | { readonly parsed: unknown; readonly program: string; readonly space: number }

/** Raw account information as returned by the Solana RPC. */
export interface SolanaAccountInfo {
  readonly value: {
    readonly data: SolanaAccountData
    readonly executable: boolean
    readonly lamports: number
    readonly owner: string
    readonly rentEpoch: number
    readonly space: number
  } | null
  readonly context: { readonly slot: number }
}

/** A recent blockhash and the last valid block height for that hash. */
export interface SolanaBlockhashResult {
  readonly value: {
    readonly blockhash: string
    readonly lastValidBlockHeight: number
  }
  readonly context: { readonly slot: number }
}

/** Status of a confirmed / recently-confirmed transaction signature. */
export interface SolanaSignatureStatus {
  readonly slot: number | null
  readonly confirmations: number | null
  /** null on success; error object on failure. */
  readonly err: object | null
  readonly confirmationStatus: SolanaCommitment | null
}

/** A block as returned by the Solana RPC getBlock method. */
export interface SolanaBlock {
  readonly blockhash: string
  readonly previousBlockhash: string
  readonly parentSlot: number
  /** Transaction entries (structure depends on maxSupportedTransactionVersion). */
  readonly transactions: unknown[]
  /** Unix timestamp when the block was confirmed. null if not available. */
  readonly blockTime: number | null
  /** Block height. null for genesis block. */
  readonly blockHeight: number | null
}

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Solana-specific RPC provider.
 *
 * Extends IRpcProvider with low-level Solana JSON-RPC methods for consumers
 * that need access to Solana-specific data not exposed through the generic
 * IRpcProvider interface.
 */
export interface ISolanaRpcProvider extends IRpcProvider {
  /**
   * Returns account information for the given public key.
   *
   * @param pubkey     Base-58 encoded public key.
   * @param encoding   Data encoding. Defaults to 'base58'.
   * @param commitment Commitment level. Defaults to 'finalized'.
   */
  getAccountInfo(
    pubkey: string,
    encoding?: 'base58' | 'base64' | 'jsonParsed',
    commitment?: SolanaCommitment,
  ): Promise<SolanaAccountInfo>

  /**
   * Returns the lamport balance for the given public key.
   *
   * Named getSolanaBalance to avoid collision with IRpcProvider.getBalance()
   * which returns a domain Balance object.
   */
  getSolanaBalance(pubkey: string, commitment?: SolanaCommitment): Promise<number>

  /** Returns a recent blockhash and the last valid block height. */
  getLatestBlockhash(commitment?: SolanaCommitment): Promise<SolanaBlockhashResult>

  /**
   * Submits a pre-signed transaction and returns its signature.
   *
   * @param encodedTx  Base-58 or base-64 encoded signed transaction.
   * @param encoding   Encoding of encodedTx. Defaults to 'base58'.
   * @returns          Transaction signature (base-58 encoded).
   */
  sendRawTransaction(encodedTx: string, encoding?: 'base58' | 'base64'): Promise<string>

  /**
   * Returns the confirmation statuses for one or more transaction signatures.
   *
   * @param signatures                   Array of base-58 transaction signatures.
   * @param options.searchTransactionHistory  Include statuses for transactions
   *                                      older than the last 5 confirmed slots.
   */
  getSignatureStatuses(
    signatures: string[],
    options?: { readonly searchTransactionHistory?: boolean },
  ): Promise<{
    readonly value: Array<SolanaSignatureStatus | null>
    readonly context: { readonly slot: number }
  }>

  /** Returns the current slot number. */
  getSlot(commitment?: SolanaCommitment): Promise<number>

  /**
   * Returns block information for the given slot number.
   *
   * @param slot     Slot number to fetch.
   * @param options  Optional commitment and transaction version constraints.
   * @returns        Block data, or null if the block was skipped.
   */
  getSolanaBlock(
    slot: number,
    options?: {
      readonly commitment?: SolanaCommitment
      readonly maxSupportedTransactionVersion?: number
    },
  ): Promise<SolanaBlock | null>
}
