/**
 * Vault domain types.
 *
 * The encrypted vault is the only location where key material (mnemonic) is stored.
 *
 * VaultPayload — decrypted content — must NEVER leave vaultService.ts.
 * EncryptedVault — the ciphertext blob — is safe to store in IndexedDB.
 *
 * Security: PRIN-SEC-01, PRIN-SEC-02, SEC-13, SEC-18
 */

// ─── Decrypted Payload ─────────────────────────────────────────────────────

/**
 * VaultPayload — the plaintext content inside the encrypted vault.
 *
 * SECURITY CONTRACT: This type must only be instantiated inside vaultService.ts.
 * It must never be:
 *   - Returned from vaultService to any caller
 *   - Stored in Zustand, React state, or any context
 *   - Passed to a React component
 *   - Serialised to any form
 *   - Logged or included in error messages
 *
 * Use the mnemonic immediately within vaultService, then let the object
 * fall out of scope (garbage collected).
 */
export interface VaultPayload {
  /** Payload schema version — increment if VaultPayload shape changes */
  readonly version: 1
  /**
   * Space-separated BIP-39 mnemonic (12 or 24 words).
   * This is the only secret in the vault. Treat accordingly.
   */
  readonly mnemonic: string
}

// ─── Key Derivation Parameters ─────────────────────────────────────────────

/**
 * PBKDF2 parameters stored alongside the ciphertext.
 * These are public (not secret) — required to re-derive the decryption key.
 */
export interface PBKDF2Params {
  readonly hash: 'SHA-256'
  /**
   * Iteration count for PBKDF2.
   * Minimum: 600,000 per OWASP 2023 recommendation.
   * This value is stored in the vault and verified before decryption.
   * PRIN-SEC (implicit): never accept a count below 600,000 on read.
   */
  readonly iterations: number
  /**
   * Length in bytes of the derived AES key.
   * 32 = 256-bit key for AES-256-GCM.
   */
  readonly keyLength: 32
}

// ─── Encrypted Vault ───────────────────────────────────────────────────────

/**
 * EncryptedVault — the blob stored in IndexedDB via StorageAdapter.
 *
 * The ciphertext is produced by AES-256-GCM, which appends a 16-byte
 * authentication tag. The tag is included in the `ciphertext` field and
 * verified automatically by the Web Crypto API on decryption.
 *
 * If the authentication tag fails verification (wrong password or tampering),
 * AES-GCM decryption throws — vaultService maps this to WalletError('DECRYPTION_FAILED').
 *
 * Security properties:
 *   - Confidentiality: AES-256-GCM with PBKDF2-derived key
 *   - Integrity:       GCM authentication tag (16 bytes)
 *   - Uniqueness:      Fresh random IV and salt per write (SEC-18)
 */
export interface EncryptedVault {
  /**
   * Vault envelope schema version.
   * Increment whenever the EncryptedVault shape changes.
   * Used by the vault migration framework to handle old vaults.
   * Current version: 1
   */
  readonly version: 1

  /**
   * Matches WalletMetadata.id — the primary key in the "vaults" object store.
   */
  readonly walletId: string

  readonly crypto: {
    readonly algorithm: 'AES-GCM'

    /**
     * base64url-encoded AES-256-GCM ciphertext.
     * Includes the 16-byte GCM authentication tag appended by the Web Crypto API.
     */
    readonly ciphertext: string

    /**
     * base64url-encoded 12-byte IV (nonce).
     * Generated fresh from crypto.getRandomValues() on every vault write.
     * MUST be unique per (key, nonce) pair — GCM nonce reuse is catastrophic.
     */
    readonly iv: string

    /**
     * base64url-encoded 32-byte random salt for PBKDF2.
     * Generated fresh from crypto.getRandomValues() on every vault write.
     */
    readonly salt: string

    readonly kdf: 'PBKDF2'
    readonly kdfParams: PBKDF2Params
  }

  /** Unix timestamp (ms) — when this vault was first created */
  readonly createdAt: number

  /**
   * Unix timestamp (ms) — when this vault was last written.
   * Updated on password rotation. Same as createdAt on first write.
   */
  readonly updatedAt: number
}
