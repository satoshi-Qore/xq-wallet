/**
 * IQoreRpcProvider.ts — QoreChain-specific RPC provider interface.
 *
 * Extends IRpcProvider with QoreChain JSON-RPC passthrough methods.
 * Method names use the 'qore_' prefix to distinguish them from Ethereum
 * eth_ methods. The full QoreChain RPC specification is defined in the
 * internal QoreChain node documentation.
 *
 * Architecture: ARCHITECTURE.md §5.7 — Provider Implementations (Day 11)
 *
 * Sprint 3: QoreRpcProvider will implement this interface using JsonRpcClient.
 * Sprint 4: Complete method surface once the QoreChain node RPC spec is
 *           finalised and the devnet node is available.
 */

import type { IRpcProvider } from '../../IRpcProvider'

// ─── Supporting Types ─────────────────────────────────────────────────────────

/**
 * A QoreChain block header as returned by qore_getBlockByNumber.
 * Numeric values are hex strings (same convention as Ethereum JSON-RPC).
 */
export interface QoreBlock {
  /** Block hash (hex). */
  readonly hash: string
  /** Block number (hex). */
  readonly number: string
  /** Parent block hash (hex). */
  readonly parentHash: string
  /** Block timestamp in seconds since epoch (hex). */
  readonly timestamp: string
  /** Transaction hashes in this block. */
  readonly transactions: string[]
  /** Validator / producer address. */
  readonly validator: string
  /** Extra chain-specific metadata (structure TBD in Sprint 4). */
  readonly extraData?: string
}

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * QoreChain-specific RPC provider.
 *
 * Extends IRpcProvider with low-level QoreChain JSON-RPC methods.
 * This interface is intentionally minimal for Sprint 2; it will be expanded
 * in Sprint 4 when the full QoreChain node RPC specification is available.
 */
export interface IQoreRpcProvider extends IRpcProvider {
  /** Returns the number of the most recent block (hex string). */
  qore_blockNumber(): Promise<string>

  /**
   * Returns the native balance (in smallest unit) for the given address.
   *
   * @param address   QoreChain address.
   * @param blockTag  Block tag or hex number. Defaults to 'latest'.
   * @returns         Balance in the native currency's smallest unit (hex).
   */
  qore_getBalance(address: string, blockTag?: 'latest' | string): Promise<string>

  /**
   * Submits a pre-signed transaction to the network.
   *
   * @param signedTxHex  Hex-encoded signed transaction bytes.
   * @returns            Transaction hash (hex).
   */
  qore_sendRawTransaction(signedTxHex: string): Promise<string>

  /** Returns the QoreChain chain ID as a hex string. */
  qore_chainId(): Promise<string>

  /**
   * Returns block information for the given block tag or number.
   *
   * @param blockTag         Block tag ('latest') or hex block number.
   * @param fullTransactions true = include full transaction objects; false = hashes only.
   * @returns                Block data or null if not found.
   */
  qore_getBlockByNumber(
    blockTag: 'latest' | string,
    fullTransactions: boolean,
  ): Promise<QoreBlock | null>

  /**
   * Returns the number of transactions sent from an address.
   *
   * @param address   QoreChain address.
   * @param blockTag  Block tag or hex number. Defaults to 'latest'.
   * @returns         Transaction count (hex).
   */
  qore_getTransactionCount(address: string, blockTag?: 'latest' | string): Promise<string>
}
