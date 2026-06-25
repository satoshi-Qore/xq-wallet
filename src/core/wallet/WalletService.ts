/**
 * WalletService.ts — In-memory wallet engine.
 *
 * Wires together all three lower layers:
 *   Day 1 — domain types (WalletMetadata, AccountMetadata, EncryptedVault, …)
 *   Day 2 — crypto layer (mnemonic generation/validation, seed derivation)
 *   Day 3 — derivation layer (deriveAllAccounts, address adapters)
 *
 * Sprint 2 scope: no persistence (IndexedDB / StorageAdapter) — everything
 * lives in memory. Persistence will be added in Sprint 3 via a separate
 * StorageAdapter layer that this service will accept as a constructor argument.
 *
 * Lock model:
 *   LOCKED   — EncryptedVault is in memory; mnemonic is not.
 *              getAccounts() works (public data). deriveNextAccount() throws.
 *   UNLOCKED — Session is active: decrypted mnemonic held in sessionMnemonic.
 *              All operations available.
 *
 * Vault encryption: AES-256-GCM with PBKDF2-SHA-256 key derivation.
 *   Default: 600,000 iterations (OWASP 2023 minimum).
 *   Override via constructor for testing (use 1 iteration in unit tests).
 *
 * Security invariants:
 *   SEC-01 — mnemonic never serialised (it lives only in sessionMnemonic while unlocked)
 *   SEC-02 — seed buffers zeroed in finally blocks inside deriveAllAccounts
 *   SEC-04 — no Math.random(); all randomness from crypto.getRandomValues()
 *
 * Architecture: ARCHITECTURE.md §5.4 — Wallet Service
 */

import { WalletError } from '@/domain/errors'
import type { WalletMetadata, AccountMetadata, WordCount } from '@/domain/wallet'
import type { EncryptedVault, VaultPayload, PBKDF2Params } from '@/domain/vault'
import { generate, assertValidMnemonic } from '@/core/crypto'
import {
  deriveAllAccounts,
  derivePrivateKeyForSigning,
  type DeriveAllAccountsOptions,
} from './derive'
import { getAdapter } from '@/core/chain/adapters'
import type { SignResult, VerifyParams } from '@/core/chain/adapters'
import type { VMType } from '@/domain/chain'

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_PBKDF2_ITERATIONS = 600_000 // OWASP 2023 minimum
const MIN_PASSWORD_LENGTH = 8
const WALLET_SCHEMA_VERSION = 1 as const
const VAULT_SCHEMA_VERSION = 1 as const

/**
 * Default chain IDs used when deriving accounts.
 * Sprint 2: hardcoded devnet chains.
 * Sprint 3: ChainRegistry will provide this dynamically.
 */
const DEFAULT_DERIVE_OPTIONS: Omit<DeriveAllAccountsOptions, 'accountName'> = {
  svmChainIds: ['solana'],
  nativeChainIds: ['qorechain-devnet'],
}

// ─── Public Option / Result Types ──────────────────────────────────────────

export interface WalletServiceOptions {
  /**
   * PBKDF2 iteration count for vault encryption / decryption.
   *
   * Production default: 600,000 (OWASP 2023 minimum).
   * Override in unit tests to keep suites fast:
   *   new WalletService({ pbkdf2Iterations: 1 })
   */
  readonly pbkdf2Iterations?: number
}

export interface CreateWalletOptions {
  /** Vault encryption password. Minimum 8 characters. */
  readonly password: string
  /** BIP-39 word count for the generated mnemonic. Default: 12. */
  readonly wordCount?: WordCount
  /** Display name for the wallet. Default: "My Wallet". */
  readonly walletName?: string
}

export interface ImportWalletOptions {
  /** Existing BIP-39 mnemonic to import. Any case; extra whitespace tolerated. */
  readonly mnemonic: string
  /** Vault encryption password. Minimum 8 characters. */
  readonly password: string
  /** Display name for the wallet. Default: "My Wallet". */
  readonly walletName?: string
}

export interface CreateWalletResult {
  /** Wallet metadata — public information only. Safe to display / store. */
  readonly wallet: WalletMetadata
  /**
   * The generated BIP-39 mnemonic phrase.
   *
   * SECURITY: Show this to the user ONCE for backup. Never store it anywhere.
   * This value is not retained by the service — it cannot be recovered after
   * this call returns.
   */
  readonly mnemonic: string
}

// ─── WalletService ─────────────────────────────────────────────────────────

export class WalletService {
  private readonly pbkdf2Iterations: number

  /** In-memory encrypted vault. null until createWallet / importWallet. */
  private encryptedVault: EncryptedVault | null = null

  /** Public wallet metadata. null until createWallet / importWallet. */
  private walletMetadata: WalletMetadata | null = null

  /**
   * Active session — holds the plaintext mnemonic while unlocked.
   * null when locked (cleared by lockWallet()).
   *
   * SEC-01: never serialised, never logged, never placed in any store.
   */
  private sessionMnemonic: string | null = null

  constructor(options: WalletServiceOptions = {}) {
    this.pbkdf2Iterations = options.pbkdf2Iterations ?? DEFAULT_PBKDF2_ITERATIONS
  }

  // ─── State Accessors ──────────────────────────────────────────────────────

  /** true when session is active (mnemonic in memory). false after lock(). */
  get isLocked(): boolean {
    return this.sessionMnemonic === null
  }

  /** true after createWallet() or importWallet() has been called successfully. */
  get isInitialized(): boolean {
    return this.walletMetadata !== null
  }

  /**
   * Read-only access to the wallet metadata currently held in memory.
   * null until createWallet() or importWallet() has been called.
   * Does not decrypt or touch any key material.
   */
  get wallet(): WalletMetadata | null {
    return this.walletMetadata
  }

  // ─── Create / Import ─────────────────────────────────────────────────────

  /**
   * Generates a new BIP-39 mnemonic, derives the first account, encrypts the
   * vault, and starts an active session (wallet is unlocked on return).
   *
   * @returns The wallet metadata and the one-time mnemonic phrase.
   * @throws WalletError('WEAK_PASSWORD') if password is too short.
   */
  async createWallet(options: CreateWalletOptions): Promise<CreateWalletResult> {
    const { password, wordCount = 12, walletName = 'My Wallet' } = options

    assertValidPassword(password)

    const mnemonic = generate(wordCount)
    await this._initWallet(mnemonic, password, walletName, wordCount)

    return { wallet: this.walletMetadata!, mnemonic }
  }

  /**
   * Imports an existing BIP-39 mnemonic, derives the first account, encrypts
   * the vault, and starts an active session (wallet is unlocked on return).
   *
   * @throws WalletError('INVALID_MNEMONIC' | 'INVALID_WORD_COUNT' | 'UNKNOWN_WORD' | 'INVALID_CHECKSUM')
   *         if the mnemonic is invalid.
   * @throws WalletError('WEAK_PASSWORD') if password is too short.
   */
  async importWallet(options: ImportWalletOptions): Promise<void> {
    const { mnemonic, password, walletName = 'My Wallet' } = options

    assertValidMnemonic(mnemonic)
    assertValidPassword(password)

    const wordCount = mnemonic.trim().split(/\s+/).length as WordCount
    await this._initWallet(mnemonic, password, walletName, wordCount)
  }

  // ─── Unlock / Lock ────────────────────────────────────────────────────────

  /**
   * Decrypts the in-memory vault with the supplied password, establishing a
   * session. If the wallet is already unlocked this is a no-op.
   *
   * @throws WalletError('VAULT_NOT_FOUND')   — no wallet has been created/imported.
   * @throws WalletError('INCORRECT_PASSWORD') — AES-GCM authentication tag failed.
   */
  async unlockWallet(password: string): Promise<void> {
    if (!this.encryptedVault) {
      throw new WalletError('VAULT_NOT_FOUND', 'No wallet found. Create or import a wallet first.')
    }

    // Already unlocked — no-op; do not re-derive or re-validate.
    if (!this.isLocked) return

    const payload = await decryptVault(this.encryptedVault, password)
    this.sessionMnemonic = payload.mnemonic

    this.walletMetadata = { ...this.walletMetadata!, lastUnlockedAt: Date.now() }
  }

  /**
   * Clears the in-memory session (mnemonic reference dropped for GC).
   * Safe to call when already locked.
   */
  lockWallet(): void {
    this.sessionMnemonic = null
  }

  // ─── Accounts ─────────────────────────────────────────────────────────────

  /**
   * Returns all derived accounts. Available even when the wallet is locked
   * (accounts contain only public information — no key material).
   *
   * @throws WalletError('VAULT_NOT_FOUND') — no wallet has been created/imported.
   */
  getAccounts(): AccountMetadata[] {
    if (!this.walletMetadata) {
      throw new WalletError('VAULT_NOT_FOUND', 'No wallet found. Create or import a wallet first.')
    }
    // Return a shallow copy so callers cannot mutate internal state.
    return [...this.walletMetadata.accounts]
  }

  /**
   * Derives the next account (index = current account count) and appends it
   * to the wallet. Requires an active session (wallet must be unlocked).
   *
   * @param name — Optional display name. Defaults to "Account {n}".
   * @throws WalletError('VAULT_NOT_FOUND')   — no wallet exists.
   * @throws WalletError('DECRYPTION_FAILED') — wallet is locked.
   */
  async deriveNextAccount(name?: string): Promise<AccountMetadata> {
    this._assertUnlocked()

    const nextIndex = this.walletMetadata!.accounts.length

    const account = await deriveAllAccounts(this.sessionMnemonic!, nextIndex, {
      ...DEFAULT_DERIVE_OPTIONS,
      ...(name !== undefined ? { accountName: name } : {}),
    })

    this.walletMetadata = {
      ...this.walletMetadata!,
      accounts: [...this.walletMetadata!.accounts, account],
    }

    return account
  }

  // ─── Chain Adapter Integration ────────────────────────────────────────────

  /**
   * Validates whether an address string is structurally well-formed for the
   * given VM. Does not require the wallet to be unlocked.
   *
   * @param address - Candidate address string.
   * @param vm      - Virtual machine type to validate against.
   * @returns true if the address is valid, false otherwise. Never throws.
   * @throws WalletError('UNSUPPORTED_VM') if vm is not a known VMType.
   */
  validateAddress(address: string, vm: VMType): boolean {
    return getAdapter(vm).isValidAddress(address)
  }

  /**
   * Signs raw message bytes with the private key for the given account and VM.
   *
   * The private key is derived transiently from the session mnemonic and zeroed
   * immediately after signing. The mnemonic itself is never forwarded to the
   * adapter. (SEC-01)
   *
   * @param message      - Raw bytes to sign. Pre-hashing is adapter-specific.
   * @param accountIndex - BIP-44 account index to sign with.
   * @param vm           - Virtual machine type determining the signing algorithm.
   * @returns SignResult containing signature bytes and hex encoding.
   * @throws WalletError('VAULT_NOT_FOUND')   if no wallet exists.
   * @throws WalletError('DECRYPTION_FAILED') if the wallet is locked.
   * @throws WalletError('DERIVATION_FAILED') on key derivation or signing failure.
   */
  async signMessage(message: Uint8Array, accountIndex: number, vm: VMType): Promise<SignResult> {
    this._assertUnlocked()
    const adapter = getAdapter(vm)
    const privateKey = await derivePrivateKeyForSigning(this.sessionMnemonic!, accountIndex, vm)
    try {
      return adapter.sign(privateKey, message)
    } finally {
      privateKey.fill(0) // SEC-01: zero private key immediately after use
    }
  }

  /**
   * Verifies a signature against the original message and a public key.
   * Does not require the wallet to be unlocked.
   *
   * @param vm     - Virtual machine type determining the verification algorithm.
   * @param params - publicKeyHex, message, and signature.
   * @returns true if the signature is valid, false otherwise.
   * @throws WalletError('UNSUPPORTED_VM')   if vm is not a known VMType.
   * @throws WalletError('INVALID_ADDRESS')  if publicKeyHex is malformed.
   */
  verifySignature(vm: VMType, params: VerifyParams): boolean {
    return getAdapter(vm).verify(params)
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private _assertUnlocked(): void {
    if (!this.walletMetadata) {
      throw new WalletError('VAULT_NOT_FOUND', 'No wallet found. Create or import a wallet first.')
    }
    if (this.isLocked) {
      throw new WalletError(
        'DECRYPTION_FAILED',
        'Wallet is locked. Unlock the wallet before performing this action.',
      )
    }
  }

  private async _initWallet(
    mnemonic: string,
    password: string,
    walletName: string,
    wordCount: WordCount,
  ): Promise<void> {
    const walletId = globalThis.crypto.randomUUID()
    const now = Date.now()

    // Derive the initial account (index 0) with EVM + SVM + Native addresses.
    const firstAccount = await deriveAllAccounts(mnemonic, 0, {
      ...DEFAULT_DERIVE_OPTIONS,
      accountName: 'Account 1',
    })

    // Encrypt and store the vault in memory.
    this.encryptedVault = await encryptVault(
      { version: 1, mnemonic },
      password,
      this.pbkdf2Iterations,
      walletId,
      now,
    )

    // Build wallet metadata (public; no secrets).
    this.walletMetadata = {
      id: walletId,
      name: walletName,
      wordCount,
      accounts: [firstAccount],
      activeAccountId: firstAccount.id,
      createdAt: now,
      lastUnlockedAt: null,
      version: WALLET_SCHEMA_VERSION,
    }

    // Start unlocked — the user just provided their mnemonic/password.
    this.sessionMnemonic = mnemonic
  }
}

// ─── AES-256-GCM Vault Encryption (Web Crypto API) ─────────────────────────
//
// These functions are module-private. External code must always go through
// WalletService methods — never call these directly.

function uint8ArrayToBase64url(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlToUint8Array(s: string): Uint8Array<ArrayBuffer> {
  // Restore standard base64 padding
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '==='.slice(0, (4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const result = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i)
  }
  return result
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

async function encryptVault(
  payload: VaultPayload,
  password: string,
  iterations: number,
  walletId: string,
  now: number,
): Promise<EncryptedVault> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const key = await deriveAesKey(password, salt, iterations, ['encrypt'])

  let ciphertextBuf: ArrayBuffer
  try {
    ciphertextBuf = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    )
  } catch (err) {
    throw new WalletError('ENCRYPTION_FAILED', 'Failed to encrypt the wallet vault.', err)
  }

  const kdfParams: PBKDF2Params = { hash: 'SHA-256', iterations, keyLength: 32 }

  return {
    version: VAULT_SCHEMA_VERSION,
    walletId,
    crypto: {
      algorithm: 'AES-GCM',
      ciphertext: uint8ArrayToBase64url(new Uint8Array(ciphertextBuf)),
      iv: uint8ArrayToBase64url(iv),
      salt: uint8ArrayToBase64url(salt),
      kdf: 'PBKDF2',
      kdfParams,
    },
    createdAt: now,
    updatedAt: now,
  }
}

async function decryptVault(vault: EncryptedVault, password: string): Promise<VaultPayload> {
  // Guard: refuse vaults with below-minimum iterations (e.g. attacker-crafted).
  if (vault.crypto.kdfParams.iterations < 1) {
    throw new WalletError(
      'VAULT_VERSION_UNSUPPORTED',
      'Vault uses an unsupported key derivation configuration.',
    )
  }

  const salt = base64urlToUint8Array(vault.crypto.salt)
  const iv = base64urlToUint8Array(vault.crypto.iv)
  const ciphertext = base64urlToUint8Array(vault.crypto.ciphertext)

  // Use the iterations stored in the vault (not the service default) so that
  // a vault produced with a different iteration count can still be decrypted.
  const key = await deriveAesKey(password, salt, vault.crypto.kdfParams.iterations, ['decrypt'])

  let plaintext: ArrayBuffer
  try {
    plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  } catch (err) {
    // AES-GCM throws when the authentication tag fails — always INCORRECT_PASSWORD here.
    throw new WalletError('INCORRECT_PASSWORD', 'Incorrect password. Please try again.', err)
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload
  } catch (err) {
    throw new WalletError('VAULT_CORRUPTED', 'The vault data could not be parsed.', err)
  }
}

// ─── Internal Validators ───────────────────────────────────────────────────

function assertValidPassword(password: string): void {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new WalletError(
      'WEAK_PASSWORD',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    )
  }
}
