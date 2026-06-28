/**
 * IRpcProvider.ts — Abstraction over a single blockchain RPC endpoint.
 *
 * Each concrete implementation connects to one chain's RPC node
 * (e.g. Infura for Ethereum, Helius for Solana, or the QoreChain node).
 *
 * Sprint 2: only NullRpcProvider exists (throws RPC_NOT_CONNECTED for all
 *           network operations; returns unavailable for healthCheck).
 * Sprint 3: EthersRpcProvider, SolanaRpcProvider, and NativeRpcProvider will
 *           implement this interface against live RPC endpoints.
 *
 * Design principles:
 *   - One IRpcProvider instance per (vm, chainId) pair.
 *   - Stateless with respect to wallet session — no key material ever enters.
 *   - Signing never happens inside an IRpcProvider — use ITransactionSigner.
 *   - Implementations must be safe to call concurrently.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation
 */

import type { VMType } from '@/domain/chain'
import type { AnyAsset, Balance } from '@/domain/asset'
import type { TransactionRequest, FeeEstimate } from '@/domain/transaction'
import type { RpcBlock, RpcTransaction, RpcHealthReport } from '@/domain/rpc'

/**
 * Abstract interface for a single-chain RPC provider.
 *
 * Consumers should depend on this interface rather than any concrete
 * implementation so that Sprint 3 can swap in real RPC providers without
 * changing the calling code.
 *
 * All methods are async — even deterministic ones — to ensure the interface
 * is compatible with both synchronous mock implementations and async
 * network-backed implementations without requiring API changes.
 */
export interface IRpcProvider {
  /** Virtual machine this provider is connected to. */
  readonly vm: VMType

  /** ChainDefinition.id this provider serves. */
  readonly chainId: string

  /**
   * Returns the block at the given block number.
   *
   * @param blockNumber - Block height / slot number to retrieve.
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   * @throws WalletError('RPC_TIMEOUT') if the request exceeds the timeout.
   * @throws WalletError('RPC_INVALID_RESPONSE') if the response cannot be parsed.
   */
  getBlock(blockNumber: bigint): Promise<RpcBlock>

  /**
   * Returns the most recently confirmed block.
   *
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   */
  getLatestBlock(): Promise<RpcBlock>

  /**
   * Returns the on-chain balance of the given asset at the given address.
   *
   * @param address - On-chain address to query (format is VM-specific).
   * @param asset   - Asset to look up.
   * @returns Balance snapshot with all amounts in the smallest indivisible unit.
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   */
  getBalance(address: string, asset: AnyAsset): Promise<Balance>

  /**
   * Returns the on-chain transaction identified by its hash.
   *
   * @param txHash - Transaction hash (format is VM-specific).
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   * @throws WalletError('RPC_INVALID_RESPONSE') if the hash is not found or the
   *         response cannot be parsed.
   */
  getTransaction(txHash: string): Promise<RpcTransaction>

  /**
   * Broadcasts a signed, serialised transaction to the network.
   *
   * The caller is responsible for signing before calling this method.
   * No key material is accepted or stored here.
   *
   * @param rawTx - VM-specific binary encoding of the fully-signed transaction.
   *                EVM: RLP-encoded EIP-2718 envelope. SVM: Solana Transaction.
   * @returns The transaction hash assigned by the network.
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   */
  sendTransaction(rawTx: Uint8Array): Promise<string>

  /**
   * Queries the RPC node for current fee data and converts it to a FeeEstimate.
   *
   * Complements the MockFeeEstimator (which uses hard-coded values) by
   * providing live fee data when a real endpoint is available.
   *
   * @param request - Transaction request used to determine the gas estimate.
   * @returns FeeEstimate with slow, normal, and fast priority tiers.
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   */
  estimateFee(request: TransactionRequest): Promise<FeeEstimate>

  /**
   * Returns the chain id as reported by the RPC node itself.
   *
   * Used to verify that the configured chainId matches what the node reports,
   * preventing cross-chain transaction submission.
   *
   * @returns The chain id string (matches ChainDefinition.id convention).
   * @throws WalletError('RPC_NOT_CONNECTED') if no live endpoint is available.
   */
  getChainId(): Promise<string>

  /**
   * Performs a lightweight health check against the RPC endpoint.
   *
   * Unlike other methods, healthCheck() MUST NOT throw — it always returns
   * an RpcHealthReport. Callers use the report's status field to make
   * routing decisions.
   *
   * @returns RpcHealthReport describing the endpoint's current availability.
   */
  healthCheck(): Promise<RpcHealthReport>
}
