# XQ Ecosystem - GitHub Docs Setup Script
# Run: cd C:\xq-wallet  then  .\setup-ecosystem.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO_URL = "https://github.com/satoshi-Qore/xq-ecosystem.git"
$WORK_DIR = "$env:TEMP\xq-ecosystem-setup"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  XQ Ecosystem - Docs push" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Clone
if (Test-Path $WORK_DIR) { Remove-Item -Recurse -Force $WORK_DIR }
Write-Host "[1/5] Klonlaniyor: $REPO_URL" -ForegroundColor Yellow
git clone $REPO_URL $WORK_DIR
Set-Location $WORK_DIR
git config user.name "Murat"
git config user.email "colakdemircimurat@gmail.com"
Write-Host "      Tamamlandi." -ForegroundColor Green

# 2. Write files
Write-Host "[2/5] Dokumanlar yaziliyor..." -ForegroundColor Yellow

# -- README.md --------------------------------------------------------------
$readme = @"
# XQ Ecosystem

> Sovereign, self-custodial financial infrastructure -- open to everyone, controlled by no one.

This repository is the **central hub** for the XQ product ecosystem. It contains vision documents, cross-product roadmaps, project tracking, milestones, and ideas. No application code lives here.

---

## Products

| Product | Repository | Status |
|---|---|---|
| **XQ Wallet** | [satoshi-Qore/xq-wallet](https://github.com/satoshi-Qore/xq-wallet) | Active -- Phase 1 in progress |
| **XQAI** | [satoshi-Qore/xqai](https://github.com/satoshi-Qore/xqai) | Planning |

---

## Repository Structure

``````
xq-ecosystem/
+-- VISION.md          # Long-form vision and principles
+-- ROADMAP.md         # Cross-product roadmap
+-- PROJECTS.md        # Active projects and owners
+-- MILESTONES.md      # Versioned milestone definitions
+-- IDEAS.md           # Ideas backlog -- unvetted, exploratory
``````

---

## Contributing

All roadmap discussions, ideas, and milestone proposals happen via GitHub Issues and Discussions in this repository.
"@
Set-Content "README.md" -Value $readme -Encoding UTF8

# -- VISION.md --------------------------------------------------------------
$vision = @"
# XQ Ecosystem -- Vision

> **Status:** Approved
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

---

## 1. Mission Statement

The XQ ecosystem exists to give every person on earth access to sovereign, self-custodial financial infrastructure -- regardless of geography, institution, or permission.

We build tools that put users in control: of their keys, their data, their assets.

---

## 2. Core Principles

### 2.1 Self-Sovereignty
Users own their private keys. No XQ product, server, or team member ever has access to user funds. Non-custodial is not a feature -- it is the foundational invariant.

### 2.2 Open Source
All code is public, auditable, and forkable under a permissive open-source licence. Transparency is the only meaningful security guarantee.

### 2.3 Privacy by Default
No telemetry. No tracking. No data collection. Users are not the product.

### 2.4 QoreChain-Native
The XQ ecosystem is purpose-built for QoreChain. Generic multi-chain abstractions dilute focus and introduce attack surface. We go deep on one chain before going wide.

### 2.5 Quality Over Speed
No half-finished features ship. Every phase must meet its exit criteria before the next begins. A correct, audited v1 is worth more than a fast, broken v0.5.

### 2.6 Progressive Decentralisation
We start with a clear, maintainable architecture and move toward full decentralisation incrementally -- never trading security for decentralisation theatre.

---

## 3. Products

### XQ Wallet
A premium, open-source, non-custodial browser wallet for QoreChain. The primary product of the ecosystem. Handles key generation, signing, and transaction broadcasting entirely client-side.

**Target users:** QoreChain users who want full control of their assets.

### XQAI
An AI layer that enhances the XQ Wallet and broader QoreChain developer experience. Provides intelligent transaction insights, natural-language chain queries, and developer tooling -- without compromising user privacy.

**Target users:** QoreChain power users and developers.

---

## 4. Long-Term Vision (3-5 Years)

1. XQ Wallet is the default non-custodial wallet for the QoreChain ecosystem.
2. XQAI provides privacy-preserving AI insights across the XQ product suite.
3. A browser extension (Manifest V3) brings XQ Wallet to every browser.
4. A mobile app (iOS + Android) brings XQ Wallet to every phone.
5. The XQ ecosystem is fully community-governed via an on-chain DAO.

---

## 5. What We Will Never Do

- Store, transmit, or have access to user private keys
- Add advertising or paid promotion to any product UI
- Require account creation or KYC for basic wallet functionality
- Add multi-chain support that compromises QoreChain-native quality
- Ship a feature we have not audited
"@
Set-Content "VISION.md" -Value $vision -Encoding UTF8

# -- ROADMAP.md -------------------------------------------------------------
$roadmap = @"
# XQ Ecosystem -- Cross-Product Roadmap

> **Status:** Active
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

This document tracks the high-level roadmap across all XQ products. Detailed, phase-by-phase roadmaps live in each product's repository.

---

## XQ Wallet

| Phase | Versions | Goal | Status |
|---|---|---|---|
| Phase 0 | 0.1.0 | Foundation scaffold | Complete |
| Phase 1 | 0.2.0 -- 0.5.0 | Core wallet: create, import, balance, receive | Active |
| Phase 2 | 1.0.0 | Send flow, real QoreChain integration, mainnet launch | Planned |
| Phase 3 | 1.5.0 | Browser extension + dApp support | Planned |
| Phase 4 | 2.0.0 | Mobile app (iOS + Android) | Planned |
| Phase 5 | 3.0.0 | Advanced features: staking, tokens, NFTs | Planned |

**Full roadmap:** [xq-wallet/docs/roadmap/ROADMAP.md](https://github.com/satoshi-Qore/xq-wallet/blob/main/docs/roadmap/ROADMAP.md)

---

## XQAI

| Phase | Goal | Status |
|---|---|---|
| Phase 0 | Vision, architecture, repository setup | Complete |
| Phase 1 | Core AI engine -- privacy-preserving inference | Planned |
| Phase 2 | XQ Wallet integration -- transaction insights | Planned |
| Phase 3 | Natural-language chain queries | Planned |
| Phase 4 | Developer tooling and API | Planned |

**Full roadmap:** [xqai/ROADMAP.md](https://github.com/satoshi-Qore/xqai/blob/main/ROADMAP.md)

---

## Cross-Product Dependencies

| Dependency | Blocks |
|---|---|
| XQ Wallet Phase 2 (real chain integration) | XQAI Phase 2 (wallet integration) |
| QoreChain mainnet launch | XQ Wallet Phase 2 launch |
| XQAI Phase 1 (core engine) | XQAI Phase 2 and later |
"@
Set-Content "ROADMAP.md" -Value $roadmap -Encoding UTF8

# -- PROJECTS.md ------------------------------------------------------------
$projects = @"
# XQ Ecosystem -- Active Projects

> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

---

## Active

| Project | Repository | Phase | Owner | Notes |
|---|---|---|---|---|
| XQ Wallet Phase 1 | xq-wallet | Phase 1 | Murat | Core wallet: create, import, balance, receive |

## Planned

| Project | Repository | Target Start | Notes |
|---|---|---|---|
| XQAI Core Engine | xqai | After XQ Wallet Phase 1 | Privacy-preserving on-device inference layer |
| XQ Wallet Phase 2 | xq-wallet | After Phase 1 approval | Send flow + real QoreChain integration |

## Completed

| Project | Repository | Completed | Notes |
|---|---|---|---|
| XQ Wallet Phase 0 | xq-wallet | 2026-06-25 | Foundation scaffold -- Phase 0 exit criteria met |
| xq-ecosystem setup | xq-ecosystem | 2026-06-25 | Docs hub initialised |
| xqai setup | xqai | 2026-06-25 | Vision and architecture docs added |
"@
Set-Content "PROJECTS.md" -Value $projects -Encoding UTF8

# -- MILESTONES.md ----------------------------------------------------------
$milestones = @"
# XQ Ecosystem -- Milestones

> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

Milestones map to GitHub Milestones in each product repository. This document is the canonical source of truth for milestone definitions and exit criteria.

---

## XQ Wallet

### v0.1.0 -- Foundation (Complete)
**Completed:** 2026-06-25
**Exit criteria met:** Next.js 15 scaffold, TypeScript strict mode, Tailwind CSS v3, ESLint flat config, Prettier, Husky, architecture docs, product roadmap, ADR-0001.

### v0.2.0 -- v0.5.0 -- Core Wallet (Active)
**Target:** TBD
**Exit criteria:**
- [ ] User can create a wallet with a 24-word mnemonic
- [ ] User can import an existing wallet by mnemonic
- [ ] User can view their QoreChain address and QR code
- [ ] Balance is displayed (mock data or testnet)
- [ ] Wallet locks after idle timeout and on explicit lock
- [ ] All UI components meet WCAG 2.1 AA
- [ ] Security layer reviewed by a second engineer
- [ ] npm audit shows zero high/critical CVEs
- [ ] Engineering lead approves

### v1.0.0 -- Mainnet Launch
**Target:** After Phase 2 completion and external security audit.

---

## XQAI

### v0.1.0 -- Vision and Architecture (Complete)
**Completed:** 2026-06-25
**Exit criteria met:** Repository setup, vision document, architecture design, roadmap.
"@
Set-Content "MILESTONES.md" -Value $milestones -Encoding UTF8

# -- IDEAS.md ---------------------------------------------------------------
$ideas = @"
# XQ Ecosystem -- Ideas Backlog

> **Status:** Exploratory -- these are unvetted ideas, not commitments.
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

Ideas here have not been prioritised, scoped, or approved. They exist to capture thinking before it is lost. Any idea may be promoted to a ROADMAP.md entry, rejected, or left here indefinitely.

---

## Wallet Ideas

- **Air-gapped signing via QR code**: Sign transactions on an offline device, broadcast from an online one.
- **Shamir's Secret Sharing (SLIP-0039)**: Split the seed phrase across N trusted parties; require M to recover.
- **Multi-sig support**: Require M-of-N signatures for high-value transactions.
- **Watch-only mode**: Monitor an address without importing keys.
- **ENS-style naming for QoreChain**: Human-readable addresses (e.g., murat.qore).
- **Passkey / WebAuthn unlock**: Replace password unlock with biometric or hardware-key authentication.

## XQAI Ideas

- **Privacy-preserving transaction categorisation**: Classify transactions (payment, DeFi, NFT) without sending data to a server.
- **Natural-language send**: Parse "Send 10 XQ to murat.qore" and execute it as a transaction.
- **Anomaly detection**: Flag unusual transaction patterns for the user before signing.
- **Developer copilot for QoreChain**: AI-assisted smart contract writing and debugging.
- **On-device inference**: Run a small LLM entirely in the browser via WebGPU.

## Ecosystem Ideas

- **XQ DAO**: Community governance of the XQ ecosystem via on-chain voting.
- **Bug bounty programme**: Incentivise security researchers to find vulnerabilities.
- **Developer grants**: Fund third-party tools built on the XQ ecosystem.
- **QoreChain explorer integration**: Deep-link from XQ Wallet to a block explorer.
"@
Set-Content "IDEAS.md" -Value $ideas -Encoding UTF8

Write-Host "      Tamamlandi." -ForegroundColor Green

# 3. Git commit
Write-Host "[3/5] Commit yapiliyor..." -ForegroundColor Yellow
git add -A
$commitMsg = "docs: add ecosystem vision, roadmap, projects, milestones, and ideas`n`n" +
             "- README.md: product index and repository structure`n" +
             "- VISION.md: mission, principles (British English), long-term vision`n" +
             "- ROADMAP.md: cross-product roadmap with phase versions and deps`n" +
             "- PROJECTS.md: active, planned, and completed project tracker`n" +
             "- MILESTONES.md: versioned exit criteria aligned with xq-wallet ROADMAP`n" +
             "- IDEAS.md: exploratory ideas backlog"
git commit -m $commitMsg
Write-Host "      Tamamlandi." -ForegroundColor Green

# 4. Push
Write-Host "[4/5] GitHub'a push ediliyor..." -ForegroundColor Yellow
git push origin main
Write-Host "      Push tamamlandi!" -ForegroundColor Green

# 5. Cleanup
Write-Host "[5/5] Temp klasor temizleniyor..." -ForegroundColor Yellow
Set-Location $env:USERPROFILE
Remove-Item -Recurse -Force $WORK_DIR
Write-Host "      Temizlendi." -ForegroundColor Green

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  TAMAMLANDI!" -ForegroundColor Green
Write-Host "  Repo: https://github.com/satoshi-Qore/xq-ecosystem" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
