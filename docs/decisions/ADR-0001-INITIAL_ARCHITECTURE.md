# ADR-0001: Initial Architecture Decisions

> **Status:** Part I — Confirmed | Part II — Provisional  
> **Date:** 2026-06-25  
> **Authors:** XQ Wallet Engineering  
> **Deciders:** XQ Wallet Engineering Lead

---

## Context

XQ Wallet is starting from scratch. Before writing feature code, a set of foundational architectural decisions must be captured. This ADR documents those choices — what was considered, what was decided, and why.

Decisions here fall into two categories with different weights:

**Part I — Confirmed Decisions** are locked. They define the project's identity and constraints. Changing them would require a new ADR and engineering lead approval, because the impact is broad enough to ripple through every subsequent decision.

**Part II — Provisional Decisions** are the current best choices based on available information. They represent where we will start in Phase 1. They are deliberately called "provisional" because they depend on factors not yet fully known — QoreChain's chain specifics, third-party library behaviour under real conditions, and security testing results. If implementation reveals a material reason to change one, a new ADR is written to supersede it. Provisional decisions should not be changed casually, but they can be changed without the same weight as a confirmed decision.

Decisions recorded here should not be revisited lightly. If a decision must be changed, a new ADR is created that supersedes the relevant section of this one.

---

## Part I — Confirmed Decisions

These decisions are locked. They reflect product identity, non-negotiable engineering standards, and security invariants.

> **Note on numbering:** ADR numbers are identity labels assigned at the time each decision was recorded. Part I contains ADRs 01, 02, 03, 06, and 09. Part II contains ADRs 04, 05, 07, 08, and P01. The gaps in Part I are not errors — those numbers belong to decisions that were moved to Part II because they are provisional. Numbering will not be reassigned.

---

### ADR-0001-01: Next.js 15 with App Router as the Application Framework

**Status:** ✅ Confirmed — implemented in Phase 0

**Context:**  
XQ Wallet is a browser-based application. We need a React framework that provides routing, rendering control, and a strong developer experience. The rendering model must allow us to run exclusively client-side for sensitive wallet screens.

**Decision:**  
Use **Next.js 15** with the **App Router**.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| Vite + React SPA | No SSG for marketing pages; no file-based routing; more manual configuration |
| Remix | Server-first model conflicts with non-custodial requirement (no server-side rendering of sensitive state) |
| Nuxt / Vue | Team familiarity and ecosystem are stronger in React |
| Create React App | Deprecated; no longer maintained |

**Rationale:**
- App Router enables route groups, allowing `(wallet)` routes to be fully client-side while `(marketing)` routes are statically generated.
- Excellent TypeScript integration with strict mode.
- Active maintenance by Vercel with a strong LTS commitment.
- `next/font` provides optimised font loading with zero layout shift.
- `next/image` provides optimised image loading out of the box.

**Consequences:**
- Wallet screens must be explicitly marked `'use client'`.
- Server Components must not access any wallet state.
- Bundle size is a concern — monitor with `@next/bundle-analyzer`.

---

### ADR-0001-02: TypeScript with Strict Mode

**Status:** ✅ Confirmed — implemented in Phase 0

**Context:**  
XQ Wallet handles financial assets and cryptographic operations. Type safety is not optional.

**Decision:**  
Use **TypeScript 5** with the strictest possible compiler settings, including `exactOptionalPropertyTypes`.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| JavaScript | Not acceptable for safety-critical financial software |
| TypeScript without strict | Strict mode catches a significant class of runtime bugs at compile time |
| Flow | Smaller ecosystem; TypeScript is the clear industry standard |

**Rationale:**
- `strict: true` enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and more.
- `exactOptionalPropertyTypes` prevents subtle bugs where `undefined` is accidentally assigned to an optional property.
- `noUnusedLocals` and `noUnusedParameters` prevent code rot.
- Branded types (`Address`, `TxHash`, `PrivateKey`) provide compile-time guarantees about data identity.

**Consequences:**
- Slightly higher initial development friction — correct types must be provided.
- Some third-party libraries have incomplete type definitions — use `skipLibCheck: true`.
- The compiler will catch bugs that other wallets may only discover in production.

---

### ADR-0001-03: Tailwind CSS v3 for Styling

**Status:** ✅ Confirmed — implemented in Phase 0

**Context:**  
We need a styling solution that is fast, maintainable, and integrates well with our design token system.

**Decision:**  
Use **Tailwind CSS v3** with a custom theme extension.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| Tailwind CSS v4 | Too new at project start; breaking changes to config model; ecosystem compatibility uncertain |
| CSS Modules | More boilerplate; no design token integration by default |
| styled-components / Emotion | Runtime style injection is a security concern (violates strict CSP); larger bundle |
| Vanilla CSS | Lacks the design system scaffolding Tailwind provides |

**Rationale:**
- No runtime style injection — compatible with a strict Content Security Policy.
- CSS is purged at build time — zero unused styles in production.
- Design tokens (colours, spacing, fonts) are defined once in `tailwind.config.ts` and used consistently everywhere.
- The `darkMode: 'class'` strategy gives us programmatic control over theme switching.

**Consequences:**
- HTML class lists can be verbose — mitigated by extracting components.
- Tailwind v4 migration will be needed in the future — design tokens and utilities should remain compatible.

---

### ADR-0001-06: WebCrypto API as the Cryptographic Foundation

**Status:** ✅ Confirmed (principle) — specific algorithm parameters are Provisional (see Part II)

**Context:**  
The wallet must generate keys, encrypt vault data, and sign transactions. The choice of cryptographic foundation is a critical, irreversible security decision.

**Decision:**  
Use the **browser's native WebCrypto API** (`window.crypto.subtle`) as the foundation for all cryptographic operations. No third-party JavaScript crypto library will be used in the critical security path unless WebCrypto cannot support a required primitive.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| `noble-curves` + `noble-hashes` | High quality and audited, but adds a dependency in the security path. Retained as a potential supplement if WebCrypto cannot support QoreChain's signing curve. |
| `ethers.js` / `viem` | Ethereum-specific; unclear QoreChain compatibility; large bundle; mixing chain client with key management is undesirable |
| `libsodium-wasm` | WASM binary that is hard to audit; larger bundle |
| Custom cryptography | Prohibited — never implement cryptographic primitives from scratch |

**Rationale:**
- WebCrypto is implemented natively in the browser engine (C++ level) — not in JavaScript.
- It is widely audited and battle-tested.
- `CryptoKey` objects are not extractable by default — they cannot be accidentally logged or serialised.
- Zero additional bundle cost.
- Supported in all modern browsers.

**Consequences:**
- WebCrypto does not support all curves. If QoreChain uses a curve not natively supported (pending OQ-3), `noble-curves` may supplement — but only for the specific primitive WebCrypto cannot provide.
- Specific algorithm choices (KDF, cipher, parameters) are documented as Provisional in Part II.

---

### ADR-0001-09: No Server-Side Key Operations

**Status:** ✅ Confirmed — non-negotiable

**Context:**  
This is the non-custodial invariant. It is what XQ Wallet fundamentally is.

**Decision:**  
There will be no server that handles key material. Ever. This constraint applies to all current and future architecture choices.

**Rationale:**  
A custodial or semi-custodial wallet requires users to trust the operator. XQ Wallet's value proposition is that no trust is required. Violating this invariant would fundamentally change the product's nature. This is the one decision that cannot be revisited by a new ADR — it would require a change to the product vision itself.

**Consequences:**
- No "forgot password" reset via email — users must safeguard their mnemonic.
- No server-side transaction replay or recovery.
- The UX burden of secure backup (seed phrase) falls entirely on the user — onboarding must communicate this clearly and repeatedly.

---

## Part II — Provisional Decisions

These decisions are the current best choices. They will be validated during Phase 1 implementation. If Phase 1 reveals a material reason to change one, a new ADR is written. They should not be changed without documented reasoning.

---

### ADR-0001-04: Zustand for Client State

**Status:** 🔶 Provisional — preferred library, subject to Phase 1 validation

**Context:**  
The wallet has several pieces of global state that do not come from the network: unlock status, active account, UI modals, preferences.

**Decision:**  
Begin Phase 1 with **Zustand** for all client-side global state. Confirm or revise at end of Phase 1.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| Redux Toolkit | Significant boilerplate; overkill for this use case |
| React Context + useReducer | Performance issues at scale; no devtools; verbose |
| Jotai | Atom model is well-suited to derived state but less clear for the wallet session model |
| MobX | Larger bundle; implicit reactivity is harder to reason about in security-critical code |
| Valtio | Proxy-based mutation model is less predictable |

**Rationale:**
- Minimal bundle size (~3.5kB).
- No boilerplate — store definition is a plain function.
- Excellent TypeScript inference without extra effort.
- `subscribeWithSelector` middleware enables efficient selective subscriptions.
- `persist` middleware handles `localStorage` synchronisation for preferences.
- Straightforward to test — stores are plain JS objects.

**Why provisional:** The wallet session model is complex enough that unexpected requirements (e.g., transactional multi-store updates, deep SDK integration) could surface during Phase 1 that Zustand handles poorly. The decision is confirmed once Phase 1 is complete without material issues.

**Conditions for revision:** See `STATE_MANAGEMENT.md §8`.

**Consequences:**
- Zustand does not enforce immutability — discipline is required to avoid mutations.
- Stores must be carefully designed to not hold sensitive data (see `SECURITY_MODEL.md`).

---

### ADR-0001-05: TanStack Query v5 for Server/Async State

**Status:** 🔶 Provisional — preferred library, subject to Phase 1 validation

**Context:**  
Chain data (balances, transactions, gas estimates) must be fetched, cached, and kept fresh.

**Decision:**  
Begin Phase 1 with **TanStack Query v5** (React Query) for all async data originating from the QoreChain network. Confirm or revise once the QoreChain RPC model is fully understood (OQ-1, OQ-9).

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| SWR | Smaller feature set; less flexible mutation API; less active development |
| Manual fetch + useState | Requires re-implementing caching, deduplication, stale-while-revalidate from scratch |
| Redux with Thunks/Sagas | Overkill; mixes server state into client state store |
| Apollo Client | Designed for GraphQL; QoreChain uses JSON-RPC |

**Rationale:**
- Stale-while-revalidate caching prevents unnecessary loading spinners.
- Request deduplication prevents redundant RPC calls when multiple components read the same data.
- Automatic background refetching keeps balances fresh.
- `invalidateQueries` after mutations keeps the cache consistent.
- Excellent DevTools for debugging in development.

**Why provisional:** If QoreChain's RPC is primarily WebSocket-push rather than request/response, the request-caching model may need to be replaced or supplemented. This will be assessed once OQ-1 and OQ-9 are resolved.

**Conditions for revision:** See `STATE_MANAGEMENT.md §8`.

**Consequences:**
- Developers must understand the TanStack Query mental model (not just hooks).
- Query key structure must be kept consistent — enforced by `src/lib/queryKeys.ts`.

---

### ADR-0001-07: IndexedDB for Encrypted Vault Storage

**Status:** 🔶 Provisional — preferred storage mechanism, subject to Phase 1 validation

**Context:**  
Encrypted key material must be stored persistently in the user's browser.

**Decision:**  
Use **IndexedDB** (via a thin wrapper) as the vault store.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| `localStorage` | Synchronous; string-only; no structured data; accessible to all same-origin scripts |
| `sessionStorage` | Ephemeral — cleared on tab close; not suitable for persisted vault |
| Cookies | Not designed for large data; sent with HTTP requests by default |
| OPFS (Origin Private File System) | Newer API with more limited support; overkill for key-value vault |

**Rationale:**
- IndexedDB supports structured binary data (`Uint8Array`, `ArrayBuffer`) natively.
- Larger storage quota than `localStorage`.
- Asynchronous — does not block the main thread.
- Scoped to the origin — other websites cannot access it.

**Why provisional:** The specific vault schema (`{ ciphertext, iv, salt, version, accountMeta }`) and the choice of IndexedDB wrapper library are implementation details that will be finalised during Phase 1 Security Layer implementation.

**Consequences:**
- IndexedDB has a more complex API than `localStorage` — a thin wrapper (`idb` or hand-rolled) will be used.
- Clearing browser storage wipes the vault — users must be warned and prompted to confirm seed phrase backup.

---

### ADR-0001-08: BIP-39 / BIP-32 / BIP-44 for Key Derivation

**Status:** 🔶 Provisional — standard selected; specific parameters pending QoreChain confirmation

**Context:**  
Industry-standard HD wallet key derivation is required for a non-custodial wallet.

**Decision:**  
Use **BIP-39** for mnemonic generation, **BIP-32** for HD key derivation, and **BIP-44** for the derivation path structure.

**Alternatives considered:**

| Alternative | Rejected reason |
|---|---|
| Random private key (no mnemonic) | Not recoverable without the private key file; poor UX; not industry standard |
| Slip-0039 (Shamir's Secret Sharing) | Complex; not widely understood; deferred to Phase 3 |
| Custom derivation scheme | Non-standard; breaks compatibility with other wallets |

**Rationale:**
- Universal standard — users can import their wallet into any compatible wallet tool.
- 24-word mnemonics provide 256 bits of entropy.
- BIP-44 paths allow deterministic derivation of multiple accounts from a single seed.

**Why provisional:** The BIP-44 coin type for QoreChain is unknown (⚠️ OQ-4 in `QORECHAIN_INTEGRATION_PLAN.md`). The signing curve has not been confirmed (⚠️ OQ-3). Until both are resolved, the full derivation flow cannot be implemented. The standard is confirmed; the parameters are not.

**Specific open items before this decision is fully confirmed:**
- OQ-3: Signing curve (determines whether WebCrypto alone is sufficient)
- OQ-4: BIP-44 coin type for QoreChain
- OQ-6: Transaction serialisation format

**Consequences:**
- A placeholder coin type is used during Phase 1 development against mock data.
- The BIP-39 wordlist is bundled — adds ~80kB (uncompressed) to the bundle.

---

### ADR-0001-P01: Proposed Cryptographic Parameters

**Status:** 📋 Planned — implementation details, not yet confirmed

**Context:**  
The WebCrypto-based Security Layer (confirmed in ADR-0001-06) requires specific algorithm choices and parameter values for the KDF, cipher, and vault format. These are distinct from the choice to use WebCrypto itself.

**Proposed parameters:**

| Concern | Proposed Choice | Basis |
|---|---|---|
| KDF | PBKDF2-SHA256 | WebCrypto-native; OWASP 2023 recommendation |
| KDF iterations | 600,000 | OWASP 2023 minimum for PBKDF2-SHA256 |
| Encryption cipher | AES-256-GCM | Authenticated encryption; WebCrypto-native |
| Salt length | 16 bytes, random per vault | Standard recommendation |
| IV length | 12 bytes, random per encryption | GCM specification requirement |
| Future KDF | Argon2id | Preferred when audited WASM available |

**When this becomes confirmed:** After the Security Layer is implemented, benchmarked on low-end hardware, and reviewed by a second engineer. Iteration count may increase if hardware performance allows. KDF may change to Argon2id if a suitable implementation becomes available before v1.

**Recording:** When confirmed, a new ADR (ADR-0002) will record the final parameters. This entry will reference it.

---

## Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-25 | Initial architecture decisions recorded |
| 1.1 | 2026-06-25 | Split into Confirmed (Part I) and Provisional (Part II) per documentation revision |
