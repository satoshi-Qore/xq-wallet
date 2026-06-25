/**
 * src/core/chain/adapters/index.ts — Public barrel for the Chain Adapter layer.
 *
 * Import from '@/core/chain/adapters' — never from internal submodules.
 *
 * Architecture: ARCHITECTURE.md §7 — Chain Adapter Layer
 */

// ─── Interface & Types ─────────────────────────────────────────────────────
export type { IChainAdapter, SignResult, VerifyParams } from './IChainAdapter'

// ─── Concrete Adapters ─────────────────────────────────────────────────────
export { EvmChainAdapter } from './EvmChainAdapter'
export { SvmChainAdapter } from './SvmChainAdapter'
export { NativeChainAdapter } from './NativeChainAdapter'

// ─── Factory ───────────────────────────────────────────────────────────────
export { getAdapter } from './AdapterFactory'
