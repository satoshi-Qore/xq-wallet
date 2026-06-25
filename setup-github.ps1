## XQ Wallet - GitHub Setup Script
## Run: cd C:\xq-wallet  then  .\setup-github.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  XQ Wallet - GitHub baglantisi kurulumu" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

## Step 1 - Remove broken .git folder
if (Test-Path ".git") {
    Write-Host "[1/7] Bozuk .git klasoru temizleniyor..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git"
    Write-Host "      Temizlendi." -ForegroundColor Green
} else {
    Write-Host "[1/7] .git bulunamadi, atlaniyor." -ForegroundColor Gray
}

## Step 2 - git init
Write-Host "[2/7] git init (main branch)..." -ForegroundColor Yellow
git init -b main
Write-Host "      Tamamlandi." -ForegroundColor Green

## Step 3 - User config
Write-Host "[3/7] Git kullanici bilgisi ayarlaniyor..." -ForegroundColor Yellow
git config user.name "Murat"
git config user.email "colakdemircimurat@gmail.com"
Write-Host "      Tamamlandi." -ForegroundColor Green

## Step 4 - Stage all files
Write-Host "[4/7] Dosyalar stage ekleniyor (git add -A)..." -ForegroundColor Yellow
git add -A
Write-Host "      Tamamlandi." -ForegroundColor Green

## Step 5 - Commit
Write-Host "[5/7] Initial commit yapiliyor..." -ForegroundColor Yellow
$msg = "chore: initial scaffold - Phase 0 foundation complete`n`n" +
       "- Next.js 15 + TypeScript strict mode + Tailwind CSS v3`n" +
       "- ESLint flat config + Prettier + Husky + lint-staged`n" +
       "- Path aliases, tsconfig strict, env variable template`n" +
       "- UI primitives: Button, Avatar, Badge, Spinner, Skeleton,`n" +
       "  Progress, Chip, Divider, IconButton`n" +
       "- Design token system (CSS variables + Tailwind + tokens.ts)`n" +
       "- Global types: Address, TxHash, PrivateKey, ChainConfig, AsyncState`n" +
       "- Utility library: cn, shortenAddress, formatTokenAmount,`n" +
       "  tryCatch, isValidAddress`n" +
       "- Centralized config (appConfig, chainConfig, apiConfig, featureFlags)`n" +
       "- Architecture docs: SYSTEM_ARCHITECTURE, SECURITY_MODEL,`n" +
       "  STATE_MANAGEMENT, COMPONENT_ARCHITECTURE,`n" +
       "  QORECHAIN_INTEGRATION_PLAN, UI_GUIDELINES`n" +
       "- Product roadmap (Phase 0-5) and ADR-0001`n`n" +
       "Phase 0 exit criteria met. Ready for Phase 1 development."
git commit -m $msg
Write-Host "      Tamamlandi." -ForegroundColor Green

## Step 6 - Add remote
Write-Host "[6/7] GitHub remote ekleniyor..." -ForegroundColor Yellow
git remote add origin https://github.com/satoshi-Qore/xq-wallet.git
Write-Host "      Remote: https://github.com/satoshi-Qore/xq-wallet.git" -ForegroundColor Green

## Step 7 - Push
Write-Host "[7/7] GitHub'a push ediliyor..." -ForegroundColor Yellow
git push -u origin main
Write-Host "      Push tamamlandi!" -ForegroundColor Green

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  TAMAMLANDI!" -ForegroundColor Green
Write-Host "  Repo: https://github.com/satoshi-Qore/xq-wallet" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
