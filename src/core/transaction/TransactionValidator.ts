/**
 * TransactionValidator.ts — Stateless transaction request validator.
 *
 * Collects ALL validation errors in a single pass so the UI can surface every
 * problem simultaneously (unlike TransactionBuilder.build() which is fail-fast).
 *
 * Address validation delegates to the chain adapter layer (IChainAdapter) so
 * that VM-specific rules are applied consistently in both the builder and the
 * validator.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import { getAdapter } from '@/core/chain/adapters'
import type { VMType } from '@/domain/chain'
import type { Balance } from '@/domain/asset'
import type {
  TransactionRequest,
  TransactionValidationError,
  TransactionValidationResult,
} from '@/domain/transaction'

// ─── TransactionValidator ────────────────────────────────────────────────────

/**
 * Stateless utility for validating TransactionRequest instances.
 *
 * All methods are static — no instance is required.
 *
 * @example
 * const result = TransactionValidator.validate(request, balance)
 * if (!result.valid) {
 *   for (const err of result.errors) {
 *     console.error(err.field, err.message)
 *   }
 * }
 */
export class TransactionValidator {
  // ─── Individual Field Validators ─────────────────────────────────────

  /**
   * Validates a 'from' (sender) address for the given VM.
   *
   * @param from - Candidate sender address.
   * @param vm   - Virtual machine type to validate against.
   * @returns A TransactionValidationError if invalid, null if valid.
   */
  static validateFrom(from: string, vm: VMType): TransactionValidationError | null {
    if (!from) {
      return {
        field: 'from',
        code: 'INVALID_ADDRESS',
        message: 'Sender address is required.',
      }
    }
    let valid = false
    try {
      valid = getAdapter(vm).isValidAddress(from)
    } catch {
      valid = false
    }
    if (!valid) {
      return {
        field: 'from',
        code: 'INVALID_ADDRESS',
        message: `Sender address "${from}" is not valid for the ${vm} VM.`,
      }
    }
    return null
  }

  /**
   * Validates a 'to' (recipient) address for the given VM.
   *
   * @param to - Candidate recipient address.
   * @param vm - Virtual machine type to validate against.
   * @returns A TransactionValidationError if invalid, null if valid.
   */
  static validateTo(to: string, vm: VMType): TransactionValidationError | null {
    if (!to) {
      return {
        field: 'to',
        code: 'INVALID_ADDRESS',
        message: 'Recipient address is required.',
      }
    }
    let valid = false
    try {
      valid = getAdapter(vm).isValidAddress(to)
    } catch {
      valid = false
    }
    if (!valid) {
      return {
        field: 'to',
        code: 'INVALID_ADDRESS',
        message: `Recipient address "${to}" is not valid for the ${vm} VM.`,
      }
    }
    return null
  }

  /**
   * Validates that the amount is a positive bigint.
   *
   * @param amount - Amount in the asset's smallest indivisible unit.
   * @returns A TransactionValidationError if invalid, null if valid.
   */
  static validateAmount(amount: bigint): TransactionValidationError | null {
    if (amount <= BigInt(0)) {
      return {
        field: 'amount',
        code: 'INVALID_AMOUNT',
        message: `Transaction amount must be greater than zero. Got: ${amount.toString()}.`,
      }
    }
    return null
  }

  /**
   * Validates that the available balance is sufficient to cover the amount.
   *
   * @param amount  - Requested transfer amount in smallest unit.
   * @param balance - Current balance snapshot (available field is used).
   * @returns A TransactionValidationError if insufficient, null if sufficient.
   */
  static validateBalance(amount: bigint, balance: Balance): TransactionValidationError | null {
    if (amount > balance.available) {
      return {
        field: 'balance',
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Required: ${amount.toString()} ${balance.symbol}. Available: ${balance.available.toString()} ${balance.symbol}.`,
      }
    }
    return null
  }

  /**
   * Validates that the asset id is not empty.
   *
   * @param assetId - Asset id string.
   * @returns A TransactionValidationError if empty, null if valid.
   */
  static validateAsset(assetId: string): TransactionValidationError | null {
    if (!assetId) {
      return {
        field: 'asset',
        code: 'ASSET_NOT_FOUND',
        message: 'Asset id is required.',
      }
    }
    return null
  }

  /**
   * Validates that the chainId is not empty.
   *
   * @param chainId - Chain definition id.
   * @returns A TransactionValidationError if empty, null if valid.
   */
  static validateNetwork(chainId: string): TransactionValidationError | null {
    if (!chainId) {
      return {
        field: 'network',
        code: 'UNSUPPORTED_CHAIN',
        message: 'Chain id is required.',
      }
    }
    return null
  }

  // ─── Aggregate Validator ─────────────────────────────────────────────

  /**
   * Runs all field validations on a TransactionRequest and returns an
   * aggregate result containing every error found.
   *
   * Optionally accepts a Balance snapshot to validate sufficiency.
   * When balance is not provided, the balance check is skipped.
   *
   * @param request - TransactionRequest to validate.
   * @param balance - Optional current balance for sufficiency check.
   * @returns TransactionValidationResult with valid flag and error list.
   */
  static validate(request: TransactionRequest, balance?: Balance): TransactionValidationResult {
    const errors: TransactionValidationError[] = []

    const fromError = TransactionValidator.validateFrom(request.from, request.vm)
    if (fromError !== null) errors.push(fromError)

    const toError = TransactionValidator.validateTo(request.to, request.vm)
    if (toError !== null) errors.push(toError)

    const amountError = TransactionValidator.validateAmount(request.amount)
    if (amountError !== null) errors.push(amountError)

    const assetError = TransactionValidator.validateAsset(request.assetId)
    if (assetError !== null) errors.push(assetError)

    const networkError = TransactionValidator.validateNetwork(request.chainId)
    if (networkError !== null) errors.push(networkError)

    if (balance !== undefined) {
      const balanceError = TransactionValidator.validateBalance(request.amount, balance)
      if (balanceError !== null) errors.push(balanceError)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
