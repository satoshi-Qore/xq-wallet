/**
 * IEvmRpcProvider.ts — EVM-specific RPC provider interface.
 *
 * Extends IRpcProvider with raw Ethereum JSON-RPC passthrough methods whose
 * names and signatures mirror the official Ethereum JSON-RPC specification
 * (https://ethereum.org/en/developers/docs/apis/json-rpc/).
 *
 * Naming convention: method names use the exact eth_ prefix from the spec so
 * that Sprint 3 implementations are straightforward 1:1 wrappers over
 * JsonRpcClient.call('eth_blockNumber', ...).
 *
 * Supporting types use the Evm prefix to avoid collision with domain types.
 *
 * Architecture: ARCHITECTURE.md §5.7 — Provider Implementations (Day 11)
 *
 * Sprint 3: EvmRpcProvider will implement this interface using JsonRpcClient.
 * Sprint 4: Add eth_getLogs, eth_subscribe once WebSocket transport is ready.
 */

import type { IRpcProvider } from '../../IRpcProvider'

// ─── Supporting Types ─────────────────────────────────────────────────────────

/**
 * EIP-1559 fee history as returned by eth_feeHistory.
 * baseFeePerGas and reward values are hex-encoded wei amounts (strings).
 */
export interface EvmFeeHistory {
  /** Base fee per gas for each block in the requested range (hex wei). */
  readonly baseFeePerGas: string[]
  /** Gas used ratio for each block (0.0–1.0). */
  readonly gasUsedRatio: number[]
  /** Block number of the oldest block in the range (hex). */
  readonly oldestBlock: string
  /** Reward percentiles (if requested). Each inner array corresponds to one block. */
  readonly reward?: string[][]
}

/**
 * A block header as returned by eth_getBlockByNumber.
 * All numeric values are hex strings per Ethereum JSON-RPC convention.
 */
export interface EvmBlock {
  /** Block hash (0x-prefixed). */
  readonly hash: string
  /** Block number (hex). */
  readonly number: string
  /** Parent block hash. */
  readonly parentHash: string
  /** Block timestamp in seconds since epoch (hex). */
  readonly timestamp: string
  /**
   * Transaction hashes when fullTransactions=false;
   * full transaction objects (typed as string for generality) when true.
   */
  readonly transactions: string[]
  /** Gas used by all transactions in this block (hex). */
  readonly gasUsed: string
  /** Maximum gas allowed in this block (hex). */
  readonly gasLimit: string
  /** EIP-1559 base fee per gas (hex). Only present on EIP-1559-compatible chains. */
  readonly baseFeePerGas?: string
  /** Miner / fee recipient address. */
  readonly miner: string
  /** Block difficulty (hex). null on PoS chains. */
  readonly difficulty?: string
  /** Arbitrary extra data field (hex). */
  readonly extraData: string
  /** PoW nonce (hex). \'0x0000000000000000\' on PoS chains. */
  readonly nonce: string
}

/**
 * A transaction receipt as returned by eth_getTransactionReceipt.
 * All numeric values are hex strings.
 */
export interface EvmTransactionReceipt {
  readonly blockHash: string
  readonly blockNumber: string
  readonly transactionHash: string
  readonly transactionIndex: string
  readonly from: string
  readonly to: string | null
  /** '0x0' = reverted (failure); '0x1' = success. */
  readonly status: '0x0' | '0x1'
  /** Actual gas used (hex). */
  readonly gasUsed: string
  /** Contract address for contract deployment transactions; null otherwise. */
  readonly contractAddress: string | null
  readonly logs: EvmLog[]
}

/** A single event log emitted during transaction execution. */
export interface EvmLog {
  /** Contract address that emitted this log. */
  readonly address: string
  /** Indexed event topics (first topic is the event signature hash). */
  readonly topics: string[]
  /** ABI-encoded non-indexed event parameters (hex). */
  readonly data: string
  /** Block number this log was emitted in (hex). */
  readonly blockNumber: string
  readonly transactionHash: string
  /** Log position within the block (hex). */
  readonly logIndex: string
}

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * EVM-specific RPC provider.
 *
 * Extends IRpcProvider (which provides the unified wallet-facing API) with
 * low-level Ethereum JSON-RPC methods for consumers that need access to
 * chain-specific data not exposed through the generic interface.
 */
export interface IEvmRpcProvider extends IRpcProvider {
  /** Returns the block number of the most recent block (hex string). */
  eth_blockNumber(): Promise<string>

  /** Returns the wei balance of an address at the given block tag (hex wei). */
  eth_getBalance(
    address: string,
    blockTag: 'latest' | 'earliest' | 'pending' | string,
  ): Promise<string>

  /** Returns the transaction count (nonce) of an address at the given block tag (hex). */
  eth_getTransactionCount(
    address: string,
    blockTag: 'latest' | 'earliest' | 'pending' | string,
  ): Promise<string>

  /** Submits a pre-signed transaction. Returns the transaction hash. */
  eth_sendRawTransaction(signedTxHex: string): Promise<string>

  /** Executes a message call (read-only) without broadcasting a transaction. */
  eth_call(
    tx: { readonly to: string; readonly data?: string; readonly from?: string },
    blockTag: 'latest' | 'earliest' | 'pending' | string,
  ): Promise<string>

  /** Estimates the gas required to execute the given transaction (hex). */
  eth_estimateGas(tx: {
    readonly from?: string
    readonly to: string
    readonly data?: string
    readonly value?: string
  }): Promise<string>

  /** Returns the current gas price in wei (legacy, pre-EIP-1559) (hex). */
  eth_gasPrice(): Promise<string>

  /** Returns a suggestion for the current maxPriorityFeePerGas (EIP-1559) (hex). */
  eth_maxPriorityFeePerGas(): Promise<string>

  /**
   * Returns historical gas fee data (EIP-1559).
   *
   * @param blockCount          Number of blocks to include in the history.
   * @param newestBlock         Highest block number / tag to start from.
   * @param rewardPercentiles   Percentiles to compute for priority fee data.
   */
  eth_feeHistory(
    blockCount: number,
    newestBlock: 'latest' | string,
    rewardPercentiles: number[],
  ): Promise<EvmFeeHistory>

  /**
   * Returns a block by its tag or number.
   *
   * @param blockTag          Block tag ('latest', 'earliest', 'pending') or hex number.
   * @param fullTransactions  true = return full transaction objects; false = hashes only.
   * @returns                 The block, or null if not found.
   */
  eth_getBlockByNumber(
    blockTag: 'latest' | 'earliest' | 'pending' | string,
    fullTransactions: boolean,
  ): Promise<EvmBlock | null>

  /** Returns the chain ID as a hex string (EIP-695). */
  eth_chainId(): Promise<string>

  /**
   * Returns the receipt of a transaction by its hash.
   * Returns null if the transaction is pending (not yet mined).
   */
  eth_getTransactionReceipt(txHash: string): Promise<EvmTransactionReceipt | null>
}
