/**
 * NullChainProvider.ts — Sprint 2 no-op chain provider.
 *
 * Satisfies the ChainProvider interface without performing any network I/O.
 * Every method immediately throws WalletError('RPC_NOT_CONNECTED') so that
 * accidental calls to chain methods produce clear, typed errors rather than
 * undefined behaviour.
 *
 * Replace with real per-VM providers in Sprint 3.
 */

import { WalletError } from '@/domain/errors'
import type { ChainProvider, TransactionStatus } from './types'

const RPC_MSG = 'No RPC provider is configured. Chain operations are not available until Sprint 3.'

export class NullChainProvider implements ChainProvider {
  constructor(public readonly chainId: string) {}

  getBalance(_address: string): Promise<bigint> {
    throw new WalletError('RPC_NOT_CONNECTED', RPC_MSG)
  }

  estimateFee(_to: string, _value: bigint, _data?: Uint8Array): Promise<bigint> {
    throw new WalletError('RPC_NOT_CONNECTED', RPC_MSG)
  }

  sendRawTransaction(_signedTx: Uint8Array): Promise<string> {
    throw new WalletError('RPC_NOT_CONNECTED', RPC_MSG)
  }

  getTransactionStatus(_hash: string): Promise<TransactionStatus | null> {
    throw new WalletError('RPC_NOT_CONNECTED', RPC_MSG)
  }
}
