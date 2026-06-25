/**
 * src/core/chain/index.ts — Public API barrel for the chain layer.
 *
 * Import from '@/core/chain' only — never from internal submodules.
 *
 * Architecture: SYSTEM_ARCHITECTURE.md §3.3 — Chain Layer
 */

// ─── Types ─────────────────────────────────────────────────────────────────
export type { ChainProvider, TransactionStatus, ChainRegistryOptions } from './types'
// ChainDefinition and VMType re-exported so callers need only one import path
export type { ChainDefinition, VMType } from './types'

// ─── Registry ──────────────────────────────────────────────────────────────
export { ChainRegistry } from './ChainRegistry'

// ─── Providers ─────────────────────────────────────────────────────────────
export { NullChainProvider } from './NullChainProvider'

// ─── Chain Definitions ─────────────────────────────────────────────────────
export { qorechainDevnet, ethereumSepolia, solanaDevnet, DEFAULT_CHAINS } from './definitions'
