/**
 * Domain layer barrel export.
 *
 * Import domain types from here:
 *   import type { WalletMetadata, AccountMetadata } from '@/domain'
 *   import type { ChainDefinition, VMType } from '@/domain'
 *   import type { EncryptedVault, VaultPayload } from '@/domain'
 *   import { WalletError } from '@/domain'
 *
 * Do not import from individual domain files outside of domain/ itself.
 */

// Chain
export type { VMType, NativeCurrency, ChainDefinition } from './chain'

// Wallet
export type {
  WordCount,
  EVMAddressEntry,
  NativeAddressEntry,
  SVMAddressEntry,
  AddressEntry,
  AccountMetadata,
  WalletMetadata,
} from './wallet'
export { isEVMAddress, isNativeAddress, isSVMAddress, getAddressesByVM } from './wallet'

// Vault
export type { VaultPayload, PBKDF2Params, EncryptedVault } from './vault'

// Errors
export type { WalletErrorCode } from './errors'
export { WalletError } from './errors'

// Onboarding
export type { OnboardingMode, OnboardingStep, OnboardingState } from './onboarding'

// Assets
export type {
  AssetType,
  Asset,
  NativeAsset,
  TokenAsset,
  NFTAsset,
  AnyAsset,
  Balance,
  PortfolioEntry,
  Portfolio,
} from './asset'
export { isNativeAsset, isTokenAsset, isNFTAsset } from './asset'

// Transaction
export type {
  TransactionType,
  TransactionStatus,
  TransactionRequest,
  SigningAlgorithm,
  SigningPayload,
  SignedTransaction,
  FeePriority,
  Fee,
  FeeEstimate,
  TransactionValidationField,
  TransactionValidationError,
  TransactionValidationResult,
} from './transaction'

// RPC
export type {
  RpcBlock,
  RpcTransaction,
  RpcTransactionStatus,
  RpcEndpointStatus,
  RpcHealthReport,
  RpcFeeData,
  RetryConfig,
  CircuitBreakerState,
  CircuitBreakerConfig,
  // JSON-RPC 2.0 wire format (Day 11)
  RpcId,
  RpcRequest,
  RpcErrorPayload,
  RpcSuccessResponse,
  RpcErrorResponse,
  RpcResponse,
  BatchRpcRequest,
  BatchRpcResponse,
  // Endpoint & observability (Day 11)
  RpcEndpointMetadata,
  RpcHealthMetrics,
  RpcMetricsSnapshot,
} from './rpc'

// Storage (P0.3)
export { VAULT_STORAGE_SCHEMA_VERSION, IDB_SCHEMA_VERSION } from './storage'
export type {
  IntegrityAlgorithm,
  VaultStorageRecord,
  VaultRecordMetadata,
  VaultRecordIntegrity,
  WalletListEntry,
  VerificationResult,
  CreateVaultParams,
} from './storage'
