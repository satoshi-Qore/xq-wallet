/**
 * WalletError — typed error class for all wallet domain operations.
 *
 * Security contract: WalletError.message must NEVER contain mnemonic words,
 * private key bytes, seed material, or any sensitive data. The message is
 * safe to display in the UI and include in error telemetry.
 *
 * Sensitive context (the underlying cause) is stored in `internalCause`
 * and must NEVER be forwarded to analytics, Sentry, or any external service.
 *
 * Architecture: ARCHITECTURE.md §11 — Error Model
 * Security: PRIN-SEC-04
 */

// ─── Error Codes ───────────────────────────────────────────────────────────

export type WalletErrorCode =
  // ── BIP-39 ──────────────────────────────────────────────────────────────
  /** The mnemonic string is structurally invalid (wrong format, missing words) */
  | 'INVALID_MNEMONIC'
  /** Word count is not 12 or 24 */
  | 'INVALID_WORD_COUNT'
  /** BIP-39 checksum bits are incorrect (last word encodes checksum) */
  | 'INVALID_CHECKSUM'
  /** One or more words are not in the BIP-39 English wordlist */
  | 'UNKNOWN_WORD'

  // ── Password ─────────────────────────────────────────────────────────────
  /** Password does not meet minimum entropy / complexity requirements */
  | 'WEAK_PASSWORD'
  /** Password and confirmation field do not match */
  | 'PASSWORD_MISMATCH'
  /** Vault decryption failed because the supplied password is wrong */
  | 'INCORRECT_PASSWORD'
  /** Too many failed unlock attempts — rate limit is active */
  | 'TOO_MANY_ATTEMPTS'

  // ── Vault ────────────────────────────────────────────────────────────────
  /** No vault exists in storage for the given walletId */
  | 'VAULT_NOT_FOUND'
  /** Vault data in storage is malformed or cannot be parsed */
  | 'VAULT_CORRUPTED'
  /** AES-GCM authentication tag failed — wrong password or ciphertext was tampered */
  | 'DECRYPTION_FAILED'
  /** AES-GCM encryption failed (unusual — indicates Web Crypto API failure) */
  | 'ENCRYPTION_FAILED'
  /** Vault schema version is newer than this build supports — app needs update */
  | 'VAULT_VERSION_UNSUPPORTED'

  // ── Chain Registry ──────────────────────────────────────────────────────────
  /** A chain definition with the same id was already registered in ChainRegistry */
  | 'CHAIN_ALREADY_REGISTERED'

  // ── Asset Registry ───────────────────────────────────────────────────────
  /** An asset with the same id was already registered in AssetRegistry */
  | 'ASSET_ALREADY_REGISTERED'
  /** No asset matching the requested id or symbol was found in AssetRegistry */
  | 'ASSET_NOT_FOUND'

  // ── Key Derivation ───────────────────────────────────────────────────────
  /** BIP-32 child key derivation failed (extremely rare — curve order hit) */
  | 'DERIVATION_FAILED'
  /** The requested VM type is not yet supported (EVM/SVM in Sprint 2) */
  | 'UNSUPPORTED_VM'
  /** The requested chain ID is not registered in ChainRegistry */
  | 'UNSUPPORTED_CHAIN'

  // ── Chain / RPC ──────────────────────────────────────────────────────────
  /** RPC provider is not available — Sprint 2: always thrown by NullChainProvider */
  | 'RPC_NOT_CONNECTED'
  /** Address failed isValidAddress() for the specified VM */
  | 'INVALID_ADDRESS'

  // ── Transaction ──────────────────────────────────────────────────────────
  /** Transaction amount is zero, negative, or not provided */
  | 'INVALID_AMOUNT'
  /** Account balance is insufficient to cover the requested amount */
  | 'INSUFFICIENT_BALANCE'

  // ── Storage ──────────────────────────────────────────────────────────────
  /** IndexedDB or other storage backend is unavailable */
  | 'STORAGE_UNAVAILABLE'
  /** Storage quota exceeded — cannot write new data */
  | 'STORAGE_QUOTA_EXCEEDED'
  /** IndexedDB schema migration failed during version upgrade */
  | 'STORAGE_SCHEMA_ERROR'

  // ── Generic ──────────────────────────────────────────────────────────────
  /** An unexpected error occurred — see internalCause for details */
  | 'UNKNOWN'

// ─── Error Class ───────────────────────────────────────────────────────────

/**
 * Typed error for all wallet operations.
 *
 * Usage:
 *   throw new WalletError('DECRYPTION_FAILED', 'Incorrect password.')
 *   throw new WalletError('VAULT_NOT_FOUND', 'No wallet found on this device.', originalErr)
 *
 * Catching:
 *   catch (err) {
 *     if (WalletError.isWalletError(err)) {
 *       switch (err.code) { ... }
 *     }
 *   }
 */
export class WalletError extends Error {
  public readonly code: WalletErrorCode

  /**
   * Original underlying error for internal logging/debugging.
   *
   * SECURITY: Never forward this to analytics, Sentry, or any external service.
   * It may contain sensitive stack traces or implementation details.
   * Use only in development tooling and server-side logging that cannot be
   * read by end users.
   */
  public readonly internalCause: unknown

  constructor(
    code: WalletErrorCode,
    /** User-safe message. Must not contain any key material. */
    message: string,
    /** Internal cause for debugging — never shown to users or sent to telemetry. */
    internalCause?: unknown,
  ) {
    super(message)
    this.name = 'WalletError'
    this.code = code
    this.internalCause = internalCause

    // Restore the prototype chain so `instanceof WalletError` works correctly
    // after TypeScript compilation to ES5/ES2017 target
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /**
   * Type guard — narrows `unknown` to `WalletError`.
   *
   * Prefer this over `instanceof` in catch blocks to handle cross-realm errors
   * (e.g., errors thrown across module boundaries in some bundler configurations).
   */
  static isWalletError(err: unknown): err is WalletError {
    return err instanceof WalletError
  }
}
