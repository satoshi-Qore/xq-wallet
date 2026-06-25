# XQ Wallet — Product Roadmap

> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering

---

## Roadmap Philosophy

The roadmap is organised into phases with clear completion criteria. A phase is complete only when all items in it are done, tested, and audited. Features are not marked complete until they work end-to-end in a real (or mock) environment.

**Phases are sequential.** Phase 2 does not begin until Phase 1 is approved.

---

## Phase 0 — Foundation ✅ Complete

**Goal:** A working, production-quality project scaffold that enforces engineering standards.

| Item | Status |
|---|---|
| Next.js 15 + TypeScript + Tailwind scaffolded | ✅ Done |
| ESLint (flat config) + Prettier configured | ✅ Done |
| Husky + lint-staged pre-commit hooks | ✅ Done |
| Path aliases, tsconfig strict mode | ✅ Done |
| Folder structure established | ✅ Done |
| Environment variable template | ✅ Done |
| Comprehensive `.gitignore` | ✅ Done |
| Architecture documentation | ✅ Done |
| ADR-0001 recorded | ✅ Done |

**Exit criteria:** Approved by engineering lead. ✅

---

## Phase 1 — Core Wallet Foundation

**Goal:** A functional wallet that can create/import accounts, display a balance, and receive funds — against a mock or testnet QoreChain node.

**Dependencies:** Resolve OQ-1 through OQ-5 from `QORECHAIN_INTEGRATION_PLAN.md`.

### 1.1 Design System & UI Primitives

| Item | Priority | Notes |
|---|---|---|
| Button (all variants + loading state) | P0 | |
| Input + Label + FieldError | P0 | |
| Card | P0 | |
| Modal (accessible, keyboard-trapped) | P0 | |
| Spinner / Loading skeleton | P0 | |
| Badge | P1 | |
| Toast notification system | P1 | |
| Tooltip | P1 | |
| Avatar | P2 | |

### 1.2 Layout & Navigation

| Item | Priority | Notes |
|---|---|---|
| AppShell (sidebar + main area) | P0 | |
| Header with network indicator | P0 | |
| Mobile bottom navigation | P0 | |
| PageContainer | P0 | |
| Responsive breakpoint implementation | P0 | |

### 1.3 State & Data Infrastructure

| Item | Priority | Notes |
|---|---|---|
| Zustand store setup (wallet, network, ui, preferences) | P0 | |
| TanStack Query provider + queryClient | P0 | |
| Query key constants (`queryKeys.ts`) | P0 | |
| Mock QoreChain client (`__mocks__/`) | P0 | Unblocks UI dev before chain is ready |
| `preferencesStore` localStorage persistence | P1 | |
| Auto-lock timer (idle session management) | P1 | |

### 1.4 Security Layer (Vault)

| Item | Priority | Notes |
|---|---|---|
| BIP-39 mnemonic generation (24 words) | P0 | |
| PBKDF2 key derivation from password | P0 | |
| AES-256-GCM vault encryption/decryption | P0 | |
| IndexedDB vault storage (idb wrapper) | P0 | |
| Session token management (sessionStorage) | P0 | |
| HD key derivation (BIP-32/44) | P0 | Blocked on OQ-3, OQ-4 |
| Key material zeroing after signing | P0 | |

### 1.5 Onboarding Flow

| Item | Priority | Notes |
|---|---|---|
| Landing / welcome screen | P0 | |
| Create wallet flow (generate mnemonic) | P0 | |
| Seed phrase backup confirmation (quiz) | P0 | User must re-enter 4+ words |
| Set password screen | P0 | Strength indicator required |
| Import wallet flow (enter mnemonic) | P0 | |
| Lock screen | P0 | |

### 1.6 Wallet Dashboard

| Item | Priority | Notes |
|---|---|---|
| Balance display (large, prominent) | P0 | |
| Receive button → address + QR code | P0 | |
| Transaction history list | P1 | Mock data initially |
| Empty states (no txs, no balance) | P1 | |
| Network status indicator | P1 | |

**Phase 1 exit criteria:**
- [ ] User can create a wallet with a 24-word mnemonic
- [ ] User can import an existing wallet by mnemonic
- [ ] User can view their QoreChain address and QR code
- [ ] Balance is displayed (mock data or testnet)
- [ ] Wallet locks after idle timeout and on explicit lock
- [ ] All UI components meet WCAG 2.1 AA
- [ ] Security layer reviewed by a second engineer
- [ ] `npm audit` shows zero high/critical CVEs
- [ ] Engineering lead approves

---

## Phase 2 — Send, History & Network

**Goal:** A complete send/receive workflow. Real QoreChain network integration.

**Dependencies:** Phase 1 complete. All 10 OQs from integration plan resolved.

### 2.1 QoreChain Integration (Replace Mock)

| Item | Priority |
|---|---|
| Real RPC client (HTTP) | P0 |
| WebSocket subscription manager | P0 |
| Balance fetching (real) | P0 |
| Transaction history (real) | P0 |
| Gas/fee estimation | P0 |
| Transaction broadcasting | P0 |
| Error classification (RpcError, NetworkError, etc.) | P0 |
| networkStore RPC health monitoring | P1 |

### 2.2 Send Flow

| Item | Priority |
|---|---|
| Send form (recipient, amount, memo) | P0 |
| Address validation (real QoreChain format) | P0 |
| Amount validation (max balance check, dust check) | P0 |
| Fee estimate display | P0 |
| Confirmation modal (full address, amount, fee) | P0 |
| Password re-entry for high-value sends | P0 |
| Signing + broadcasting | P0 |
| Pending → confirmed → failed state tracking | P0 |
| Send to recent addresses (history) | P2 |
| Address book | P2 |

### 2.3 Transaction History

| Item | Priority |
|---|---|
| Full transaction list (paginated) | P0 |
| Transaction detail view | P0 |
| Filter by type (sent/received) | P1 |
| Search by hash or address | P1 |
| Link to QoreChain explorer | P1 |

### 2.4 Settings

| Item | Priority |
|---|---|
| Theme toggle (light/dark/system) | P1 |
| Auto-lock duration setting | P1 |
| Network selection (mainnet/testnet) | P1 |
| Change password | P1 |
| View recovery phrase (re-auth required) | P1 |
| Export account (encrypted JSON) | P2 |
| Delete wallet (with confirmation + warning) | P1 |

### 2.5 Hardware Wallet Support (Phase 2)

| Item | Priority |
|---|---|
| Ledger integration (HID) | P2 |
| Display QoreChain app on Ledger | P2 |

**Phase 2 exit criteria:**
- [ ] End-to-end send on QoreChain testnet
- [ ] Balance reflects real on-chain state within 15 seconds
- [ ] Transaction history shows all sends and receives
- [ ] Settings persist across sessions
- [ ] Integration test suite passing against testnet
- [ ] External security audit commissioned and issues resolved
- [ ] Engineering lead approves

---

## Phase 3 — Browser Extension & dApp Support

**Goal:** Package XQ Wallet as a Manifest V3 browser extension with an injected provider API.

| Item | Priority |
|---|---|
| Browser extension scaffold (MV3) | P0 |
| Background service worker | P0 |
| Popup UI (port the Next.js UI) | P0 |
| Content script for provider injection | P0 |
| `window.qorechain` injected provider API | P0 |
| dApp connection request flow | P0 |
| Sign transaction request from dApp | P0 |
| Sign message request from dApp | P0 |
| Connected sites management | P1 |
| WalletConnect v2 support | P1 |

**Phase 3 exit criteria:**
- [ ] Extension installable in Chrome / Brave / Edge
- [ ] A test dApp can request accounts, sign transactions, and receive confirmations
- [ ] Provider API documented
- [ ] Engineering lead approves

---

## Phase 4 — Mobile & Multi-Account

**Goal:** React Native mobile app. Multiple accounts per wallet.

| Item | Notes |
|---|---|
| React Native app (iOS + Android) | Shared business logic via shared packages |
| Multi-account support | Multiple BIP-44 indices per seed |
| Account naming and avatars | |
| WalletConnect mobile deep links | |
| Biometric unlock (Face ID / Touch ID) | Replaces password for session unlock |

---

## Phase 5 — Advanced Features

| Item | Notes |
|---|---|
| Token management (custom tokens) | When QoreChain supports tokens beyond native |
| NFT support | When QoreChain supports NFTs |
| Staking / delegation UI | When QoreChain has staking |
| Multi-language (i18n) | Extract strings from `config/strings.ts` |
| Shamir's Secret Sharing (SLIP-0039) | Social recovery |
| Air-gapped signing (QR-based) | For cold storage use case |

---

## Open Questions

All open questions are tracked in `QORECHAIN_INTEGRATION_PLAN.md`. The roadmap cannot proceed past Phase 1 until OQ-1 through OQ-10 are resolved.

---

## Versioning

| Phase | Version | Target |
|---|---|---|
| Phase 0 | `0.1.0` | Foundation (done) |
| Phase 1 | `0.2.0` | Core wallet (local / mock) |
| Phase 1 completion | `0.5.0` | Testnet-ready |
| Phase 2 completion | `1.0.0` | Mainnet launch |
| Phase 3 completion | `1.5.0` | Extension + dApp |
| Phase 4 | `2.0.0` | Mobile |
