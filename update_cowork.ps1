# update_cowork.ps1
# -----------------------------------------------------------------------------
# Daily push script -- commits what Cowork wrote and deploys to Cloudflare.
#
# USAGE:
#   .\update_cowork.ps1              -- commit + push (research updates, no dashboard)
#   .\update_cowork.ps1 -Dashboard   -- also regenerate risk range HTML first
#
# Use -Dashboard once in the morning after you've updated Keith's levels in Excel.
# Skip it for afternoon research updates (call summary, SSS, macro show).
#
# ARCHITECTURE:
#   Source files (OneDrive) : C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\
#   Git repo (local only)   : C:\repos\hedgeye-dashboard\
#   OneDrive must NOT contain the git repo -- it corrupts git objects and wastes storage.
#   This script copies data files from OneDrive -> repo, then commits and pushes.
# -----------------------------------------------------------------------------

param(
    [switch]$Dashboard   # pass -Dashboard to regenerate risk range HTML
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir         = "C:\repos\hedgeye-dashboard"
$SourceDataDir   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\project\data"
$DashboardScript = "C:\Users\matth\OneDrive\Desktop\Python\Python algos\Hedgeye_riskrange_dashboard.py"
$GeneratedHtml   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Dashboards\hedgeye risk range dashboard.html"
$DestHtml        = "$RepoDir\project\risk_range_dashboard.html"
$LockFile        = "$RepoDir\.git\index.lock"

# -- Find git -----------------------------------------------------------------
$GitExe = Get-Command git -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $GitExe) {
    $candidates = @(
        "C:\Program Files\Git\cmd\git.exe",
        "C:\Program Files\Git\bin\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
        "$env:APPDATA\Programs\Git\cmd\git.exe",
        "C:\Program Files (x86)\Git\cmd\git.exe",
        "$env:USERPROFILE\AppData\Local\Programs\Git\cmd\git.exe",
        "$env:USERPROFILE\scoop\shims\git.exe",
        "C:\tools\git\cmd\git.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $GitExe = $c; break }
    }
}
if (-not $GitExe) {
    Write-Host "[ERROR] git not found. Install Git for Windows or add it to your PATH." -ForegroundColor Red
    exit 1
}
Write-Host "==> Using git: $GitExe" -ForegroundColor DarkGray

# -- Sanity check: repo must exist at C:\repos\ -------------------------------
if (-not (Test-Path "$RepoDir\.git")) {
    Write-Host "[ERROR] Repo not found at $RepoDir" -ForegroundColor Red
    Write-Host "        Run: git clone https://github.com/matthewtromeo-png/hedgeye-dashboard C:\repos\hedgeye-dashboard" -ForegroundColor Yellow
    exit 1
}

# -- Remove stale git lock if present -----------------------------------------
if (Test-Path $LockFile) {
    Write-Host "==> Removing stale git lock file..." -ForegroundColor Yellow
    Remove-Item $LockFile -Force
    Write-Host "    Done." -ForegroundColor Yellow
}

# -- Step 1 (optional): Regenerate risk range dashboard -----------------------
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

# -- Step 1b: Copy data files from OneDrive source -> repo --------------------
Write-Host "==> Syncing data files from OneDrive -> repo..." -ForegroundColor Cyan

$filesToSync = @(
    "macro_context.json",
    "official_levels.json"
)
foreach ($f in $filesToSync) {
    $src  = "$SourceDataDir\$f"
    $dest = "$RepoDir\project\data\$f"
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dest -Force
        Write-Host "    Copied: $f" -ForegroundColor DarkGray
    } else {
        Write-Host "    [WARN] Not found in source: $f" -ForegroundColor Yellow
    }
}

# Auto-import new official_levels_NEW_*.json if present in Trading root
$TradingDir     = "C:\Users\matth\OneDrive\Desktop\Trading"
$NewLevelsFiles = Get-ChildItem "$TradingDir\official_levels_NEW_*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($NewLevelsFiles) {
    $newest = $NewLevelsFiles[0]
    Write-Host "==> New levels file found: $($newest.Name)" -ForegroundColor Cyan
    Copy-Item -Path $newest.FullName -Destination "$RepoDir\project\data\official_levels.json" -Force
    # Also update the OneDrive source copy so they stay in sync
    Copy-Item -Path $newest.FullName -Destination "$SourceDataDir\official_levels.json" -Force
    Write-Host "==> official_levels.json updated from $($newest.Name)" -ForegroundColor Green
} else {
    Write-Host "==> No new official_levels_NEW_*.json found -- using existing file" -ForegroundColor DarkGray
}

# -- Step 2: Commit everything and push ---------------------------------------
Write-Host "==> Committing and pushing..." -ForegroundColor Cyan
Set-Location $RepoDir

& $GitExe add project/data/macro_context.json
& $GitExe add project/data/official_levels.json
& $GitExe add project/data/rta_latest.csv
& $GitExe add project/js/he_data.js
& $GitExe add project/js/he_app.jsx
& $GitExe add project/js/he_prices.jsx
if ($Dashboard) { & $GitExe add project/risk_range_dashboard.html }

$today = Get-Date -Format 'yyyy-MM-dd'
$time  = Get-Date -Format 'HH:mm'
& $GitExe commit -m "Update $today $time (Cowork)" --allow-empty

Write-Host "==> Pushing to GitHub..." -ForegroundColor Cyan
& $GitExe push

Write-Host ""
Write-Host "==> Done. Cloudflare deploying now." -ForegroundColor Green
Write-Host "    Dashboard will be live in ~60 seconds." -ForegroundColor Green
