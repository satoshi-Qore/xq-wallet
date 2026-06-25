/**
 * QoreChain Devnet — native VM chain definition.
 *
 * Coin type 9999 is a placeholder in the BIP-44 derivation path until
 * QoreChain registers an official SLIP-0044 coin type. This is a hard
 * blocker before mainnet launch.
 *
 * RPC URL is a placeholder — replace with the actual devnet endpoint
 * when the QoreChain team publishes it (OQ-1 in QORECHAIN_INTEGRATION_PLAN.md).
 */

import type { ChainDefinition } from '@/domain/chain'

export const qorechainDevnet: ChainDefinition = {
  id: 'qorechain-devnet',
  name: 'QoreChain Devnet',
  shortName: 'QR-DEV',
  vm: 'native',
  chainId: null,
  rpcUrls: ['https://rpc.devnet.qorechain.io'],
  explorerUrl: 'https://explorer.devnet.qorechain.io',
  explorerTxPath: '/tx/{hash}',
  explorerAddressPath: '/address/{address}',
  nativeCurrency: {
    name: 'QoreChain Token',
    symbol: 'QR',
    decimals: 18,
  },
  testnet: true,
  enabled: true,
  logoKey: 'qorechain',
}
