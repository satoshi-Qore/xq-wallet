/**
 * Transaction domain types.
 *
 * Pure TypeScript types — no logic, no imports from outside domain/.
 * Defines the full transaction lifecycle: request → signing payload → result.
 *
 * Design goals:
 *   - VM-agnostic: EVM, SVM, and native transactions share the same models.
 *   - bigint amounts throughout — no floating point.
 *   - Forward-compatible: SigningAlgorithm is an open extensible union so that
 *     hardware wallet drivers and post-quantum schemes can be added in Sprint 3+
 *     without changing the signing pipeline interface.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import type { VMType } from './chain'
import type { WalletErrorCode } from './errors'

// ─── Transaction Type / Status ───────────────────────────────────────────────

/**
 * Discriminator for the transaction union.
 *
 * - 'transfer'        — Move funds between two addresses (most common).
 * - 'contract_call'   — Invoke a smart contract / program method.
 * - 'contract_deploy' — Deploy a new contract / program.
 */
export type TransactionType = 'transfer' | 'contract_call' | 'contract_deploy'

/**
 * Lifecycle state of a transaction.
 *
 * | state      | meaning                                                       |
 * |------------|---------------------------------------------------------------|
 * | pending    | Created locally; not yet signed or submitted.                 |
 * | submitted  | Signed and sent to an RPC node; not yet included in a block.  |
 * | confirmed  | Included in a finalised block.                                |
 * | failed     | Included in a block but execution reverted / failed.          |
 * | dropped    | Evicted from the mempool without being included in a block.   |
 */
export type TransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'dropped'

// ─── Transaction Request ─────────────────────────────────────────────────────

/**
 * A fully-specified, validated transaction intent.
 *
 * A TransactionRequest is the output of TransactionBuilder.build() and the
 * input to WalletService.estimateFee(), validateTransaction(), and
 * prepareSigningPayload(). It holds everything needed to construct the
 * VM-specific binary transaction in Sprint 3.
 *
 * Amounts are in the asset's smallest indivisible unit (no floats).
 */
export interface TransactionRequest {
  /** Stable UUID generated at construction time. */
  readonly id: string
  /** Transaction category — defaults to 'transfer'. */
  readonly type: TransactionType
  /** Virtual machine this transaction targets. */
  readonly vm: VMType
  /** ChainDefinition.id for the target chain (e.g. 'ethereum-sepolia'). */
  readonly chainId: string
  /** Asset id from AssetRegistry (e.g. 'ethereum-sepolia:native:SEP'). */
  readonly assetId: string
  /** Sender address — must pass isValidAddress() for the given VM. */
  readonly from: string
  /** Recipient address — must pass isValidAddress() for the given VM. */
  readonly to: string
  /** Transfer amount in the asset's smallest indivisible unit. Must be > 0. */
  readonly amount: bigint
  /** Optional human-readable note attached to the transaction. */
  readonly memo?: string
  /** Unix timestamp (ms) when this request was created. */
  readonly createdAt: number
}

// ─── Signing Pipeline ────────────────────────────────────────────────────────

/**
 * Signing algorithm identifier.
 *
 * Kept as an open string union (not an enum) so that new algorithms can be
 * added without changing the ITransactionSigner interface contract:
 *   - 'secp256k1-keccak256' — EVM / Native (compact ECDSA, keccak256 pre-hash)
 *   - 'ed25519'             — SVM (raw Ed25519, no pre-hash by the adapter)
 *
 * Future entries (planned Sprint 3+):
 *   - 'dilithium3'           — post-quantum lattice signature (NIST FIPS 204)
 *   - 'ed25519-bls12-381'    — MPC / threshold scheme
 */
export type SigningAlgorithm = 'secp256k1-keccak256' | 'ed25519'

/**
 * The opaque byte payload that an ITransactionSigner must sign.
 *
 * Sprint 2: payload is a canonical JSON encoding of the TransactionRequest
 * fields (bigint serialised as decimal string, keys sorted alphabetically).
 *
 * Sprint 3: payload will be replaced with the proper VM-specific binary
 * encoding (EVM: RLP / EIP-2718 typed envelope; SVM: Solana Transaction;
 * Native: QoreChain SDK encoding) so the payload can be broadcast directly
 * to an RPC node after signing.
 *
 * Forward-compatibility note: ITransactionSigner.sign() only receives a
 * SigningPayload — it never sees the raw TransactionRequest — so the Sprint 3
 * encoding change is invisible to external signers (hardware wallets, MPC
 * services) that implement ITransactionSigner.
 */
export interface SigningPayload {
  /** Matches TransactionRequest.id — links this payload back to its request. */
  readonly transactionId: string
  /**
   * Raw bytes to be signed.
   * The signing algorithm determines how these bytes are processed before
   * the actual cryptographic operation (e.g. keccak256 for secp256k1 adapters).
   */
  readonly payload: Uint8Array
  /** Algorithm the signer must use. */
  readonly algorithm: SigningAlgorithm
  /** BIP-44 account index — identifies which key pair to sign with. */
  readonly accountIndex: number
  /** VM type — for signer routing and display. */
  readonly vm: VMType
  /** Chain id — for signer display and future EIP-155 replay protection. */
  readonly chainId: string
}

/**
 * Output of ITransactionSigner.sign() — the signed transaction artefact.
 */
export interface SignedTransaction {
  /** Matches SigningPayload.transactionId. */
  readonly transactionId: string
  /** Raw signature bytes (64 bytes for both secp256k1 and Ed25519). */
  readonly signatureBytes: Uint8Array
  /** Lowercase hex encoding of signatureBytes. */
  readonly signatureHex: string
  /** Algorithm used to produce this signature. */
  readonly algorithm: SigningAlgorithm
  /** Unix timestamp (ms) when signing occurred. */
  readonly signedAt: number
}

// ─── Fee Model ───────────────────────────────────────────────────────────────

/**
 * Transaction priority — maps to fee speed tiers offered to the user.
 *
 * - 'slow'   — Lowest fee, longest estimated confirmation time.
 * - 'normal' — Balanced fee / speed (recommended default).
 * - 'fast'   — Highest fee, shortest estimated confirmation time.
 */
export type FeePriority = 'slow' | 'normal' | 'fast'

/**
 * Fee estimate for a single priority tier.
 *
 * All amounts are in the chain's native currency smallest unit
 * (wei for EVM, lamports for SVM, QR smallest unit for native).
 * No floating-point values are used.
 *
 * | field            | EVM mapping              | SVM mapping         |
 * |------------------|--------------------------|---------------------|
 * | baseFee          | baseFeePerGas * gasLimit | transaction fee     |
 * | priorityFee      | maxPriorityFeePerGas *   | compute-unit price  |
 * |                  | gasLimit                 | * compute units     |
 * | maxFee           | maxFeePerGas * gasLimit  | baseFee+priorityFee |
 * | estimatedSeconds | block time estimate      | slot time estimate  |
 */
export interface Fee {
  /** Which priority tier this estimate is for. */
  readonly priority: FeePriority
  /** Maximum total fee the sender authorises (baseFee + priorityFee). */
  readonly maxFee: bigint
  /** Base protocol fee component in the native currency's smallest unit. */
  readonly baseFee: bigint
  /** Optional miner / validator tip above baseFee (0 for SVM slow/normal). */
  readonly priorityFee: bigint
  /** Estimated wall-clock seconds until the transaction is confirmed. */
  readonly estimatedSeconds: number
}

/**
 * Full fee estimation result covering all three priority tiers.
 *
 * Returned by IFeeEstimator.estimate() and WalletService.estimateFee().
 */
export interface FeeEstimate {
  /** Asset id of the fee token (always the chain's native gas token). */
  readonly assetId: string
  /** Virtual machine this estimate is for. */
  readonly vm: VMType
  /** ChainDefinition.id this estimate is for. */
  readonly chainId: string
  /** Fee estimate for the 'slow' tier. */
  readonly slow: Fee
  /** Fee estimate for the 'normal' tier (recommended default). */
  readonly normal: Fee
  /** Fee estimate for the 'fast' tier. */
  readonly fast: Fee
  /** Unix timestamp (ms) when this estimate was computed. */
  readonly estimatedAt: number
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Which field of a TransactionRequest failed validation. */
export type TransactionValidationField = 'from' | 'to' | 'amount' | 'asset' | 'network' | 'balance'

/** A single validation failure for one field. */
export interface TransactionValidationError {
  /** The request field that failed validation. */
  readonly field: TransactionValidationField
  /** Structured error code — matches WalletErrorCode for consistency. */
  readonly code: WalletErrorCode
  /** Human-readable description of the failure. Safe to display in UI. */
  readonly message: string
}

/**
 * Aggregate result of validating a TransactionRequest.
 *
 * Unlike WalletService methods that throw on first failure, validateTransaction()
 * collects ALL validation errors so the UI can highlight every problem at once.
 */
export interface TransactionValidationResult {
  /** true only when errors is empty. */
  readonly valid: boolean
  /** All validation failures found. Empty array when valid is true. */
  readonly errors: ReadonlyArray<TransactionValidationError>
}
