/**
 * ITransactionSigner.ts — Abstraction over the transaction signing operation.
 *
 * Kept intentionally minimal so that hardware wallets, MPC signers, and
 * post-quantum signing schemes can be introduced in Sprint 3+ without
 * changing the WalletService interface or any calling code.
 *
 * The interface accepts a SigningPayload — an opaque byte blob — rather than
 * raw private key material. This ensures:
 *   1. Hardware wallet signers never expose private keys to software.
 *   2. MPC signers can distribute the signing across multiple parties.
 *   3. Post-quantum signers can use their own internal key representations.
 *
 * Sprint 2: WalletService signs internally via derivePrivateKeyForSigning +
 *           IChainAdapter.sign(). ITransactionSigner is provided as the
 *           future-proof abstraction that Sprint 3 RPC submission will build on.
 *
 * Architecture: ARCHITECTURE.md §5.6 — Transaction Layer
 */

import type { SigningPayload, SignedTransaction } from '@/domain/transaction'

/**
 * Abstract interface for transaction signing.
 *
 * Implementations must:
 *   - Return a SignedTransaction containing the raw signature bytes.
 *   - Never store the private key beyond the lifetime of the sign() call.
 *   - Be safe to call concurrently (no shared mutable state).
 *
 * Known planned implementations:
 *   - SoftwareTransactionSigner  — wraps WalletService.signMessage (Sprint 3)
 *   - LedgerTransactionSigner    — routes to Ledger hardware device (Sprint 4+)
 *   - MockTransactionSigner      — deterministic test double (Sprint 2 tests)
 */
export interface ITransactionSigner {
  /**
   * Signs the given payload and returns the signed transaction artefact.
   *
   * @param payload - The bytes to sign, plus metadata (algorithm, accountIndex, vm).
   * @returns A SignedTransaction containing signatureBytes, signatureHex, and signedAt.
   * @throws WalletError('DECRYPTION_FAILED') if the signer has no active session.
   * @throws WalletError('DERIVATION_FAILED') if key derivation or signing fails.
   */
  sign(payload: SigningPayload): Promise<SignedTransaction>
}
