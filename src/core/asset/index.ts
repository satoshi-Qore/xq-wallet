/**
 * src/core/asset/index.ts — Public API barrel for the asset layer.
 *
 * Import from '@/core/asset' only — never from internal submodules.
 *
 * Architecture: ARCHITECTURE.md §5.5 — Asset Layer
 */

// ─── Registry ──────────────────────────────────────────────────────────────
export { AssetRegistry } from './AssetRegistry'

// ─── Provider Abstraction ──────────────────────────────────────────────────
export type { IBalanceProvider } from './IBalanceProvider'

// ─── Mock Provider ─────────────────────────────────────────────────────────
export { MockBalanceProvider } from './MockBalanceProvider'

// ─── Default Assets ────────────────────────────────────────────────────────
export {
  QR_DEVNET,
  SEP_SEPOLIA,
  SOL_DEVNET,
  DEFAULT_ASSETS,
  createDefaultAssetRegistry,
} from './defaultAssets'
