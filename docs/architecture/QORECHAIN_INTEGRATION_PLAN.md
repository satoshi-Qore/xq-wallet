# QoreChain Integration Plan — XQ Wallet

> **Status:** Draft — pending QoreChain team review  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering  
> **Open questions:** Marked with ⚠️

---

## 1. Overview

This document describes how XQ Wallet connects to and interacts with the QoreChain network. It covers the RPC transport layer, the SDK abstraction, transaction lifecycle, account/address model, and what information must be confirmed with the QoreChain team before implementation.

---

## 2. Open Questions (Must Resolve Before Phase 1 Implementation)

These are blockers. Each item requires a definitive answer from the QoreChain team:

| # | Question | Impact |
|---|---|---|
| ⚠️ OQ-1 | What is the RPC API format? (JSON-RPC 2.0, REST, gRPC, custom?) | Determines entire transport layer design |
| ⚠️ OQ-2 | What is QoreChain's account model? (UTXO, account-based, other?) | Determines how balances, nonces, and UTXOs are handled |
| ⚠️ OQ-3 | What elliptic curve is used for signing? (secp256k1, ed25519, other?) | Determines signing library choice |
| ⚠️ OQ-4 | What is the BIP-44 coin type for QoreChain? | Required to set the HD derivation path |
| ⚠️ OQ-5 | What is the address format and checksum scheme? | Required for address validation |
| ⚠️ OQ-6 | What is the transaction structure / serialisation format? | Determines how transactions are built and signed |
| ⚠️ OQ-7 | Is there an official QoreChain JavaScript/TypeScript SDK? | Determines whether we build our own RPC client |
| ⚠️ OQ-8 | What does the fee/gas model look like? | Determines how fee estimation is implemented |
| ⚠️ OQ-9 | Are there WebSocket endpoints for real-time subscriptions? | Determines balance/tx polling vs. subscription strategy |
| ⚠️ OQ-10 | What are the available testnet RPC endpoints? | Required to begin development against a live network |

---

## 3. Assumed Architecture (Pending Confirmation)

The integration plan below is based on **reasonable assumptions** about QoreChain's architecture. Each assumption is tagged. All assumptions must be validated before code is written.

**Assumption A:** QoreChain exposes a JSON-RPC 2.0 HTTP endpoint for reads and writes.  
**Assumption B:** QoreChain uses an account-based model (similar to Ethereum).  
**Assumption C:** QoreChain uses secp256k1 key pairs.  
**Assumption D:** Transactions are signed offline and broadcast as a serialised signed payload.  
**Assumption E:** WebSocket endpoints exist for real-time block/transaction subscriptions.

---

## 4. Chain Layer Architecture

The chain layer lives in `src/lib/qorechain/` and provides a stable interface to the rest of the application. **No other module imports from `src/lib/qorechain/` except hooks.**

```
src/lib/qorechain/
├── client.ts          ← RPC transport (HTTP + WebSocket)
├── accounts.ts        ← address derivation, account metadata
├── transactions.ts    ← tx building and broadcasting
├── subscriptions.ts   ← WebSocket subscription manager
├── types.ts           ← QoreChain-specific types (RawTx, BlockHeader, etc.)
├── utils.ts           ← encoding/decoding helpers
└── index.ts           ← public API surface (the only file other modules import)
```

The public API surface (`index.ts`) is intentionally narrow:

```ts
// src/lib/qorechain/index.ts
export const qorechain = {
  // Accounts
  getBalance(address: Address): Promise<string>,
  getNonce(address: Address): Promise<number>,

  // Transactions
  buildTransaction(params: TxParams): Promise<UnsignedTx>,
  broadcastTransaction(signedTx: SignedTx): Promise<TxHash>,
  getTransaction(txHash: TxHash): Promise<TransactionDetail>,
  getTransactionHistory(address: Address, opts?: HistoryOptions): Promise<TransactionDetail[]>,

  // Network
  getBlockHeight(): Promise<number>,
  estimateFee(tx: UnsignedTx): Promise<FeeEstimate>,
  getNetworkStatus(): Promise<NetworkStatus>,

  // Subscriptions
  subscribeToBalance(address: Address, callback: (balance: string) => void): Unsubscribe,
  subscribeToTransactions(address: Address, callback: (tx: TransactionDetail) => void): Unsubscribe,
} as const
```

**The Security Layer is never called from the chain layer.** The chain layer only receives already-signed transaction bytes.

---

## 5. RPC Client (Assumption A: JSON-RPC 2.0)

```ts
// src/lib/qorechain/client.ts

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params: unknown[]
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: string | number
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

class QoreChainRpcClient {
  private readonly httpUrl: string
  private readonly wsUrl: string | null

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }
    const res = await fetch(this.httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json: JsonRpcResponse<T> = await res.json()
    if (json.error) throw new QoreChainRpcError(json.error)
    return json.result as T
  }

  subscribe(method: string, params: unknown[], callback: (data: unknown) => void): Unsubscribe {
    // WebSocket subscription implementation
  }
}
```

If the QoreChain API is not JSON-RPC 2.0, this client will be replaced — the interface in `index.ts` remains unchanged.

---

## 6. Address Model (Assumption B/C/D)

### Derivation path (pending OQ-4)

```
m / 44' / COIN_TYPE' / account' / change / index

COIN_TYPE: ⚠️ TBD — placeholder = 9999
account:   0  (single account in v1; multi-account deferred to Phase 2)
change:    0  (external chain; change addresses deferred)
index:     0, 1, 2, ... (incrementing per additional address)
```

### Address format (pending OQ-5)

Assumed to be a hex-encoded public key hash with a bech32 or checksum-hex encoding. Placeholder validation:

```ts
// To be replaced once OQ-5 is resolved
export function isValidQCAddress(value: string): boolean {
  // Placeholder — update with actual QoreChain address format
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}
```

---

## 7. Transaction Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. BUILD                                                             │
│  User inputs (recipient, amount, memo)                               │
│    → validate inputs (Zod schema)                                    │
│    → qorechain.getNonce(senderAddress)                               │
│    → qorechain.estimateFee(partialTx)                               │
│    → qorechain.buildTransaction(params) → UnsignedTx                │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│  2. REVIEW                                                            │
│  Show confirmation modal:                                             │
│    - Full recipient address (no truncation)                          │
│    - Exact amount + symbol                                           │
│    - Fee estimate                                                     │
│    - Total cost                                                       │
│  User explicitly confirms or cancels                                 │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ user confirms
┌───────────────────────────▼──────────────────────────────────────────┐
│  3. SIGN (Security Layer — isolated)                                  │
│    → unlock vault (password re-entry or session token)               │
│    → derive private key for active account                           │
│    → sign(UnsignedTx bytes)                                          │
│    → zero key material from memory                                   │
│    → return SignedTx                                                 │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│  4. BROADCAST                                                         │
│    → qorechain.broadcastTransaction(SignedTx) → TxHash               │
│    → update UI: pending state                                        │
│    → invalidate balance + history cache                              │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│  5. CONFIRM                                                           │
│    → poll / subscribe to TxHash confirmation                         │
│    → on confirmed: update UI, show success toast                     │
│    → on failed: show failure with reason                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Real-Time Subscriptions (Assumption E)

If WebSocket endpoints are available, XQ Wallet will maintain persistent subscriptions for the active account:

```
WS connected
  → subscribe to balance updates for activeAccount.address
  → subscribe to incoming transaction events for activeAccount.address
  → on balance event: invalidate TanStack Query ['balance', ...]
  → on tx event: push to toast + invalidate ['transactionHistory', ...]
```

If WebSocket endpoints are unavailable, polling via TanStack Query `refetchInterval` will be used as a fallback (15-second interval).

### Connection lifecycle

```
App mounts
  → connect WebSocket
  → on disconnect: exponential backoff reconnection (1s, 2s, 4s, 8s, max 60s)
  → on reconnect: re-subscribe to all active subscriptions
  → networkStore.setRpcStatus() reflects the connection state
```

---

## 9. Error Classification

All errors from the chain layer are classified before surfacing to the UI:

```ts
// src/lib/qorechain/errors.ts

export class QoreChainError extends Error {}

export class RpcError extends QoreChainError {
  constructor(public readonly code: number, message: string) { super(message) }
}

export class NetworkError extends QoreChainError {}       // connection lost
export class TimeoutError extends QoreChainError {}       // request timed out
export class InvalidResponseError extends QoreChainError {} // Zod validation failed
export class TxRejectedError extends QoreChainError {}    // node rejected tx
export class TxFailedError extends QoreChainError {       // tx included but failed
  constructor(public readonly txHash: TxHash, message: string) { super(message) }
}
```

The UI maps error types to user-facing messages. Raw RPC error codes are never shown to users.

---

## 10. Development Strategy

### Phase 1: Mock client

During early UI development, the QoreChain SDK will be replaced by a mock client that returns fixed data. This allows UI development to proceed without a live node.

```ts
// src/lib/qorechain/__mocks__/index.ts
export const qorechain = {
  getBalance: () => Promise.resolve('1000000000000000000'),  // 1 XQ
  // ... all methods return deterministic fixtures
}
```

Jest/Vitest will automatically use `__mocks__/index.ts` in tests.

### Phase 2: Testnet integration

Once OQ-1 through OQ-10 are resolved, replace the mock client with the real implementation and connect to QoreChain's testnet. All integration tests run against testnet.

### Phase 3: Mainnet

After testnet validation, point the production build at mainnet RPC endpoints.

---

## 11. SDK Decision (OQ-7)

If QoreChain provides an official TypeScript SDK:
- Evaluate it for security (no key operations hidden inside the SDK).
- Wrap it behind `src/lib/qorechain/index.ts` — the rest of the app is isolated from it.
- Ensure it is tree-shakable and does not balloon the bundle.

If no official SDK exists:
- Build a minimal, hand-rolled RPC client (as sketched in §5).
- Keep it under 500 lines, fully typed, and tested.
- Consider open-sourcing it as a standalone package.
