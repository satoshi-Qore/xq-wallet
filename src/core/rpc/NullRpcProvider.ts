/**
 * NullRpcProvider.ts — Sprint 2 placeholder implementation of IRpcProvider.
 *
 * Every network operation throws WalletError('RPC_NOT_CONNECTED') with a clear
 * message explaining this is the null provider and that live RPC is available
 * in Sprint 3.
 *
 * healthCheck() is the single exception: it returns an RpcHealthReport with
 * status 'unavailable' instead of throwing, so health-monitoring code can
 * distinguish "unreachable" from "error in the check itself".
 *
 * Usage:
 *   // Pre-populated by WalletService for each supported chain
 *   const provider = new NullRpcProvider('evm', 'ethereum-sepolia')
 *   const report  = await provider.healthCheck() // status: 'unavailable'
 *   await provider.getLatestBlock()              // throws RPC_NOT_CONNECTED
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation
 */

import { WalletError } from '@/domain/errors'
import type { VMType } from '@/domain/chain'
import type { AnyAsset, Balance } from '@/domain/asset'
import type { TransactionRequest, FeeEstimate } from '@/domain/transaction'
import type { RpcBlock, RpcTransaction, RpcHealthReport } from '@/domain/rpc'
import type { IRpcProvider } from './IRpcProvider'

/** @internal Message shared by every throwing method. */
function notConnectedMessage(chainId: string): string {
  return (`No RPC provider is connected for chain '${chainId}'. ` +
    'Live RPC access is available in Sprint 3. ' +
    'Register a concrete IRpcProvider implementation via RpcProviderRegistry.') as string
}

/**
 * Null object implementation of IRpcProvider.
 *
 * Satisfies the IRpcProvider contract without performing any network I/O.
 * Acts as the default provider for all chains in Sprint 2 so that calling
 * code targeting the RPC layer compiles and type-checks without needing a
 * live node. Every call to a network method explicitly surfaces the reason
 * for failure via a WalletError rather than a generic runtime error.
 *
 * Sprint 3 upgrade path:
 *   registry.replace(new EthersRpcProvider('evm', 'ethereum-sepolia', infuraUrl))
 */
export class NullRpcProvider implements IRpcProvider {
  /** @inheritdoc */
  readonly vm: VMType

  /** @inheritdoc */
  readonly chainId: string

  /**
   * @param vm      - Virtual machine type this provider is scoped to.
   * @param chainId - ChainDefinition.id this provider is registered for.
   */
  constructor(vm: VMType, chainId: string) {
    this.vm = vm
    this.chainId = chainId
  }

  // ─── Network operations — all throw RPC_NOT_CONNECTED ────────────────────

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async getBlock(_blockNumber: bigint): Promise<RpcBlock> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async getLatestBlock(): Promise<RpcBlock> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async getBalance(_address: string, _asset: AnyAsset): Promise<Balance> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async getTransaction(_txHash: string): Promise<RpcTransaction> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async sendTransaction(_rawTx: Uint8Array): Promise<string> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async estimateFee(_request: TransactionRequest): Promise<FeeEstimate> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  /**
   * @throws WalletError('RPC_NOT_CONNECTED') always.
   */
  async getChainId(): Promise<string> {
    throw new WalletError('RPC_NOT_CONNECTED', notConnectedMessage(this.chainId))
  }

  // ─── Health check — returns a report instead of throwing ─────────────────

  /**
   * Returns an unavailable health report.
   *
   * Unlike other methods, healthCheck() never throws — it always returns
   * a valid RpcHealthReport. This allows health-monitoring logic to call
   * this method safely without requiring a try/catch.
   *
   * @returns RpcHealthReport with status 'unavailable' and a descriptive error message.
   */
  async healthCheck(): Promise<RpcHealthReport> {
    return {
      endpoint: '',
      status: 'unavailable',
      latencyMs: null,
      lastCheckedAt: Date.now(),
      lastSuccessAt: null,
      errorMessage: notConnectedMessage(this.chainId),
    }
  }
}
