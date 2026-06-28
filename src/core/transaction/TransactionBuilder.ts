/**
 * TransactionBuilder.ts — Fluent, immutable transaction request builder.
 *
 * Each setter returns a new builder instance — the original is unchanged.
 * Call build() to validate all fields and produce a sealed TransactionRequest.
 *
 * Usage:
 *   const request = TransactionBuilder.create()
 *     .type('transfer')
 *     .vm('evm')
 *     .chain('ethereum-sepolia')
 *     .asset('ethereum-sepolia:native:SEP')
 *     .from('0xSender...')
 *     .to('0xRecipient...')
 *     .amount(BigInt('1000000000000000000'))
 *     .memo('Payment for services')
 *     .build()
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import { WalletError } from '@/domain/errors'
import type { TransactionType, TransactionRequest } from '@/domain/transaction'
import type { VMType } from '@/domain/chain'

// ─── Internal State ─────────────────────────────────────────────────────────

interface BuilderState {
  readonly type: TransactionType
  readonly vm: VMType | undefined
  readonly chainId: string | undefined
  readonly assetId: string | undefined
  readonly from: string | undefined
  readonly to: string | undefined
  readonly amount: bigint | undefined
  readonly memo: string | undefined
}

const INITIAL_STATE: BuilderState = {
  type: 'transfer',
  vm: undefined,
  chainId: undefined,
  assetId: undefined,
  from: undefined,
  to: undefined,
  amount: undefined,
  memo: undefined,
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Fluent, immutable builder for TransactionRequest.
 *
 * Every setter returns a new TransactionBuilder — the original is never mutated.
 * This makes it safe to branch builders for comparison or incremental assembly.
 *
 * @example
 * const base = TransactionBuilder.create().vm('evm').chain('ethereum-sepolia')
 * const tx1  = base.from(addr1).to(addr2).amount(BigInt(100)).build()
 * const tx2  = base.from(addr1).to(addr3).amount(BigInt(200)).build()
 * // `base` is unchanged
 */
export class TransactionBuilder {
  private constructor(private readonly _state: BuilderState) {}

  /**
   * Creates a fresh builder with default type = 'transfer'.
   */
  static create(): TransactionBuilder {
    return new TransactionBuilder(INITIAL_STATE)
  }

  // ─── Setters ───────────────────────────────────────────────────────────

  /**
   * Sets the transaction type. Defaults to 'transfer'.
   *
   * @param type - 'transfer' | 'contract_call' | 'contract_deploy'
   */
  type(type: TransactionType): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, type })
  }

  /**
   * Sets the target virtual machine.
   *
   * @param vm - 'native' | 'evm' | 'svm'
   */
  vm(vm: VMType): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, vm })
  }

  /**
   * Sets the target chain id (must match a registered ChainDefinition.id).
   *
   * @param chainId - e.g. 'ethereum-sepolia', 'qorechain-devnet', 'solana-devnet'
   */
  chain(chainId: string): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, chainId })
  }

  /**
   * Sets the asset to transfer (must match a registered AssetRegistry id).
   *
   * @param assetId - e.g. 'ethereum-sepolia:native:SEP'
   */
  asset(assetId: string): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, assetId })
  }

  /**
   * Sets the sender address.
   *
   * @param address - On-chain address; must be valid for the chosen VM.
   */
  from(address: string): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, from: address })
  }

  /**
   * Sets the recipient address.
   *
   * @param address - On-chain address; must be valid for the chosen VM.
   */
  to(address: string): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, to: address })
  }

  /**
   * Sets the transfer amount in the asset's smallest indivisible unit.
   *
   * @param value - Must be greater than zero.
   */
  amount(value: bigint): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, amount: value })
  }

  /**
   * Sets an optional human-readable note for the transaction.
   *
   * @param text - Free-form memo string.
   */
  memo(text: string): TransactionBuilder {
    return new TransactionBuilder({ ...this._state, memo: text })
  }

  // ─── Build ─────────────────────────────────────────────────────────────

  /**
   * Validates all collected fields and returns a sealed TransactionRequest.
   *
   * Validation order: vm → chainId → assetId → from → to → amount.
   * The first validation failure throws immediately (fail-fast).
   * Use WalletService.validateTransaction() instead to collect all errors.
   *
   * @throws WalletError('UNSUPPORTED_VM')   — vm is not provided.
   * @throws WalletError('UNSUPPORTED_CHAIN') — chainId is not provided.
   * @throws WalletError('ASSET_NOT_FOUND')  — assetId is not provided.
   * @throws WalletError('INVALID_ADDRESS')  — from or to is not provided.
   * @throws WalletError('INVALID_AMOUNT')   — amount is not provided or <= 0.
   */
  build(): TransactionRequest {
    const { type, vm, chainId, assetId, from, to, amount, memo } = this._state

    if (vm === undefined) {
      throw new WalletError(
        'UNSUPPORTED_VM',
        'TransactionBuilder: vm is required. Call .vm() before .build().',
      )
    }
    if (!chainId) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        'TransactionBuilder: chainId is required. Call .chain() before .build().',
      )
    }
    if (!assetId) {
      throw new WalletError(
        'ASSET_NOT_FOUND',
        'TransactionBuilder: assetId is required. Call .asset() before .build().',
      )
    }
    if (!from) {
      throw new WalletError(
        'INVALID_ADDRESS',
        'TransactionBuilder: sender address is required. Call .from() before .build().',
      )
    }
    if (!to) {
      throw new WalletError(
        'INVALID_ADDRESS',
        'TransactionBuilder: recipient address is required. Call .to() before .build().',
      )
    }
    if (amount === undefined) {
      throw new WalletError(
        'INVALID_AMOUNT',
        'TransactionBuilder: amount is required. Call .amount() before .build().',
      )
    }
    if (amount <= BigInt(0)) {
      throw new WalletError(
        'INVALID_AMOUNT',
        'TransactionBuilder: amount must be greater than zero.',
      )
    }

    const base = {
      id: globalThis.crypto.randomUUID(),
      type,
      vm,
      chainId,
      assetId,
      from,
      to,
      amount,
      createdAt: Date.now(),
    }
    return memo !== undefined ? { ...base, memo } : base
  }

  // ─── Inspection ────────────────────────────────────────────────────────

  /**
   * Returns a read-only snapshot of the current builder state.
   *
   * Intended for debugging and test assertions — not part of the production API.
   * The returned object is a plain copy; mutating it has no effect on the builder.
   */
  snapshot(): Readonly<BuilderState> {
    return { ...this._state }
  }
}
