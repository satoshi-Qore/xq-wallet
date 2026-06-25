# System Architecture — XQ Wallet

> **Status:** Approved  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering

---

## 1. Vision & Constraints

XQ Wallet is a **premium, open-source, non-custodial browser wallet** for the QoreChain ecosystem. Every architectural decision flows from four non-negotiable constraints:

| Constraint | Implication |
|---|---|
| **Non-custodial** | Private keys are generated, encrypted, and stored exclusively on the user's device. They never leave the browser. |
| **Open-source** | No proprietary SDKs in the critical security path. All cryptographic primitives must be auditable. |
| **Browser-first** | The primary runtime is a modern web browser. No server-side key operations. |
| **QoreChain-native** | The wallet is purpose-built for QoreChain. Generic multi-chain abstractions are deferred. |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User's Browser                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Next.js Application                        │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │   │
│  │  │  UI Layer   │  │ State Layer  │  │  Chain Layer         │   │   │
│  │  │             │  │              │  │                      │   │   │
│  │  │  React +    │◄─┤  Zustand     │◄─┤  QoreChain SDK       │   │   │
│  │  │  Tailwind   │  │  TanStack    │  │  (abstraction)       │   │   │
│  │  │  Components │  │  Query       │  │                      │   │   │
│  │  └─────────────┘  └──────────────┘  └──────────┬───────────┘   │   │
│  │                                                  │               │   │
│  │  ┌──────────────────────────────────────────────▼───────────┐   │   │
│  │  │                    Security Layer                         │   │   │
│  │  │                                                           │   │   │
│  │  │   WebCrypto API  │  BIP-39 Mnemonic  │  AES-GCM Vault   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                   Persistence Layer                       │   │   │
│  │  │                                                           │   │   │
│  │  │   IndexedDB (encrypted vault)  │  sessionStorage (ephemeral)│   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTPS / WSS
                              │
              ┌───────────────▼───────────────┐
              │        QoreChain Network       │
              │                               │
              │   RPC Node  │  WS Node        │
              └───────────────────────────────┘
```

---

## 3. Layer Definitions

### 3.1 UI Layer

The presentation layer. Responsible only for rendering state and dispatching user intents.

- **Framework:** Next.js 15 App Router with React 19
- **Rendering model:** Client-side for all wallet screens (sensitive UI must not be server-rendered). Static generation for marketing/landing pages only.
- **Styling:** Tailwind CSS v3 with a custom design token layer
- **Component model:** See `COMPONENT_ARCHITECTURE.md`

**Rule:** No business logic, no cryptography, no direct chain calls in the UI layer. Components only call hooks.

### 3.2 State Layer

Bridges the UI and the chain/security layers. Owns the application's runtime state.

- **Client state:** Zustand stores (wallet connection, UI state, preferences)
- **Server/async state:** TanStack Query (balances, transaction history, chain data)
- **Form state:** React Hook Form (send form, settings)

See `STATE_MANAGEMENT.md` for full store structure and data-flow rules.

### 3.3 Chain Layer

Abstracts all QoreChain network interactions behind a stable interface. The rest of the application never calls RPC directly.

- **Abstraction:** `src/lib/qorechain/` — a thin SDK wrapper
- **Transport:** JSON-RPC over HTTPS for reads; WebSocket for real-time subscriptions
- **Signing:** All signing happens in the Security Layer. The Chain Layer only broadcasts signed transactions.

See `QORECHAIN_INTEGRATION_PLAN.md` for the full integration design.

### 3.4 Security Layer

The most critical layer. Handles all key material.

- **Key generation:** BIP-39 mnemonic → BIP-32/44 HD derivation
- **Encryption at rest:** AES-256-GCM via WebCrypto API
- **Key derivation from password:** PBKDF2 (600,000 iterations, SHA-256) or Argon2id (if available in the runtime)
- **Signing:** Keys are decrypted into memory only for the duration of a signing operation, then zeroed

See `SECURITY_MODEL.md` for the complete threat model.

### 3.5 Persistence Layer

Manages durable and ephemeral storage, always at the boundary of the Security Layer.

| Store | Contents | Encryption |
|---|---|---|
| `IndexedDB` (primary vault) | Encrypted key material, encrypted accounts, settings | AES-256-GCM — encrypted before write |
| `sessionStorage` | Unlocked session token (ephemeral, cleared on tab close) | No — intentionally ephemeral |
| `localStorage` | Non-sensitive preferences (theme, network) | No — never key material |

**Rule:** Raw key material never touches `localStorage` or `sessionStorage`. IndexedDB is the only allowed store for encrypted vault data.

---

## 4. Request / Data Flow

### 4.1 Read Flow (e.g., fetching balance)

```
User opens wallet
  → UI component mounts
  → useBalance() hook fires TanStack Query
  → QoreChain SDK calls RPC node
  → Response cached in TanStack Query cache
  → UI re-renders with balance
```

### 4.2 Write Flow (e.g., sending a transaction)

```
User fills send form → submits
  → useSendTransaction() hook called
  → Validates inputs (type system + runtime checks)
  → Requests password / biometric unlock
  → Security Layer decrypts key from vault into memory
  → Security Layer signs transaction bytes
  → Key material zeroed from memory
  → Chain Layer broadcasts signed tx to RPC node
  → TanStack Query invalidates balance + tx history cache
  → UI shows pending → confirmed state
```

### 4.3 Wallet Creation Flow

```
User chooses "Create Wallet"
  → Security Layer generates 24-word BIP-39 mnemonic
  → UI displays mnemonic for backup (write-only — never stored plain)
  → User confirms backup
  → User sets password
  → Security Layer: password → PBKDF2 → AES-256-GCM key
  → Security Layer encrypts mnemonic + derived private key
  → Encrypted vault written to IndexedDB
  → Mnemonic bytes zeroed from memory
  → Session token created in sessionStorage
  → Wallet unlocked
```

---

## 5. Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Industry standard; RSC for future server features; strong TypeScript support |
| Language | TypeScript 5 (strict) | Safety-critical code demands the strictest type checking available |
| Styling | Tailwind CSS v3 | Utility-first; no runtime style injection risk; purges unused CSS |
| Client state | Zustand *(provisional)* | Minimal footprint; no boilerplate; excellent TypeScript inference. See ADR-0001-04 and `STATE_MANAGEMENT.md §8`. |
| Async/server state | TanStack Query v5 *(provisional)* | Stale-while-revalidate caching; request deduplication; subscription support. See ADR-0001-05. |
| Form handling | React Hook Form *(provisional)* | Uncontrolled inputs; minimal re-renders; strong validation integration |
| Validation | Zod | Runtime + compile-time type safety; consistent schema across forms and APIs |
| Cryptography | WebCrypto API (native) | Browser-native; no third-party crypto in the security path |
| Mnemonic | BIP-39 wordlist (MIT) | Standard; auditable; no dependency on a black-box library |
| HD derivation | BIP-32/44 (pure TS) | Standard; auditable; QoreChain derivation path TBD with chain team |
| Testing | Vitest + Testing Library | Fast; native ESM; co-located test files |
| Linting | ESLint 9 (flat config) | Enforces security and style rules pre-commit |
| Formatting | Prettier | Consistent output; no style debates |
| Git hooks | Husky + lint-staged | Enforces quality gates before every commit |

---

## 6. Deployment Model

XQ Wallet is deployed as a **static web application**. There is no application server.

```
Source code (C:\xq-wallet)
  → next build
  → Static HTML + JS bundles (/_next/static)
  → Served from a CDN (e.g., Cloudflare Pages, Vercel, self-hosted nginx)
```

**No server-side wallet operations.** Any future backend (price feeds, transaction indexer) is a **read-only auxiliary service** — it never touches key material.

### Content Security Policy

A strict CSP will be enforced at the CDN / reverse-proxy layer:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  connect-src 'self' <qorechain-rpc-domain>;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
```

---

## 7. Cross-Cutting Concerns

### Error Handling

- All async operations return `[data, error]` tuples (see `tryCatch` in `utils/`)
- Errors are classified: `NetworkError`, `UserRejectedError`, `VaultError`, `ValidationError`
- No unhandled promise rejections. All chain calls are wrapped.

### Logging

- `console.log` is banned by ESLint (warn level)
- A structured logger (`src/lib/logger.ts`) wraps `console.warn`/`console.error` and will be wired to a telemetry sink in production
- **Key material is never logged**. Logger has a sanitise step.

### Internationalisation (i18n)

- Deferred to Phase 2. All user-facing strings should be defined in `src/config/strings.ts` (not inline) from the beginning to ease future extraction.

### Accessibility

- WCAG 2.1 AA minimum. All interactive elements must be keyboard-navigable.
- See `UI_GUIDELINES.md` for full accessibility rules.

---

## 8. Out of Scope (v1)

- Browser extension (Manifest V3) — Phase 3
- Mobile app (React Native) — Phase 4
- Hardware wallet (Ledger/Trezor) integration — Phase 2
- Multi-chain support — post-v1
- WalletConnect protocol — Phase 2
- dApp browser / injected provider — Phase 3
