# update_cowork.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Daily push script — commits what Cowork wrote and deploys to Cloudflare.
#
# USAGE:
#   .\update_cowork.ps1              — commit + push (research updates, no dashboard)
#   .\update_cowork.ps1 -Dashboard   — also regenerate risk range HTML first
#
# Use -Dashboard once in the morning after you've updated Keith's levels in Excel.
# Skip it for afternoon research updates (call summary, SSS, macro show).
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Dashboard   # pass -Dashboard to regenerate risk range HTML
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir         = "C:\\repos\\hedgeye-dashboard"
$DashboardScript = "C:\Users\matth\OneDrive\Desktop\Python\Python algos\Hedgeye_riskrange_dashboard.py"
$GeneratedHtml   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Dashboards\hedgeye risk range dashboard.html"
$DestHtml        = "$RepoDir\project\risk_range_dashboard.html"
$LockFile        = "$RepoDir\.git\index.lock"

# ── Remove stale git lock if present ─────────────────────────────────────────
if (Test-Path $LockFile) {
    Write-Host "==> Removing stale git lock file..." -ForegroundColor Yellow
    Remove-Item $LockFile -Force
    Write-Host "    Done." -ForegroundColor Yellow
}

# ── Step 1 (optional): Regenerate risk range dashboard ───────────────────────
if ($Dashboard) {
    Write-Host "==> Generating Risk Range dashboard..." -ForegroundColor Cyan
    try {
        & python $DashboardScript 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Dashboard generation failed -- using existing HTML" -ForegroundColor Yellow
        } else {
            Copy-Item -Path $GeneratedHtml -Destination $DestHtml -Force
            Write-Host "==> Dashboard HTML updated" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARN] Dashboard generation skipped -- using existing HTML" -ForegroundColor Yellow
    }
} else {
    Write-Host "==> Skipping dashboard generation (use -Dashboard flag to regenerate)" -ForegroundColor DarkGray
}

# ── Step 2: Commit everything Cowork wrote + push ────────────────────────────
Write-Host "==> Committing and pushing..." -ForegroundColor Cyan
Set-Location $RepoDir

git add project/data/macro_context.json
git add project/data/official_levels.json
git add project/data/rta_latest.csv
git add project/js/he_data.js
git add project/js/he_app.jsx
git add project/js/he_prices.jsx
if ($Dashboard) { git add project/risk_range_dashboard.html }

$today = Get-Date -Format 'yyyy-MM-dd'
$time  = Get-Date -Format 'HH:mm'
git commit -m "Update $today $time (Cowork)" --allow-empty

Write-Host "==> Pushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "==> Done. Cloudflare deploying now." -ForegroundColor Green
Write-Host "    Dashboard will be live in ~60 seconds." -ForegroundColor Green
