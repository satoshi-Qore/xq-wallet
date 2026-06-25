/**
 * Ethereum Sepolia — EVM testnet chain definition.
 *
 * Chain ID 11155111 per EIP-155 / chainlist.org.
 * Used for EVM address derivation testing during Sprint 2.
 */

import type { ChainDefinition } from '@/domain/chain'

export const ethereumSepolia: ChainDefinition = {
  id: 'ethereum-sepolia',
  name: 'Ethereum Sepolia',
  shortName: 'SEP',
  vm: 'evm',
  chainId: 11155111,
  rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com'],
  explorerUrl: 'https://sepolia.etherscan.io',
  explorerTxPath: '/tx/{hash}',
  explorerAddressPath: '/address/{address}',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'SEP',
    decimals: 18,
  },
  testnet: true,
  enabled: true,
  logoKey: 'ethereum',
}
