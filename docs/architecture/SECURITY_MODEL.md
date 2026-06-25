# Security Model — XQ Wallet

> **Status:** Approved  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering  
> **Classification:** Public (open-source project)

---

## Document Status

This document contains two distinct categories of content. Readers must distinguish between them:

| Category | Marker | Meaning |
|---|---|---|
| **Confirmed** | ✅ | Architectural principle or security rule that is locked. Cannot be changed without a new ADR and engineering lead approval. |
| **Proposed Implementation Plan** | 📋 | Specific implementation detail (algorithm, parameter value, storage format). Represents the current best design but is subject to revision during Phase 1 Security Layer implementation and after security testing. |

The security **principles** are confirmed. The specific **cryptographic parameters and storage formats** are proposed plans — they must be validated through implementation, testing, and ideally an external audit before being locked.

---

## 1. Security Philosophy

XQ Wallet is **non-custodial by design**. This is not merely a feature — it is the foundational invariant that every other security decision is derived from.

> **The invariant:** At no point does any entity other than the user have access to their private key material. Not the XQ Wallet developers. Not a server. Not a third-party SDK. Nobody.

This means:

- All key generation happens in the user's browser.
- All signing happens in the user's browser.
- Private keys are encrypted before being written to any persistent store.
- Decrypted key material exists in JavaScript memory for the minimum possible duration.

---

## 2. Trust Boundaries

```
                  UNTRUSTED                        TRUSTED (user's device)
                     │                                       │
   ─────────────────────────────────────────────────────────────────────
                     │                                       │
   QoreChain Network │                         Browser sandbox
   (RPC / explorer)  │                                       │
                     │       ╔═════════════════════╗         │
   CDN / hosting     │       ║   XQ Wallet App     ║         │
   infrastructure   ─┼──────►║                     ║         │
                     │       ║  UI + Chain Layer   ║         │
   User's ISP /      │       ║  (receive only)     ║         │
   network          ─┼──────►║                     ║         │
                     │       ║  ┌───────────────┐  ║         │
                     │       ║  │ Security Layer│  ║         │
   Third-party       │       ║  │  (isolated)   │  ║         │
   scripts          ─X──────►║  │               │  ║         │
   (blocked by CSP)  │       ║  │  WebCrypto    │  ║         │
                     │       ║  │  IndexedDB    │  ║         │
                     │       ║  └───────────────┘  ║         │
                     │       ╚═════════════════════╝         │
                     │                                       │
```

**Boundary rules:**

- The Security Layer has **no outbound network access**. It never calls RPC or any external service.
- The Chain Layer receives only **signed transaction bytes** from the Security Layer — it never receives private keys.
- Third-party scripts are blocked by Content Security Policy.
- The CDN serves only static assets — it has no code execution role.

---

## 3. Key Management

### ✅ 3.1 Confirmed Principles

> The use of WebCrypto as the cryptographic foundation is confirmed in ADR-0001-06. The specific algorithms and parameters used within WebCrypto are documented as Proposed in §3.3.

The following are confirmed security principles for key management. They constrain all implementation choices but do not prescribe specific algorithms or formats:

- Entropy must come from `crypto.getRandomValues()` — never `Math.random()` or any predictable source.
- Private keys must be encrypted before being written to any persistent store.
- The encryption key must be derived from the user's password — it must not be stored anywhere.
- Signing must occur inside the Security Layer. Only signed bytes may leave it.
- Decrypted key material must be zeroed from memory as soon as the signing operation completes.
- Key derivation must follow an industry-standard HD wallet scheme (BIP-39 / BIP-32 / BIP-44) for recoverability and interoperability.
- The BIP-39 wordlist must be bundled with the application — no network request for wordlist data.

---

> ### 📋 3.2 Proposed: Key Generation Flow
>
> **Status: Proposed Implementation Plan.** The flow below represents the intended design. It is subject to revision based on QoreChain's confirmed signing curve (OQ-3) and coin type (OQ-4).
>
> ```
> Entropy source: WebCrypto.getRandomValues() — 256 bits (32 bytes)
>      ↓
> BIP-39 mnemonic: 24 words (256 bits entropy + 8-bit checksum)
>      ↓
> BIP-32 master node: HMAC-SHA512("Bitcoin seed", entropy)
>      ↓
> BIP-44 derivation: m/44'/QC_COIN_TYPE'/0'/0/0
>      ↓
> Account key pair: { publicKey, privateKey }
> ```
>
> The derivation path coin type (`QC_COIN_TYPE`) is pending confirmation from the QoreChain team (see OQ-4 in `QORECHAIN_INTEGRATION_PLAN.md`). A placeholder is used until confirmed.

---

> ### 📋 3.3 Proposed: Encryption at Rest
>
> **Status: Proposed Implementation Plan.** The algorithm choices and parameter values below represent the current best design based on industry standards as of 2026. They will be validated during Phase 1 Security Layer implementation, reviewed by a second engineer, and ideally confirmed by an external audit before v1 launch. Parameters may be revised upward (e.g. KDF iteration count) based on performance testing on low-end hardware.
>
> **Proposed flow:**
> ```
> User password
>      ↓
> PBKDF2(password, salt, 600_000 iterations, SHA-256) → 256-bit encryption key
>      ↓
> AES-256-GCM(plaintext: mnemonic | privateKey, key, iv)
>      ↓
> Vault entry: { ciphertext, iv, salt, version, accountMeta }
>      ↓
> IndexedDB (xqw-vault database)
> ```
>
> **Proposed parameters:**
>
> | Parameter | Proposed Value | Basis | Confirmed? |
> |---|---|---|---|
> | KDF | PBKDF2-SHA256 | Browser-native via WebCrypto; auditable | Pending testing |
> | Iterations | 600,000 | OWASP 2023 recommendation | Pending hardware benchmarks |
> | Salt | 16 bytes, random per vault | Prevents rainbow table attacks | Pending testing |
> | Cipher | AES-256-GCM | Authenticated encryption; detects tampering | Pending testing |
> | IV | 12 bytes, random per encryption | Required for GCM mode; never reused | Pending testing |
> | Vault schema version | `1` (embedded in vault entry) | Enables future migration | Pending design |
>
> **On KDF choice:** PBKDF2-SHA256 is browser-native and widely audited, which is why it is the proposed starting point. Argon2id is the preferred KDF from a cryptographic strength standpoint (memory-hard; more resistant to GPU/ASIC cracking) and will be adopted when a compact, audited WASM implementation is available. The vault schema `version` field is included specifically to enable a seamless migration from PBKDF2 to Argon2id without requiring users to re-enter their mnemonic.

---

> ### 📋 3.4 Proposed: In-Memory Key Lifetime
>
> **Status: Proposed Implementation Plan.** The mitigations below are design intentions. JavaScript's garbage collector does not guarantee deterministic memory clearing; the actual effectiveness of zeroing will be assessed during implementation.
>
> ```
> unlock event
>   → password entered
>   → PBKDF2 derives decryption key
>   → AES-GCM decrypts vault entry
>   → [key material in memory]
>   → sign(transactionBytes)           ← minimum possible scope
>   → [key bytes zeroed / nulled]
>   → return signed transaction bytes
>   ← ONLY signed bytes leave the Security Layer
> ```
>
> Intended mitigations:
> - Use `Uint8Array` for key bytes (allows overwriting with zeros after use).
> - Minimise the scope of any variable holding key material.
> - Never convert key material to a string (strings are immutable in JS).
> - Use WebCrypto `CryptoKey` objects where possible — they are not extractable by default (`extractable: false`).

---

> ### 📋 3.5 Proposed: Session Management
>
> **Status: Proposed Implementation Plan.** The session mechanism below is the intended design. Specific timeout values and session token storage strategy will be finalised during Phase 1.
>
> ```
> Unlock
>   → Security Layer generates a random 256-bit session token
>   → Session token stored in sessionStorage (ephemeral — cleared on tab close)
>   → walletStore receives: isUnlocked: true, sessionExpiresAt: now + 15 min
>   → On each sensitive action: validate session token + check expiry
>   → Auto-lock timer: if idle > autoLockMinutes → call walletStore.lock()
> ```
>
> The session token does **not** decrypt the vault — it is only an indicator that the user recently authenticated. The decryption key derived from the password is never stored; it is re-derived on every signing operation that requires key access.

---

## ✅ 4. Threat Model

### 4.1 Threat Actors

| Actor | Capability | Mitigation |
|---|---|---|
| **Remote attacker** | Network interception, phishing | HTTPS only; strict CSP; subresource integrity on bundled assets |
| **Malicious web page** | XSS injection into wallet page | CSP; sanitised inputs; no `dangerouslySetInnerHTML` |
| **Malicious npm package** | Supply-chain attack on dependencies | Minimal dependency footprint; `npm audit`; lockfile pinned |
| **Physical attacker (device access)** | Access to browser's IndexedDB | Encryption at rest (proposed: AES-256-GCM); strong password required |
| **Compromised CDN** | Serving modified JS to users | Subresource integrity (SRI) headers; future: code signing |
| **Malicious QoreChain RPC node** | Return crafted responses | Transaction validation before signing; amount/address confirmation UI |

### 4.2 Attack Surface Analysis

| Surface | Risk | Control |
|---|---|---|
| IndexedDB vault | High — key material at rest | Encrypted at rest (proposed: AES-256-GCM); password-gated |
| sessionStorage session token | Medium — ephemeral session | 15-min timeout; tab-close cleanup |
| Memory (JS heap) | Medium — key bytes in memory during signing | Uint8Array zeroing; minimal lifetime |
| RPC responses | Medium — malicious data injection | Schema validation (Zod) on all responses |
| npm dependencies | Medium — supply chain | Audit CI; minimal deps; lockfile |
| UI inputs | Low — user-controlled | Validated with Zod before use |
| Console / devtools | Low — development only | Sanitised logger; key material never logged |

### 4.3 Out of Scope Threats (v1)

- Compromised operating system (kernel-level keylogger)
- Compromised browser (rogue browser extension)
- Side-channel attacks (timing, spectre)
- Quantum computing attacks on elliptic curve cryptography

These will be revisited in the security model as the product matures.

---

## ✅ 5. Security Rules (Enforced)

The following rules are non-negotiable and will be enforced by code review, ESLint, and CI:

```
RULE SEC-01: Private keys must never be serialised to a string.
RULE SEC-02: Private keys must never be logged (even at debug level).
RULE SEC-03: Private keys must never be stored in React state, Zustand, or TanStack Query.
RULE SEC-04: Math.random() must never be used for any cryptographic purpose.
RULE SEC-05: All RPC responses must be validated with Zod before use.
RULE SEC-06: dangerouslySetInnerHTML is banned.
RULE SEC-07: eval() and new Function() are banned.
RULE SEC-08: All user-supplied addresses must pass isValidAddress() before use.
RULE SEC-09: Transaction amounts must be validated as positive, non-zero bigints.
RULE SEC-10: The Security Layer has no network access — it must not import fetch or axios.
```

---

## ✅ 6. Dependency Security

### Minimal dependency principle

Every dependency added to the project expands the attack surface. Before adding any npm package:

1. Is it necessary, or can it be implemented in <50 lines with WebCrypto/browser APIs?
2. What is the package's download count, maintenance status, and last audit?
3. Does it have any known CVEs? (`npm audit`)
4. Is the source code auditable?

### Dependency categories

| Category | Approach |
|---|---|
| Cryptographic primitives | WebCrypto API only — no third-party crypto libraries in the security path |
| BIP-39 wordlist | Bundled static wordlist — no library dependency |
| HD key derivation | Minimal, audited pure-TS implementation — to be reviewed before adoption |
| QoreChain RPC | QoreChain's official SDK (once available) or a minimal hand-rolled client |
| UI / framework | Next.js, React, Tailwind — large community, well-audited |

---

## ✅ 7. Security Audit Plan

Prior to v1 launch, the following audits are required:

1. **Dependency audit:** `npm audit` passing with zero high/critical findings.
2. **Static analysis:** ESLint security rules passing in CI.
3. **Manual code review:** Security Layer (`src/lib/vault/`, `src/lib/crypto/`) reviewed by a second engineer.
4. **External audit (recommended):** Third-party security audit of key generation, encryption, and signing flows before mainnet launch.

---

## ✅ 8. Incident Response

If a security vulnerability is discovered:

1. Do not disclose publicly until a fix is deployed.
2. Open a private issue in the project tracker.
3. Fix, test, and deploy the patch.
4. Publish a security advisory in `docs/security/` describing the issue and fix.
5. Credit the reporter (with their permission).

Security contact: to be established in `SECURITY.md` at project root before public launch.
