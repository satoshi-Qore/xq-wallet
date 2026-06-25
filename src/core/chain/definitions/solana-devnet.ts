/**
 * Solana Devnet — SVM chain definition.
 *
 * Uses the Solana Foundation's public devnet RPC endpoint.
 * Explorer links include ?cluster=devnet so they resolve correctly.
 */

import type { ChainDefinition } from '@/domain/chain'

export const solanaDevnet: ChainDefinition = {
  id: 'solana-devnet',
  name: 'Solana Devnet',
  shortName: 'SOL-DEV',
  vm: 'svm',
  chainId: null,
  rpcUrls: ['https://api.devnet.solana.com'],
  explorerUrl: 'https://explorer.solana.com',
  explorerTxPath: '/tx/{hash}?cluster=devnet',
  explorerAddressPath: '/address/{address}?cluster=devnet',
  nativeCurrency: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
  },
  testnet: true,
  enabled: true,
  logoKey: 'solana',
}
