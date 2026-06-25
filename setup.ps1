# ==============================================================================
# XQ Wallet — First-time setup script (Windows PowerShell)
# Run once after initializing the project:  .\setup.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  XQ Wallet — Project Setup" -ForegroundColor Cyan
Write-Host "  ─────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ─── 1. Git init ──────────────────────────────────────────────────────────────
if (-not (Test-Path ".git")) {
  Write-Host "[1/4] Initializing git repository..." -ForegroundColor Yellow
  git init
  git add .
  git commit -m "chore: initial project scaffold"
} else {
  Write-Host "[1/4] Git repository already exists — skipping init." -ForegroundColor DarkGray
}

# ─── 2. Install npm dependencies ──────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Installing npm dependencies..." -ForegroundColor Yellow
npm install

# ─── 3. Initialize Husky ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Initializing Husky pre-commit hooks..." -ForegroundColor Yellow
npx husky

# ─── 4. Create .env.local ─────────────────────────────────────────────────────
Write-Host ""
if (-not (Test-Path ".env.local")) {
  Write-Host "[4/4] Creating .env.local from template..." -ForegroundColor Yellow
  Copy-Item ".env.local.example" ".env.local"
  Write-Host "      -> .env.local created. Fill in real values before running." -ForegroundColor Green
} else {
  Write-Host "[4/4] .env.local already exists — skipping." -ForegroundColor DarkGray
}

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  Run 'npm run dev' to start the development server." -ForegroundColor Cyan
Write-Host ""
