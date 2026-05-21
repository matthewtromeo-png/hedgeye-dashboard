# update_levels.ps1
# Runs the import script, copies the generated dashboard HTML,
# commits both files, and pushes to GitHub.
# Run from any directory — paths are all absolute.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir         = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard"
$Script          = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\scripts\import_official_levels.py"
$GeneratedHtml   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Dashboards\hedgeye risk range dashboard.html"
$DestHtml        = "$RepoDir\project\risk_range_dashboard.html"
$DashboardScript = "C:\Users\matth\OneDrive\Desktop\Python\Python algos\Hedgeye_riskrange_dashboard.py"

Write-Host "==> Generating Risk Range dashboard..." -ForegroundColor Cyan
try {
    $result = & python $DashboardScript 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Dashboard generation failed -- using existing HTML" -ForegroundColor Yellow
    } else {
        Write-Host "==> Dashboard generated successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Dashboard generation failed -- using existing HTML" -ForegroundColor Yellow
}

Write-Host "==> Importing official levels..." -ForegroundColor Cyan
python $Script

Write-Host "==> Building macro context (Stage 1 only)..." -ForegroundColor Cyan
python "$RepoDir\scripts\build_macro_context.py" --stage1-only

Write-Host "==> Copying generated dashboard HTML..." -ForegroundColor Cyan
try {
    Copy-Item -Path $GeneratedHtml -Destination $DestHtml -Force
    Write-Host "==> Dashboard HTML copied" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not copy dashboard HTML -- using existing file" -ForegroundColor Yellow
}

Write-Host "==> Staging files..." -ForegroundColor Cyan
Set-Location $RepoDir
git add project/data/official_levels.json
git add project/data/macro_context.json
git add project/risk_range_dashboard.html

Write-Host "==> Committing..." -ForegroundColor Cyan
$today = Get-Date -Format 'yyyy-MM-dd'
git commit -m "Update levels + macro context $today"

Write-Host "==> Pushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host "==> Done. Cloudflare will deploy automatically." -ForegroundColor Green
