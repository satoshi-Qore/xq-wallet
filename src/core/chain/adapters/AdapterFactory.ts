/**
 * AdapterFactory.ts — Singleton factory for IChainAdapter instances.
 *
 * Returns a shared stateless adapter for the given VMType. Adapters are
 * created once at module load time and reused across all callers.
 *
 * Usage:
 *   import { getAdapter } from '@/core/chain/adapters'
 *   const adapter = getAdapter('evm')
 *   const isValid = adapter.isValidAddress(userInput)
 *
 * Architecture: ARCHITECTURE.md §7 — Chain Adapter Layer
 */

import { WalletError } from '@/domain/errors'
import type { VMType } from '@/domain/chain'
import type { IChainAdapter } from './IChainAdapter'
import { EvmChainAdapter } from './EvmChainAdapter'
import { SvmChainAdapter } from './SvmChainAdapter'
import { NativeChainAdapter } from './NativeChainAdapter'

// ─── Singleton Instances ───────────────────────────────────────────────────

const EVM_ADAPTER: IChainAdapter = new EvmChainAdapter()
const SVM_ADAPTER: IChainAdapter = new SvmChainAdapter()
const NATIVE_ADAPTER: IChainAdapter = new NativeChainAdapter()

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Returns the shared chain adapter for the given VMType.
 *
 * @param vm - The virtual machine type ('evm' | 'svm' | 'native').
 * @returns The corresponding IChainAdapter implementation.
 * @throws WalletError('UNSUPPORTED_VM') if vm is not a known VMType.
 */
export function getAdapter(vm: VMType): IChainAdapter {
  switch (vm) {
    case 'evm':
      return EVM_ADAPTER
    case 'svm':
      return SVM_ADAPTER
    case 'native':
      return NATIVE_ADAPTER
    default: {
      // Exhaustive check — TypeScript will error here if a new VMType is added
      // without updating this switch.
      const _exhaustive: never = vm
      throw new WalletError(
        'UNSUPPORTED_VM',
        `No chain adapter registered for VM type: ${String(_exhaustive)}`,
      )
    }
  }
}
