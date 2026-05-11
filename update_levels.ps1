# update_levels.ps1
# Runs the import script, commits the updated JSON, and pushes to GitHub.
# Run from any directory — paths are all absolute.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir  = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard"
$Script   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\scripts\import_official_levels.py"

Write-Host "==> Importing official levels..." -ForegroundColor Cyan
python $Script

Write-Host "==> Staging JSON..." -ForegroundColor Cyan
Set-Location $RepoDir
git add project/data/official_levels.json

Write-Host "==> Committing..." -ForegroundColor Cyan
$today = Get-Date -Format 'yyyy-MM-dd'
git commit -m "Update levels $today"

Write-Host "==> Pushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host "==> Done. Cloudflare will deploy automatically." -ForegroundColor Green
