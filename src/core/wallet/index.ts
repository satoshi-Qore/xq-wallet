/**
 * src/core/wallet/index.ts — Public API barrel export.
 *
 * Consumers import from '@/core/wallet' only — never from internal submodules.
 * Adapter internals (EvmAddressAdapter, SvmAddressAdapter, NativeAddressAdapter)
 * are intentionally NOT exported here: they are implementation details.
 */

// ─── Public Derivation Functions ───────────────────────────────────────────
export {
  deriveEvmAccount,
  deriveSvmAccount,
  deriveNativeAccount,
  deriveAllAccounts,
} from './derive'

export type { DeriveAllAccountsOptions } from './derive'

// ─── Path Utilities ────────────────────────────────────────────────────────
export {
  evmPath,
  svmPath,
  nativePath,
  assertValidAccountIndex,
  EVM_COIN_TYPE,
  SVM_COIN_TYPE,
  NATIVE_COIN_TYPE,
} from './paths'

// ─── Wallet Engine ─────────────────────────────────────────────────────────
export { WalletService } from './WalletService'
export type {
  WalletServiceOptions,
  CreateWalletOptions,
  ImportWalletOptions,
  CreateWalletResult,
} from './WalletService'
