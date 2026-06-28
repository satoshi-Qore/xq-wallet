/**
 * core/rpc/providers — Provider interfaces barrel.
 *
 * Re-exports all chain-specific RPC provider interfaces.
 * Sprint 3: concrete implementations will be added under each subdirectory.
 */

// EVM (Ethereum, Ethereum Sepolia, and future EVM-compatible chains)
export type { IEvmRpcProvider, EvmFeeHistory, EvmBlock, EvmTransactionReceipt, EvmLog } from './evm'

// Solana (Solana mainnet, Solana devnet)
export type {
  ISolanaRpcProvider,
  SolanaCommitment,
  SolanaAccountData,
  SolanaAccountInfo,
  SolanaBlockhashResult,
  SolanaSignatureStatus,
  SolanaBlock,
} from './solana'

// QoreChain (qorechain-devnet, qorechain-mainnet)
export type { IQoreRpcProvider, QoreBlock } from './qore'
