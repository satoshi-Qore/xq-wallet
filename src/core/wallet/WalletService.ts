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
import type { AnyAsset, Balance, Portfolio, PortfolioEntry } from '@/domain/asset'
import { generate, assertValidMnemonic } from '@/core/crypto'
import {
  deriveAllAccounts,
  derivePrivateKeyForSigning,
  type DeriveAllAccountsOptions,
} from './derive'
import { getAdapter } from '@/core/chain/adapters'
import type { SignResult, VerifyParams } from '@/core/chain/adapters'
import type { VMType } from '@/domain/chain'
import { AssetRegistry } from '@/core/asset/AssetRegistry'
import type { IBalanceProvider } from '@/core/asset/IBalanceProvider'
import { MockBalanceProvider } from '@/core/asset/MockBalanceProvider'
import { createDefaultAssetRegistry } from '@/core/asset/defaultAssets'
import { TransactionBuilder } from '@/core/transaction/TransactionBuilder'
import { TransactionValidator } from '@/core/transaction/TransactionValidator'
import { MockFeeEstimator } from '@/core/transaction/MockFeeEstimator'
import type { IFeeEstimator } from '@/core/transaction/IFeeEstimator'
import { NullRpcProvider } from '@/core/rpc/NullRpcProvider'
import { RpcProviderRegistry } from '@/core/rpc/RpcProviderRegistry'
import type { IRpcProvider } from '@/core/rpc/IRpcProvider'
import type { RpcBlock, RpcTransaction, RpcHealthReport } from '@/domain/rpc'
import { JsonRpcClientRegistry } from '@/core/rpc/JsonRpcClientRegistry'
import type { JsonRpcClient } from '@/core/rpc/JsonRpcClient'
import type {
  TransactionRequest,
  FeeEstimate,
  SigningPayload,
  SigningAlgorithm,
  TransactionValidationResult,
  TransactionType,
} from '@/domain/transaction'

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

  /**
   * Asset registry used for `getAsset`, `listAssets`, `getBalance`, and
   * `getPortfolio`. Defaults to a registry pre-populated with the three
   * default devnet native assets (QR, SEP, SOL).
   *
   * Inject a custom registry in tests or when adding token assets.
   */
  readonly assetRegistry?: AssetRegistry

  /**
   * Balance provider for on-chain balance queries.
   * Defaults to `MockBalanceProvider` (deterministic in-memory values).
   *
   * Sprint 3: inject an RPC-backed provider (EthersBalanceProvider,
   * SolanaBalanceProvider, NativeBalanceProvider) to switch from mock data.
   */
  readonly balanceProvider?: IBalanceProvider

  /**
   * Fee estimator for on-chain transaction fee queries.
   * Defaults to `MockFeeEstimator` (deterministic hard-coded values).
   *
   * Sprint 3: inject an RPC-backed estimator to get live fee data.
   */
  readonly feeEstimator?: IFeeEstimator

  /**
   * RPC provider registry for network operations.
   * Defaults to a registry pre-populated with NullRpcProvider for each of
   * the three supported devnet chains (ethereum-sepolia, solana-devnet,
   * qorechain-devnet).
   *
   * Sprint 3: replace individual providers via `registry.replace(provider)`
   * to enable live RPC without changing any calling code.
   */
  readonly rpcRegistry?: RpcProviderRegistry

  /**
   * JSON-RPC client registry for transport-layer access.
   * Defaults to an empty registry.
   *
   * Sprint 3: register a JsonRpcClient per chain via this registry so
   * concrete RPC providers can call real blockchain nodes.
   */
  readonly jsonRpcClientRegistry?: JsonRpcClientRegistry
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

/** Parameters for WalletService.createTransaction(). */
export interface CreateTransactionParams {
  /** Transaction category. Defaults to 'transfer'. */
  readonly type?: TransactionType
  /** Target virtual machine. */
  readonly vm: VMType
  /** Target chain id (must match a registered ChainDefinition.id). */
  readonly chainId: string
  /** Asset to transfer (must be registered in the AssetRegistry). */
  readonly assetId: string
  /** Sender address — must be valid for the given VM. */
  readonly from: string
  /** Recipient address — must be valid for the given VM. */
  readonly to: string
  /** Transfer amount in the asset's smallest indivisible unit. Must be > 0. */
  readonly amount: bigint
  /** Optional human-readable note. */
  readonly memo?: string
}

// ─── WalletService ─────────────────────────────────────────────────────────

export class WalletService {
  private readonly pbkdf2Iterations: number

  /** Asset catalogue. Injected via constructor; defaults to DEFAULT_ASSETS. */
  private readonly assetRegistry: AssetRegistry

  /** Balance provider. Injected via constructor; defaults to MockBalanceProvider. */
  private readonly balanceProvider: IBalanceProvider

  /** Fee estimator. Injected via constructor; defaults to MockFeeEstimator. */
  private readonly feeEstimator: IFeeEstimator

  /** RPC provider registry. Injected via constructor; defaults to NullRpcProvider for all chains. */
  private readonly rpcRegistry: RpcProviderRegistry

  /** JSON-RPC client registry. Injected via constructor; defaults to empty registry. */
  private readonly jsonRpcClientRegistry: JsonRpcClientRegistry

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
    this.assetRegistry = options.assetRegistry ?? createDefaultAssetRegistry()
    this.balanceProvider = options.balanceProvider ?? new MockBalanceProvider()
    this.feeEstimator = options.feeEstimator ?? new MockFeeEstimator()
    this.rpcRegistry = options.rpcRegistry ?? createDefaultRpcRegistry()
    this.jsonRpcClientRegistry = options.jsonRpcClientRegistry ?? new JsonRpcClientRegistry()
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

  // ─── Asset Layer ──────────────────────────────────────────────────────────

  /**
   * Returns the asset definition for the given id from the registry,
   * or `undefined` if no asset with that id is registered.
   *
   * Does not require the wallet to be unlocked.
   *
   * @param id - Unique asset id (e.g. `"qorechain-devnet:native:QR"`).
   */
  getAsset(id: string): AnyAsset | undefined {
    return this.assetRegistry.getById(id)
  }

  /**
   * Returns all registered assets, optionally filtered to a single VM.
   *
   * Does not require the wallet to be unlocked.
   *
   * @param vm - When provided, only assets on this VM are returned.
   *             When omitted, all registered assets are returned.
   */
  listAssets(vm?: VMType): AnyAsset[] {
    return vm !== undefined ? this.assetRegistry.getByVM(vm) : this.assetRegistry.list()
  }

  /**
   * Returns the balance of a single asset at the given address.
   *
   * Does not require the wallet to be unlocked — any address may be queried.
   *
   * @param address - On-chain address to query.
   * @param assetId - Asset id to query (must be registered in the AssetRegistry).
   * @returns Balance snapshot in the smallest unit (bigint).
   * @throws WalletError('ASSET_NOT_FOUND') if no asset with that id is registered.
   */
  async getBalance(address: string, assetId: string): Promise<Balance> {
    const asset = this.assetRegistry.getById(assetId)
    if (asset === undefined) {
      throw new WalletError('ASSET_NOT_FOUND', `No asset found with id '${assetId}'.`)
    }
    return this.balanceProvider.getBalance(address, asset)
  }

  /**
   * Returns balances for all registered assets across all address entries
   * of the given account.
   *
   * Assets are matched to address entries by VM type. One PortfolioEntry is
   * produced per (asset, address) pair where the asset's VM matches the
   * address entry's VM.
   *
   * Does not require the wallet to be unlocked — accounts hold only public data.
   *
   * @param accountIndex - BIP-44 account index (0-based).
   * @returns Ordered array of { asset, balance, address } entries.
   * @throws WalletError('VAULT_NOT_FOUND') if no wallet has been created/imported.
   * @throws WalletError('DERIVATION_FAILED') if accountIndex is out of range.
   */
  async getBalances(accountIndex: number): Promise<ReadonlyArray<PortfolioEntry>> {
    const account = this._getAccount(accountIndex)
    const entries: PortfolioEntry[] = []

    for (const addressEntry of account.addresses) {
      const vmAssets = this.assetRegistry.getByVM(addressEntry.vm)
      if (vmAssets.length === 0) continue
      const results = await this.balanceProvider.getBalances(addressEntry.address, vmAssets)
      for (const { asset, balance } of results) {
        entries.push({ asset, balance, address: addressEntry.address })
      }
    }

    return entries
  }

  /**
   * Builds a Portfolio snapshot for the given account.
   *
   * The portfolio aggregates all asset balances across all VMs for this account.
   * No fiat conversion is applied (Sprint 2).
   *
   * Does not require the wallet to be unlocked.
   *
   * @param accountIndex - BIP-44 account index (0-based).
   * @returns Portfolio snapshot with entries, totalAssets, and updatedAt timestamp.
   * @throws WalletError('VAULT_NOT_FOUND') if no wallet has been created/imported.
   * @throws WalletError('DERIVATION_FAILED') if accountIndex is out of range.
   */
  async getPortfolio(accountIndex: number): Promise<Portfolio> {
    if (!this.walletMetadata) {
      throw new WalletError('VAULT_NOT_FOUND', 'No wallet found. Create or import a wallet first.')
    }
    const entries = await this.getBalances(accountIndex)
    return {
      walletId: this.walletMetadata.id,
      accountIndex,
      entries,
      totalAssets: entries.length,
      updatedAt: Date.now(),
    }
  }

  // ─── Transaction Layer ───────────────────────────────────────────────────

  /**
   * Constructs and validates a TransactionRequest from the given parameters.
   *
   * Validates VM, chain, asset, addresses, and amount before returning.
   * Does not require the wallet to be unlocked — no key material is accessed.
   *
   * For collecting multiple validation errors at once, call
   * validateTransaction() after createTransaction().
   *
   * @param params - All required transaction fields.
   * @returns A sealed, validated TransactionRequest with a generated id.
   * @throws WalletError('UNSUPPORTED_VM')   — vm is not a known VMType.
   * @throws WalletError('UNSUPPORTED_CHAIN') — chainId is not provided.
   * @throws WalletError('ASSET_NOT_FOUND')  — assetId is not provided.
   * @throws WalletError('INVALID_ADDRESS')  — from or to is missing or invalid for the VM.
   * @throws WalletError('INVALID_AMOUNT')   — amount is zero or negative.
   */
  createTransaction(params: CreateTransactionParams): TransactionRequest {
    const builder = TransactionBuilder.create()
      .vm(params.vm)
      .chain(params.chainId)
      .asset(params.assetId)
      .from(params.from)
      .to(params.to)
      .amount(params.amount)

    const withType = params.type !== undefined ? builder.type(params.type) : builder
    const withMemo = params.memo !== undefined ? withType.memo(params.memo) : withType

    // Validate addresses using chain adapters before calling build()
    const fromError = TransactionValidator.validateFrom(params.from, params.vm)
    if (fromError !== null) {
      throw new WalletError(fromError.code, fromError.message)
    }
    const toError = TransactionValidator.validateTo(params.to, params.vm)
    if (toError !== null) {
      throw new WalletError(toError.code, toError.message)
    }

    return withMemo.build()
  }

  /**
   * Estimates transaction fees for all three priority tiers.
   *
   * Sprint 2: delegates to MockFeeEstimator (deterministic values).
   * Sprint 3: inject a real RPC-backed IFeeEstimator via WalletServiceOptions.
   *
   * Does not require the wallet to be unlocked.
   *
   * @param request - Transaction to estimate fees for.
   * @returns FeeEstimate with slow, normal, and fast priority tiers.
   */
  async estimateFee(request: TransactionRequest): Promise<FeeEstimate> {
    return this.feeEstimator.estimate(request)
  }

  /**
   * Validates a TransactionRequest and returns all errors found.
   *
   * Unlike createTransaction() which throws on first failure, this method
   * runs all validations and collects every error so the UI can highlight
   * all problems at once.
   *
   * Optionally accepts a Balance snapshot to validate balance sufficiency.
   * Does not require the wallet to be unlocked.
   *
   * @param request - TransactionRequest to validate.
   * @param balance - Optional balance snapshot for sufficiency check.
   * @returns TransactionValidationResult with valid flag and errors array.
   */
  validateTransaction(
    request: TransactionRequest,
    balance?: import('@/domain/asset').Balance,
  ): TransactionValidationResult {
    return TransactionValidator.validate(request, balance)
  }

  /**
   * Builds a SigningPayload from the given transaction request.
   *
   * Sprint 2: encodes the transaction as canonical JSON bytes (deterministic,
   * alphabetically-sorted fields; bigint serialised as decimal string).
   *
   * Sprint 3: this method will produce the real VM-specific binary encoding:
   *   EVM    — RLP-encoded EIP-2718 typed transaction envelope
   *   SVM    — Solana Transaction / VersionedTransaction serialisation
   *   Native — QoreChain SDK transaction serialisation (TBD)
   *
   * Does not require the wallet to be unlocked — only public request data is used.
   *
   * @param request      - The transaction request to prepare for signing.
   * @param accountIndex - BIP-44 account index of the signing key.
   * @returns A SigningPayload ready to be passed to ITransactionSigner.sign().
   */
  prepareSigningPayload(request: TransactionRequest, accountIndex: number): SigningPayload {
    const algorithm: SigningAlgorithm = request.vm === 'svm' ? 'ed25519' : 'secp256k1-keccak256'

    // Canonical encoding: sorted keys, bigint as decimal string.
    // Sprint 3: replace with proper VM-specific binary serialisation.
    const canonical: Record<string, string | number | null> = {
      amount: request.amount.toString(),
      assetId: request.assetId,
      chainId: request.chainId,
      createdAt: request.createdAt,
      from: request.from,
      id: request.id,
      memo: request.memo ?? null,
      to: request.to,
      type: request.type,
      vm: request.vm,
    }

    // Sort keys for determinism (JSON.stringify does not guarantee key order)
    const sorted: Record<string, string | number | null> = {}
    for (const key of Object.keys(canonical).sort()) {
      sorted[key] = canonical[key] ?? null
    }

    const payload = new TextEncoder().encode(JSON.stringify(sorted))

    return {
      transactionId: request.id,
      payload,
      algorithm,
      accountIndex,
      vm: request.vm,
      chainId: request.chainId,
    }
  }

  // ─── RPC Layer ────────────────────────────────────────────────────────────
  //
  // These methods route to the IRpcProvider registered for the target chain.
  // Sprint 2: all network-touching methods throw RPC_NOT_CONNECTED (NullRpcProvider).
  // Sprint 3: replace providers via rpcRegistry.replace(concreteProvider).
  //
  // SECURITY: No key material is used or accepted here. Signing always happens
  // through signMessage / prepareSigningPayload + an external ITransactionSigner.

  /**
   * Returns the most recently confirmed block on the specified chain.
   *
   * @param chainId - ChainDefinition.id to query.
   * @returns The latest RpcBlock from the chain's RPC node.
   * @throws WalletError('RPC_NOT_CONNECTED') in Sprint 2 (NullRpcProvider default).
   * @throws WalletError('INVALID_NETWORK') if no provider is registered for chainId.
   */
  async getLatestBlock(chainId: string): Promise<RpcBlock> {
    return this._getProvider(chainId).getLatestBlock()
  }

  /**
   * Broadcasts a signed, serialised transaction to the network.
   *
   * The caller must sign the transaction externally (via ITransactionSigner)
   * and pass the resulting raw bytes here. No key material is accepted.
   *
   * @param rawTx   - VM-specific binary encoding of the signed transaction.
   * @param chainId - ChainDefinition.id of the target chain.
   * @returns The transaction hash assigned by the network.
   * @throws WalletError('RPC_NOT_CONNECTED') in Sprint 2 (NullRpcProvider default).
   * @throws WalletError('INVALID_NETWORK') if no provider is registered for chainId.
   */
  async submitTransaction(rawTx: Uint8Array, chainId: string): Promise<string> {
    return this._getProvider(chainId).sendTransaction(rawTx)
  }

  /**
   * Returns the on-chain transaction identified by its hash.
   *
   * @param txHash  - Transaction hash (format is VM-specific).
   * @param chainId - ChainDefinition.id of the chain to query.
   * @returns RpcTransaction with full on-chain details.
   * @throws WalletError('RPC_NOT_CONNECTED') in Sprint 2 (NullRpcProvider default).
   * @throws WalletError('INVALID_NETWORK') if no provider is registered for chainId.
   */
  async getTransaction(txHash: string, chainId: string): Promise<RpcTransaction> {
    return this._getProvider(chainId).getTransaction(txHash)
  }

  /**
   * Returns the on-chain balance of an asset at an address via the RPC layer.
   *
   * Distinct from `getBalance(address, assetId)` which uses MockBalanceProvider.
   * This method routes through the RpcProviderRegistry and will return live
   * on-chain data once a concrete provider is registered in Sprint 3.
   *
   * @param address - On-chain address to query.
   * @param chainId - ChainDefinition.id to query against.
   * @param assetId - Asset to look up (must be registered in the AssetRegistry).
   * @returns Balance snapshot from the RPC node.
   * @throws WalletError('ASSET_NOT_FOUND') if assetId is not registered.
   * @throws WalletError('RPC_NOT_CONNECTED') in Sprint 2 (NullRpcProvider default).
   * @throws WalletError('INVALID_NETWORK') if no provider is registered for chainId.
   */
  async fetchBalance(address: string, chainId: string, assetId: string): Promise<Balance> {
    const asset = this.assetRegistry.getById(assetId)
    if (!asset) {
      throw new WalletError(
        'ASSET_NOT_FOUND',
        `Asset '${assetId}' is not registered. Register it via AssetRegistry.`,
      )
    }
    return this._getProvider(chainId).getBalance(address, asset)
  }

  /**
   * Returns a health report for the RPC provider registered for the given chain.
   *
   * Unlike other RPC methods, healthCheck() never throws — it always returns
   * an RpcHealthReport, even when the NullRpcProvider is in use.
   *
   * @param chainId - ChainDefinition.id to health-check.
   * @returns RpcHealthReport describing the endpoint's current availability.
   * @throws WalletError('INVALID_NETWORK') if no provider is registered for chainId.
   */
  async healthCheck(chainId: string): Promise<RpcHealthReport> {
    return this._getProvider(chainId).healthCheck()
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

  private _getAccount(accountIndex: number): AccountMetadata {
    if (!this.walletMetadata) {
      throw new WalletError('VAULT_NOT_FOUND', 'No wallet found. Create or import a wallet first.')
    }
    const account = this.walletMetadata.accounts[accountIndex]
    if (!account) {
      throw new WalletError(
        'DERIVATION_FAILED',
        `Account index ${accountIndex} does not exist. Derive it first with deriveNextAccount().`,
      )
    }
    return account
  }

  /**
   * Looks up the IRpcProvider registered for `chainId`.
   *
   * @param chainId - ChainDefinition.id to look up.
   * @throws WalletError('INVALID_NETWORK') if no provider is registered.
   */
  private _getProvider(chainId: string): IRpcProvider {
    const provider = this.rpcRegistry.get(chainId)
    if (provider === undefined) {
      throw new WalletError(
        'UNSUPPORTED_CHAIN',
        `No RPC provider is registered for chain '${chainId}'. ` +
          'Register a provider via RpcProviderRegistry before making RPC calls.',
      )
    }
    return provider
  }

  // ─── JSON-RPC Client Methods ──────────────────────────────────────────────

  /**
   * Retrieve the JSON-RPC transport client for the given chainId.
   *
   * Returns undefined if no client has been registered for that chain.
   * Sprint 3: concrete provider implementations will call this to send
   * JSON-RPC requests without going through the IRpcProvider abstraction.
   *
   * Architecture: ARCHITECTURE.md §5.7 — WalletService JSON-RPC Integration
   */
  getJsonRpcClient(chainId: string): JsonRpcClient | undefined {
    return this.jsonRpcClientRegistry.get(chainId)
  }

  /**
   * Register a JSON-RPC client for the given chain.
   *
   * Delegates to JsonRpcClientRegistry.register() — throws
   * WalletError('UNSUPPORTED_CHAIN') if a client for that chain is already
   * registered. Use replaceJsonRpcClient() for upsert semantics.
   *
   * Sprint 3: called during provider initialisation to wire up live RPC.
   */
  registerJsonRpcClient(client: JsonRpcClient): void {
    this.jsonRpcClientRegistry.register(client)
  }

  /**
   * Replace (or register) the JSON-RPC client for a chain (upsert).
   * Never throws — use when idempotent registration is needed.
   */
  replaceJsonRpcClient(client: JsonRpcClient): void {
    this.jsonRpcClientRegistry.replace(client)
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

// ─── RPC Provider Factory ────────────────────────────────────────────────────
//
// Module-private — only WalletService should call this. External code that
// needs a custom registry should construct RpcProviderRegistry directly.

/**
 * Creates the default RpcProviderRegistry pre-populated with NullRpcProvider
 * for all three supported devnet chains.
 *
 * Sprint 3: swap individual providers via `registry.replace(realProvider)`
 * without rebuilding the registry.
 */
function createDefaultRpcRegistry(): RpcProviderRegistry {
  const registry = new RpcProviderRegistry()
  registry.register(new NullRpcProvider('evm', 'ethereum-sepolia'))
  registry.register(new NullRpcProvider('svm', 'solana-devnet'))
  registry.register(new NullRpcProvider('native', 'qorechain-devnet'))
  return registry
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
