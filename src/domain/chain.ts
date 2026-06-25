/**
 * Chain domain types.
 *
 * Pure TypeScript types — no logic, no runtime imports from outside domain/.
 * Actual chain data (RPC URLs, chain IDs, etc.) lives in lib/chain/definitions/.
 *
 * Architecture: ARCHITECTURE.md §6 — Multi-Chain Architecture
 */

// ─── VM Type ───────────────────────────────────────────────────────────────

/**
 * The three virtual machines supported by QoreChain's Triple-VM architecture.
 *
 * - 'native' — QoreChain's native VM (devnet/testnet/mainnet)
 * - 'evm'    — Ethereum-compatible chains (Ethereum, Base, Arbitrum, etc.)
 * - 'svm'    — Solana-compatible chains (Solana, Eclipse, Sonic, etc.)
 */
export type VMType = 'native' | 'evm' | 'svm'

// ─── Native Currency ───────────────────────────────────────────────────────

/** Gas token / native currency definition for a chain. */
export interface NativeCurrency {
  /** Full name: "Ether", "QR Token", "SOL" */
  name: string
  /** Ticker symbol: "ETH", "QR", "SOL" */
  symbol: string
  /**
   * Smallest unit decimal places.
   * EVM standard: 18. Solana: 9. QoreChain native: TBD by SDK.
   */
  decimals: number
}

// ─── Chain Definition ──────────────────────────────────────────────────────

/**
 * Canonical definition of a supported blockchain network.
 *
 * All chain configuration in the app derives from ChainDefinition records
 * registered in ChainRegistry — never hardcoded in components, hooks, or stores.
 *
 * Principle PRIN-ARCH-05: ChainRegistry is the only permitted source of
 * chain configuration.
 */
export interface ChainDefinition {
  /**
   * Unique, stable, kebab-case identifier.
   * Examples: "ethereum", "qorechain-devnet", "solana"
   * Once a wallet is created, changing this ID is a breaking change.
   */
  id: string

  /** Human-readable display name: "Ethereum", "QoreChain Devnet" */
  name: string

  /** Short label for badges and chips: "ETH", "QR", "SOL" */
  shortName: string

  /** Virtual machine this chain runs on */
  vm: VMType

  /**
   * EVM numeric chain ID per EIP-155.
   * null for native QoreChain and SVM chains (they use a different identity system).
   */
  chainId: number | null

  /**
   * RPC endpoint URLs, ordered by priority.
   * Index 0 is the default; higher indices are fallbacks.
   * Sprint 2: used for configuration only — no RPC calls until Sprint 3.
   */
  rpcUrls: readonly string[]

  /** Base URL for the block explorer: "https://etherscan.io" */
  explorerUrl: string

  /** URL path template for transactions: "/tx/{hash}" */
  explorerTxPath: string

  /** URL path template for addresses: "/address/{address}" */
  explorerAddressPath: string

  /** Native currency used for gas fees on this chain */
  nativeCurrency: NativeCurrency

  /**
   * True if this is a test or development network.
   * Testnets are hidden by default in the UI.
   */
  testnet: boolean

  /**
   * False if this chain is defined in the registry but not yet exposed to users.
   * Used to pre-define upcoming chains without surfacing them prematurely.
   */
  enabled: boolean

  /**
   * Key into the chain logo CDN sprite.
   * Never an inlined SVG bundle — keeps the main bundle small.
   * Example: "ethereum", "solana"
   */
  logoKey: string
}
