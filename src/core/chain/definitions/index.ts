/**
 * definitions/index.ts — Barrel for all Sprint 2 chain definitions.
 *
 * DEFAULT_CHAINS is the ordered list to seed a fresh ChainRegistry.
 * Registration order matters: the first entry is the getDefault() fallback.
 */

import type { ChainDefinition } from '@/domain/chain'
import { qorechainDevnet } from './qorechain-devnet'
import { ethereumSepolia } from './ethereum-sepolia'
import { solanaDevnet } from './solana-devnet'

export { qorechainDevnet } from './qorechain-devnet'
export { ethereumSepolia } from './ethereum-sepolia'
export { solanaDevnet } from './solana-devnet'

/**
 * All Sprint 2 chain definitions, ordered by priority.
 * QoreChain Devnet is first so it becomes the default chain.
 */
export const DEFAULT_CHAINS: readonly ChainDefinition[] = Object.freeze([
  qorechainDevnet,
  ethereumSepolia,
  solanaDevnet,
])
