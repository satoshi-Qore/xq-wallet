/**
 * Centralized application configuration.
 * All env vars are read here — never import process.env directly in components.
 */

import type { ChainConfig, NetworkEnvironment } from '@/types'

/**
 * Asserts that an environment variable is set in production.
 * Call this inside server-side code or API routes for required secrets.
 * @example const key = requireEnv('DATABASE_URL')
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value ?? ''
}

// ─── App ───────────────────────────────────────────────────────────────────

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? 'XQ Wallet',
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
  environment: (process.env.NEXT_PUBLIC_ENVIRONMENT ?? 'development') as NetworkEnvironment,
} as const

// ─── Chain ─────────────────────────────────────────────────────────────────

export const chainConfig: ChainConfig = {
  chainId: process.env.NEXT_PUBLIC_QORECHAIN_CHAIN_ID ?? '',
  name: 'QoreChain',
  rpcUrl: process.env.NEXT_PUBLIC_QORECHAIN_RPC_URL ?? '',
  explorerUrl: process.env.NEXT_PUBLIC_QORECHAIN_EXPLORER_URL ?? '',
  environment: (process.env.NEXT_PUBLIC_ENVIRONMENT ?? 'development') as NetworkEnvironment,
  nativeCurrency: {
    name: 'QoreChain Token',
    symbol: 'XQ',
    decimals: 18,
  },
}

// ─── API ───────────────────────────────────────────────────────────────────

export const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
} as const

// ─── Feature flags ─────────────────────────────────────────────────────────

export const featureFlags = {
  enableTestnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === 'true',
  enableDevtools:
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === 'true' || process.env.NODE_ENV === 'development',
} as const

// ─── Aggregated export ─────────────────────────────────────────────────────

export const config = {
  app: appConfig,
  chain: chainConfig,
  api: apiConfig,
  features: featureFlags,
} as const

export type AppConfig = typeof config

export {
  ACTIVE_RELEASE_POLICY,
  assertReleaseCapability,
  type ReleaseCapability,
  type ReleasePolicy,
} from './releasePolicy'
