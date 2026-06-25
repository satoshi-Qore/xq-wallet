# ============================================================
# XQAI — GitHub Docs Setup Script
# Çalıştır: cd C:\xq-wallet  sonra  .\setup-xqai.ps1
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO_URL = "https://github.com/satoshi-Qore/xqai.git"
$WORK_DIR = "$env:TEMP\xqai-setup"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  XQAI — Docs push" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Clone
if (Test-Path $WORK_DIR) { Remove-Item -Recurse -Force $WORK_DIR }
Write-Host "[1/5] Klonlaniyor: $REPO_URL" -ForegroundColor Yellow
git clone $REPO_URL $WORK_DIR
Set-Location $WORK_DIR
git config user.name "Murat"
git config user.email "colakdemircimurat@gmail.com"
New-Item -ItemType Directory -Force -Path "docs/architecture" | Out-Null
Write-Host "      Tamamlandi." -ForegroundColor Green

# 2. Dosyaları yaz
Write-Host "[2/5] Dokumanlar yaziliyor..." -ForegroundColor Yellow

# README.md
@"
# XQAI

> **An AI layer for the XQ ecosystem — privacy-first, on-device, open-source.**

XQAI enhances the XQ Wallet and QoreChain developer experience with intelligent, privacy-preserving AI capabilities. All inference runs client-side; no user data ever leaves the browser.

**Status:** Planning — no application code yet.

---

## What XQAI Is

XQAI is not a chatbot. It is an AI infrastructure layer that integrates directly into XQ products to provide:

- **Transaction intelligence** — classify, explain, and flag unusual transactions
- **Natural-language interaction** — "Send 10 XQ to murat.qore"
- **Developer tooling** — AI-assisted QoreChain smart contract support
- **Anomaly detection** — surface unusual on-chain patterns to the user

---

## Privacy Guarantee

> XQAI processes data exclusively on the user's device. No transaction data, wallet address, or user query is ever sent to an external AI service.

This is enforced by architecture, not policy:
- All inference runs via WebGPU / WebAssembly in the browser
- No API calls to OpenAI, Anthropic, or any third-party AI service
- The AI model is bundled with the application and loaded locally

---

## Repository Structure

``````
xqai/
├── README.md
├── VISION.md
├── ROADMAP.md
└── docs/
    └── architecture/
        └── ARCHITECTURE.md
``````

---

## Related Repositories

| Repository | Description |
|---|---|
| [xq-wallet](https://github.com/satoshi-Qore/xq-wallet) | Primary wallet — XQAI integrates here in Phase 2 |
| [xq-ecosystem](https://github.com/satoshi-Qore/xq-ecosystem) | Ecosystem vision and cross-product roadmap |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full phase-by-phase plan.

| Phase | Goal | Status |
|---|---|---|
| 0 | Vision, architecture, repository setup | ✅ Complete |
| 1 | Core AI engine — privacy-preserving inference | 📋 Planned |
| 2 | XQ Wallet integration | 📋 Planned |
| 3 | Natural-language chain queries | 📋 Planned |
| 4 | Developer tooling and public API | 📋 Planned |
"@ | Set-Content "README.md" -Encoding UTF8

# VISION.md
@"
# XQAI — Vision

> **Status:** Approved
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

---

## 1. Problem Statement

Blockchain interactions are opaque and risky for most users. Reading a raw transaction — amounts in 18-decimal wei, hexadecimal addresses, cryptic contract calls — requires technical expertise most people don't have. Mistakes are irreversible.

AI can bridge this gap. But existing AI integrations in crypto products share a fatal flaw: they send user data — wallet addresses, transaction history, natural-language queries — to centralised AI APIs. This destroys the privacy guarantee that makes non-custodial wallets meaningful.

XQAI solves this by running AI inference entirely on the user's device.

---

## 2. Vision Statement

**XQAI makes blockchain interactions as intuitive and safe as possible — without ever compromising user privacy.**

A user should be able to:
- Understand what a transaction does before signing it
- Send funds by typing a human-readable instruction
- Be warned when something looks wrong
- Get developer help for QoreChain without pasting their code into a third-party service

All of this should work offline. All of this should be free. None of it should require trust.

---

## 3. Design Principles

### 3.1 Privacy by Architecture
Privacy cannot be a checkbox. It must be enforced by the system's architecture, not by policy or terms of service. XQAI processes all data client-side. There is no backend AI service.

### 3.2 On-Device First
Every XQAI feature must be implementable on-device. Features that require a server-side AI call are not XQAI features — they are a different product.

### 3.3 Open Weights
The AI models used by XQAI must be open-weight models that can be bundled with the application and audited. No black-box proprietary models in the privacy-sensitive path.

### 3.4 Minimal Footprint
The AI model must be small enough to load in a browser without degrading UX. Target: under 500MB download for the full model. Quantised inference preferred.

### 3.5 Graceful Degradation
XQAI features are enhancements, not dependencies. XQ Wallet must function fully without XQAI. AI features load progressively and fail silently if inference is unavailable.

### 3.6 Explainability
XQAI must show its reasoning. When it flags a transaction or interprets an instruction, it must show the user why — in plain language.

---

## 4. What XQAI Will Never Do

- Send user wallet addresses, transaction data, or queries to any external API
- Replace or override the user's explicit transaction confirmation
- Make irreversible decisions autonomously
- Require a subscription or API key to access core features
- Use a proprietary closed-weight model that cannot be audited
"@ | Set-Content "VISION.md" -Encoding UTF8

# ROADMAP.md
@"
# XQAI — Roadmap

> **Status:** Active
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

---

## Phase 0 — Foundation ✅ Complete

**Goal:** Vision, architecture, and repository established.

| Item | Status |
|---|---|
| Repository created | ✅ |
| VISION.md | ✅ |
| ARCHITECTURE.md | ✅ |
| ROADMAP.md | ✅ |

---

## Phase 1 — Core AI Engine

**Goal:** A working on-device inference engine that can classify and explain QoreChain transactions.

**Blocked by:** XQ Wallet Phase 1 completion (need a functioning wallet to integrate with).

| Item | Priority | Notes |
|---|---|---|
| Model selection — open-weight, <500MB | P0 | Candidates: Phi-3 Mini, Gemma 2B, Llama 3.2 1B |
| WebGPU inference runtime | P0 | Transformers.js or ONNX Runtime Web |
| Transaction classification module | P0 | Classify: transfer, swap, contract call, unknown |
| Transaction explanation module | P0 | Plain-language explanation of what a tx does |
| Model loading + caching (IndexedDB) | P0 | Load once, cache locally |
| Offline support | P0 | Full functionality without network |
| Performance benchmark | P1 | Target: <2s inference on mid-range hardware |

**Phase 1 exit criteria:**
- [ ] Given a raw QoreChain transaction, XQAI classifies and explains it in plain language
- [ ] Inference runs entirely in-browser via WebGPU
- [ ] Model loads from cache after first download
- [ ] Zero external network calls during inference
- [ ] Engineering lead approves

---

## Phase 2 — XQ Wallet Integration

**Goal:** XQAI features are available inside XQ Wallet.

**Blocked by:** Phase 1 complete + XQ Wallet Phase 2 (real QoreChain integration).

| Item | Priority |
|---|---|
| Transaction insight panel in send confirmation | P0 |
| Warning system for suspicious transactions | P0 |
| Natural-language send input (parse intent) | P1 |
| XQAI settings panel in XQ Wallet | P1 |
| Model download opt-in flow (first run) | P0 |

---

## Phase 3 — Natural-Language Chain Queries

**Goal:** Users can ask questions about the QoreChain network in plain language.

| Item | Priority |
|---|---|
| QoreChain RPC data retrieval for LLM context | P0 |
| RAG pipeline over QoreChain state | P0 |
| "What is my balance?" query handling | P0 |
| "Show my recent transactions" query handling | P0 |
| QoreChain documentation retrieval | P1 |

---

## Phase 4 — Developer Tooling and Public API

**Goal:** XQAI as a tool for QoreChain developers.

| Item | Priority |
|---|---|
| Smart contract explanation (given ABI) | P0 |
| Code completion for QoreChain SDK | P1 |
| Public XQAI JavaScript API | P1 |
| Developer documentation | P0 |
"@ | Set-Content "ROADMAP.md" -Encoding UTF8

# docs/architecture/ARCHITECTURE.md
@"
# XQAI — Architecture

> **Status:** Proposed
> **Last updated:** $(Get-Date -Format 'yyyy-MM-dd')

---

## 1. Architecture Principles

XQAI's architecture is derived directly from its privacy invariant: **all inference happens on the user's device.** Every architectural decision is constrained by this.

---

## 2. High-Level Architecture

``````
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    XQ Wallet UI                       │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │              XQAI Integration Layer            │   │   │
│  │  │                                               │   │   │
│  │  │  useTransactionInsight()                      │   │   │
│  │  │  useNaturalLanguageSend()                     │   │   │
│  │  │  useAnomalyDetection()                        │   │   │
│  │  └───────────────────┬───────────────────────────┘   │   │
│  └──────────────────────┼────────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │                  XQAI Core Engine                      │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │  Inference  │  │    Context   │  │   Prompt    │  │   │
│  │  │  Runtime    │  │   Builder    │  │  Templates  │  │   │
│  │  │  (WebGPU /  │  │  (tx data,  │  │             │  │   │
│  │  │  WASM)      │  │  chain state)│  │             │  │   │
│  │  └──────┬──────┘  └──────────────┘  └─────────────┘  │   │
│  │         │                                             │   │
│  │  ┌──────▼──────────────────────────────────────────┐  │   │
│  │  │              Model Cache (IndexedDB)             │  │   │
│  │  │         Open-weight model, quantised             │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
``````

---

## 3. Components

### 3.1 Inference Runtime
Runs the language model in-browser using **WebGPU** (primary) with **ONNX Runtime Web / WASM** as fallback for devices without WebGPU support.

**Candidate runtimes:** Transformers.js, ONNX Runtime Web

### 3.2 Model
An open-weight, quantised language model small enough to run in a browser.

**Candidate models (evaluated at Phase 1):**

| Model | Size (Q4) | Context | Notes |
|---|---|---|---|
| Phi-3 Mini | ~2GB | 4k | Strong reasoning; may be too large |
| Gemma 2B | ~1.5GB | 8k | Good instruction following |
| Llama 3.2 1B | ~0.8GB | 8k | Smallest; may lack reasoning depth |
| SmolLM2 1.7B | ~1GB | 8k | Designed for on-device use |

Final model selection happens at Phase 1 based on benchmarks.

### 3.3 Model Cache
The model is downloaded once and stored in **IndexedDB** (same as XQ Wallet's vault store, but a separate database). On subsequent loads, the model is served from cache — no network request.

### 3.4 Context Builder
Constructs the prompt context for each inference call. Pulls relevant data from:
- The current transaction (amount, recipient, contract ABI if available)
- QoreChain chain state (current block, gas price)
- User's recent transaction history (local only, never sent to network)

### 3.5 Prompt Templates
Structured prompt templates for each XQAI capability (transaction explanation, anomaly detection, natural-language send). Templates are versioned and bundled with the application.

### 3.6 Integration Layer (React Hooks)
XQAI exposes its capabilities to XQ Wallet via a set of React hooks:

- `useTransactionInsight(tx)` — returns a classification and plain-language explanation
- `useNaturalLanguageSend(input)` — parses a text instruction into a transaction intent
- `useAnomalyDetection(tx, history)` — returns a risk score and warning message

---

## 4. Privacy Architecture

| Data type | Stays on device | Leaves device | Notes |
|---|---|---|---|
| Wallet address | ✅ | ❌ | Never sent anywhere |
| Transaction data | ✅ | ❌ | Used as LLM context locally |
| Natural-language queries | ✅ | ❌ | Processed by local model |
| AI model weights | ✅ | ❌ | Downloaded once, cached in IndexedDB |
| Model outputs | ✅ | ❌ | Displayed to user only |

---

## 5. Performance Targets

| Metric | Target |
|---|---|
| First inference (after model load) | < 2 seconds |
| Subsequent inference | < 1 second |
| Model download size | < 2 GB |
| Model load from cache | < 500 ms |
| Memory footprint during inference | < 2 GB RAM |

---

## 6. Graceful Degradation

XQAI is an enhancement, not a dependency. XQ Wallet must function fully when:
- The model has not been downloaded yet
- WebGPU is not available
- The device has insufficient RAM
- XQAI inference times out

In all these cases, XQAI features are hidden or show a "not available" state. Core wallet functionality (send, receive, balance) is unaffected.
"@ | Set-Content "docs/architecture/ARCHITECTURE.md" -Encoding UTF8

Write-Host "      Tamamlandi." -ForegroundColor Green

# 3. Git commit
Write-Host "[3/5] Commit yapiliyor..." -ForegroundColor Yellow
git add -A
git commit -m "docs: add XQAI vision, roadmap, and architecture

- README.md: professional product overview with privacy guarantee
- VISION.md: problem statement, design principles, what XQAI won't do
- ROADMAP.md: Phase 0-4 plan with exit criteria
- docs/architecture/ARCHITECTURE.md: system design, components,
  model candidates, privacy architecture, performance targets,
  graceful degradation strategy"
Write-Host "      Tamamlandi." -ForegroundColor Green

# 4. Push
Write-Host "[4/5] GitHub'a push ediliyor..." -ForegroundColor Yellow
git push origin main
Write-Host "      Push tamamlandi!" -ForegroundColor Green

# 5. Temizlik
Write-Host "[5/5] Temp klasor temizleniyor..." -ForegroundColor Yellow
Set-Location $env:USERPROFILE
Remove-Item -Recurse -Force $WORK_DIR
Write-Host "      Temizlendi." -ForegroundColor Green

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  TAMAMLANDI!" -ForegroundColor Green
Write-Host "  Repo: https://github.com/satoshi-Qore/xqai" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
