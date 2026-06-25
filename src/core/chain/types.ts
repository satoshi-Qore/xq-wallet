/**
 * types.ts — Chain layer shared types.
 *
 * ChainProvider is the abstract interface every chain integration must implement.
 * ChainDefinition and VMType are imported from the domain layer — not redefined here.
 *
 * Architecture: SYSTEM_ARCHITECTURE.md §3.3 — Chain Layer
 */

// Re-export so callers can import everything from @/core/chain
export type { ChainDefinition, VMType } from '@/domain/chain'

// ─── ChainProvider ─────────────────────────────────────────────────────────

/**
 * Abstract interface for all chain RPC integrations.
 *
 * Sprint 2: only NullChainProvider exists — every method throws RPC_NOT_CONNECTED.
 * Sprint 3: real per-VM providers replace NullChainProvider.
 *
 * Rule: callers never touch this interface directly. They go through the
 * wallet service layer, which selects the correct provider at runtime.
 */
export interface ChainProvider {
  /** Chain ID this provider is bound to. Must match a registered ChainDefinition.id. */
  readonly chainId: string

  /**
   * Returns the native token balance for the given address in the smallest unit
   * (wei for EVM, lamports for SVM, smallest-unit QR for native).
   */
  getBalance(address: string): Promise<bigint>

  /**
   * Estimates the transaction fee in the smallest native unit.
   *
   * @param to    - Recipient address
   * @param value - Value to transfer in smallest unit
   * @param data  - Optional calldata / instruction bytes
   */
  estimateFee(to: string, value: bigint, data?: Uint8Array): Promise<bigint>

  /**
   * Broadcasts a pre-signed raw transaction.
   * Returns the transaction hash on success.
   */
  sendRawTransaction(signedTx: Uint8Array): Promise<string>

  /**
   * Returns the status of a transaction by its hash, or null if not found.
   */
  getTransactionStatus(hash: string): Promise<TransactionStatus | null>
}

/** The three possible states of an on-chain transaction. */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

// ─── ChainRegistryOptions ──────────────────────────────────────────────────

/** Constructor options for ChainRegistry. */
export interface ChainRegistryOptions {
  /**
   * The chain ID to return from getDefault().
   * If omitted, getDefault() returns the first registered chain.
   */
  readonly defaultChainId?: string
}
