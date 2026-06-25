/**
 * Global type definitions for XQ Wallet.
 * Feature-specific types should live alongside their feature module.
 */

// ─── Branded types ─────────────────────────────────────────────────────────

/** A blockchain address string. Branded to prevent accidental mixing with plain strings. */
export type Address = string & { readonly __brand: 'Address' }

/** A transaction hash. */
export type TxHash = string & { readonly __brand: 'TxHash' }

/** A raw private key hex string. Keep out of React state — use in secure contexts only. */
export type PrivateKey = string & { readonly __brand: 'PrivateKey' }

// ─── Network ───────────────────────────────────────────────────────────────

export type NetworkEnvironment = 'mainnet' | 'testnet' | 'devnet'

export interface ChainConfig {
  chainId: string
  name: string
  rpcUrl: string
  explorerUrl: string
  environment: NetworkEnvironment
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// ─── UI helpers ────────────────────────────────────────────────────────────

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  status: AsyncStatus
  error: string | null
}

// ─── Re-exports ────────────────────────────────────────────────────────────
// Add feature-specific type re-exports here as feature modules are built.
