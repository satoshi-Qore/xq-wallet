# State Management — XQ Wallet

> **Status:** Approved  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering

---

## Decision Status

Not all decisions in this document carry the same weight. The following table distinguishes what is locked from what is still subject to Phase 1 validation.

| Decision | Status | Notes |
|---|---|---|
| State lives in the narrowest possible scope | ✅ **Confirmed** | Architectural principle — not library-specific |
| Components access state only through hooks | ✅ **Confirmed** | Architectural principle |
| Server/async state separated from client state | ✅ **Confirmed** | Architectural principle |
| Key material never enters any state store | ✅ **Confirmed** | Non-negotiable security rule |
| **Zustand** for client state | 🔶 **Preferred / Provisional** | Selected as the leading candidate; final decision deferred to Phase 1 implementation |
| **TanStack Query v5** for async state | 🔶 **Preferred / Provisional** | Strong preference; final decision deferred to Phase 1 implementation |
| **React Hook Form + Zod** for form state | 🔶 **Preferred / Provisional** | Deferred to Phase 1 |
| Store shapes and query key structure | 📋 **Planned** | Implementation details — subject to change during Phase 1 |

See §8 for the conditions that would justify changing a provisional library decision.

---

## 1. State Taxonomy

XQ Wallet separates state into four distinct categories, each with its own home and rules.

| Category | Owner | Library | Persistence |
|---|---|---|---|
| **Client / UI state** | Zustand stores | Zustand | sessionStorage (session) or none |
| **Server / async state** | TanStack Query cache | TanStack Query v5 | Memory (with stale-while-revalidate) |
| **Form state** | Form instance | React Hook Form | None — ephemeral |
| **Vault state** | IndexedDB | Custom (Security Layer) | Encrypted IndexedDB |

The golden rule: **state lives in the narrowest possible scope.** Local component state (`useState`) is preferred over Zustand. Zustand is preferred over Context. TanStack Query owns all async data — Zustand never holds fetched chain data.

---

## 2. Zustand Stores *(Preferred / Provisional)*

> **Decision status:** Zustand is the current **preferred option** for client state management — not a final decision. It was selected based on the evaluation in ADR-0001-04 and is the library the Phase 1 implementation will begin with. The decision will be confirmed or revised based on Phase 1 experience. See §8 for revision criteria.

### 2.1 Store Map

```
src/lib/stores/
├── walletStore.ts       ← accounts, active account, unlock status
├── networkStore.ts      ← selected network, RPC health
├── uiStore.ts           ← modals, toasts, sidebar state
└── preferencesStore.ts  ← theme, currency, language (persisted to localStorage)
```

### 2.2 `walletStore`

The most critical store. Holds the runtime wallet session.

```ts
interface WalletState {
  // Session
  isUnlocked: boolean
  sessionExpiresAt: number | null       // Unix timestamp ms

  // Accounts
  accounts: Account[]                   // Decrypted account metadata (no keys)
  activeAccountIndex: number

  // Derived
  activeAccount: Account | null         // computed from accounts + activeAccountIndex

  // Actions
  unlock: (sessionToken: string, accounts: Account[]) => void
  lock: () => void
  setActiveAccount: (index: number) => void
  addAccount: (account: Account) => void
}
```

**Key rules:**
- `walletStore` holds **account metadata only** — never private keys or mnemonics.
- Locking (`lock()`) must zero out the session token and clear `sessionStorage`.
- The store auto-locks after a configurable idle timeout (default: 15 minutes).

### 2.3 `networkStore`

```ts
interface NetworkState {
  activeNetwork: NetworkEnvironment        // 'mainnet' | 'testnet' | 'devnet'
  rpcStatus: 'connected' | 'degraded' | 'disconnected'
  latencyMs: number | null

  // Actions
  setNetwork: (network: NetworkEnvironment) => void
  setRpcStatus: (status: RpcStatus, latencyMs?: number) => void
}
```

### 2.4 `uiStore`

```ts
interface UIState {
  // Modal stack
  activeModal: ModalId | null
  modalProps: Record<string, unknown>

  // Toasts
  toasts: Toast[]

  // Navigation
  isSidebarOpen: boolean

  // Actions
  openModal: (id: ModalId, props?: Record<string, unknown>) => void
  closeModal: () => void
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  toggleSidebar: () => void
}
```

### 2.5 `preferencesStore`

```ts
interface PreferencesState {
  theme: 'light' | 'dark' | 'system'
  currency: 'USD' | 'EUR' | 'GBP'       // fiat display currency
  locale: string                          // e.g. 'en-US'
  autoLockMinutes: number                 // 5 | 15 | 30 | 60 | 0 (never)

  // Actions
  setTheme: (theme: Theme) => void
  setCurrency: (currency: FiatCurrency) => void
  setAutoLock: (minutes: number) => void
}
```

Persisted to `localStorage` via Zustand's `persist` middleware — **non-sensitive data only**.

### 2.6 Store Construction Pattern

```ts
// src/lib/stores/walletStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const useWalletStore = create<WalletState>()(
  subscribeWithSelector((set, get) => ({
    isUnlocked: false,
    sessionExpiresAt: null,
    accounts: [],
    activeAccountIndex: 0,

    get activeAccount() {
      const { accounts, activeAccountIndex } = get()
      return accounts[activeAccountIndex] ?? null
    },

    unlock(sessionToken, accounts) {
      sessionStorage.setItem('xqw_session', sessionToken)
      set({ isUnlocked: true, accounts, sessionExpiresAt: Date.now() + 15 * 60_000 })
    },

    lock() {
      sessionStorage.removeItem('xqw_session')
      set({ isUnlocked: false, accounts: [], sessionExpiresAt: null })
    },

    setActiveAccount(index) {
      set({ activeAccountIndex: index })
    },

    addAccount(account) {
      set(state => ({ accounts: [...state.accounts, account] }))
    },
  })),
)
```

---

## 3. TanStack Query *(Preferred / Provisional)*

> **Decision status:** TanStack Query v5 is the current **preferred option** for async/server state. Selected based on the evaluation in ADR-0001-05. Confirmed or revised at end of Phase 1.


### 3.1 Query Client Configuration

```ts
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 12_000,          // 12 seconds — chain data goes stale quickly
      gcTime: 5 * 60_000,         // 5 minutes garbage collection
      retry: 2,
      refetchOnWindowFocus: true,
      refetchInterval: false,     // opt-in per query
    },
    mutations: {
      retry: 0,                   // Never retry mutations automatically
    },
  },
})
```

### 3.2 Query Key Convention

All query keys are defined as constants in `src/lib/queryKeys.ts`:

```ts
export const queryKeys = {
  balance: (address: Address, network: NetworkEnvironment) =>
    ['balance', address, network] as const,

  transaction: (txHash: TxHash) =>
    ['transaction', txHash] as const,

  transactionHistory: (address: Address, network: NetworkEnvironment) =>
    ['transactionHistory', address, network] as const,

  gasEstimate: (params: TxParams) =>
    ['gasEstimate', params] as const,

  networkStatus: () =>
    ['networkStatus'] as const,
} as const
```

**Rules:**
- Query keys are always arrays — never strings.
- The first element identifies the resource type.
- Keys are ordered from broadest to most specific (invalidation propagates down).
- Invalidating `['balance']` invalidates all balance queries; invalidating `['balance', address, network]` invalidates only that specific one.

### 3.3 Example Data Hook

```ts
// src/hooks/useBalance.ts
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { qorechain } from '@/lib/qorechain'
import { useWalletStore } from '@/lib/stores/walletStore'
import { useNetworkStore } from '@/lib/stores/networkStore'

export interface UseBalanceResult {
  balance: string | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useBalance(): UseBalanceResult {
  const activeAccount = useWalletStore(s => s.activeAccount)
  const activeNetwork = useNetworkStore(s => s.activeNetwork)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.balance(activeAccount?.address ?? '', activeNetwork),
    queryFn: () => qorechain.getBalance(activeAccount!.address),
    enabled: !!activeAccount,
    refetchInterval: 15_000,     // poll every 15 seconds when visible
  })

  return { balance: data ?? null, isLoading, isError, refetch }
}
```

### 3.4 Mutation Pattern

```ts
// src/hooks/useSendTransaction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

export function useSendTransaction() {
  const queryClient = useQueryClient()
  const activeAccount = useWalletStore(s => s.activeAccount)
  const activeNetwork = useNetworkStore(s => s.activeNetwork)

  return useMutation({
    mutationFn: (params: SendTxParams) => signAndBroadcast(params),
    onSuccess: () => {
      // Invalidate balance and history after a confirmed send
      queryClient.invalidateQueries({
        queryKey: queryKeys.balance(activeAccount!.address, activeNetwork),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactionHistory(activeAccount!.address, activeNetwork),
      })
    },
  })
}
```

---

## 4. Form State *(Preferred / Provisional)*

> **Decision status:** React Hook Form + Zod is the current **preferred option**. Confirmed at end of Phase 1.

All forms use React Hook Form with Zod for schema validation.

```ts
// src/app/(wallet)/send/_components/SendForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const sendSchema = z.object({
  recipient: z.string().refine(isValidAddress, 'Invalid address'),
  amount: z.string().min(1).refine(isPositiveAmount, 'Must be greater than 0'),
  memo: z.string().max(256).optional(),
})

type SendFormValues = z.infer<typeof sendSchema>

// Form state lives inside this component only
// It is NOT hoisted to Zustand
```

Form state is always component-local. It is never hoisted into Zustand — submitted form data flows into a mutation, and the mutation result flows back through TanStack Query cache invalidation.

---

## 5. State Flow Diagram

```
┌──────────────┐    reads    ┌──────────────────────┐
│  UI Layer    │◄────────────│  Zustand Stores       │
│  (React)     │             │  walletStore          │
│              │  calls hook │  networkStore         │
│              │────────────►│  uiStore              │
└──────────────┘             │  preferencesStore     │
       │                     └──────────────────────┘
       │ calls hook                     │ auto-lock
       ▼                                │ timer
┌──────────────┐                        ▼
│  Hooks       │             ┌──────────────────────┐
│  useBalance  │─────────────│  Security Layer       │
│  useSend     │   unlock()  │  (vault operations)   │
│  useWallet   │             └──────────────────────┘
└──────┬───────┘
       │ useQuery / useMutation
       ▼
┌──────────────────────────────────────────────────┐
│  TanStack Query Cache                             │
│  balance, txHistory, gasEstimate, networkStatus  │
└──────────────────┬───────────────────────────────┘
                   │ fetches
                   ▼
          ┌────────────────┐
          │  QoreChain SDK │
          │  (Chain Layer) │
          └────────┬───────┘
                   │ JSON-RPC / WebSocket
                   ▼
          ┌────────────────┐
          │  QoreChain     │
          │  Network       │
          └────────────────┘
```

---

## 6. Persistence & Hydration

### Zustand persistence

`preferencesStore` is persisted via Zustand `persist` middleware with `localStorage`. All other stores are ephemeral — they reset on page load and are rebuilt from the vault.

### TanStack Query persistence

TanStack Query cache is in-memory only. On page reload, queries re-fetch from the network. There is no offline persistence of chain data in v1.

### Vault hydration sequence

On application boot:

1. `walletStore` initialises as locked.
2. App checks `sessionStorage` for a valid unexpired session token.
3. If found → auto-unlock: decrypt account metadata from vault, populate `walletStore`.
4. If not found → show lock screen.

---

## 7. Rules Summary

The rules below are binding regardless of which specific library is ultimately confirmed, because they are derived from architectural principles, not library choices.

| Rule | Status | Rationale |
|---|---|---|
| Components do not read from stores directly — they use hooks | ✅ Confirmed | Decoupling; hooks can be tested without rendering |
| Async/server state is separated from client state | ✅ Confirmed | Prevents dual source of truth |
| Key material never enters any state store | ✅ Confirmed | Non-negotiable security rule |
| Form state stays local to the form component | ✅ Confirmed | Forms are ephemeral; hoisting increases complexity for no benefit |
| Mutations invalidate queries on success | 🔶 Provisional | Correct pattern for TanStack Query; generalises to any async library |
| `walletStore` auto-locks on idle timeout | ✅ Confirmed | Principle confirmed; exact timeout mechanism is an implementation detail |

---

## 8. Conditions for Revision

Zustand, TanStack Query, and React Hook Form are provisionally selected. The following conditions would justify revisiting any of them before or during Phase 1:

### Zustand → revise if:
- The wallet session model requires **transactional state updates** (atomic multi-store writes) that Zustand cannot handle safely.
- A QoreChain SDK ships its own state management layer that would create a conflicting store architecture.
- Phase 1 implementation reveals that Zustand's lack of enforced immutability causes observable bugs that are impractical to prevent through convention alone.

### TanStack Query → revise if:
- The QoreChain RPC pattern (e.g. WebSocket-first, server-push) is fundamentally incompatible with a request/response caching model.
- The team selects an official QoreChain SDK that bundles its own data-fetching layer with equivalent capability.

### React Hook Form + Zod → revise if:
- QoreChain transaction fields require dynamic schemas that Zod cannot express cleanly.
- Performance profiling in Phase 1 reveals unacceptable re-render costs in complex form flows.

### How a revision is recorded:
A new ADR (ADR-0002 or later) is written that supersedes the relevant provisional decision. The decision status in this document is updated to reference the new ADR.
