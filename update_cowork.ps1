# update_cowork.ps1
# -----------------------------------------------------------------------------
# Hedgeye Dashboard deploy controller.
#
# !! ALWAYS RUN FROM THE REPO, NOT FROM ONEDRIVE !!
#
#   cd C:\repos\hedgeye-dashboard
#   .\update_cowork.ps1 [flags]
#
# Running from OneDrive risks executing a stale copy of this script that does
# not have the latest changes. The repo copy is kept in sync by Block 3 of
# this script (self-sync), but the source of truth for EXECUTION is C:\repos.
#
# USAGE:
#   .\update_cowork.ps1                      -- validate + sync + commit/push
#   .\update_cowork.ps1 -Research            -- run research parsers (R1-R6) + deploy
#   .\update_cowork.ps1 -Dashboard           -- regenerate Risk Range + deploy
#   .\update_cowork.ps1 -Research -Dashboard -- full refresh
#   .\update_cowork.ps1 -Research -NoPush    -- dry run: parsers + validation only
#
# -NoPush skips ALL git operations: no add, no commit, no push.
#
# ARCHITECTURE:
#   Execution root          : C:\repos\hedgeye-dashboard\                  (run from here)
#   Source/edit mirror      : C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\
#   Deploy output paths     : C:\repos\hedgeye-dashboard\project\data\
#                             C:\repos\hedgeye-dashboard\project\assets\
#                             C:\repos\hedgeye-dashboard\project\risk_range_dashboard.html
#
#   Rule: ALL generated output goes to C:\repos. Scripts must use hardcoded
#   C:\repos paths, never __file__-relative paths (those write to wherever
#   the script lives, which may be OneDrive).
#
#   Exception: build_macro_context.py (R1) writes to its own folder (OneDrive)
#   first, then this script explicitly copies macro_context.json into the repo
#   before R2-R4 run. That explicit copy is the contract -- see R1 block.
#
#   Validation reads ONLY from C:\repos -- that is what gets committed/deployed.
#   OneDrive must NOT contain the git repo -- it corrupts git objects.
# -----------------------------------------------------------------------------

param(
    [switch]$Research,
    [switch]$Dashboard,
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$RepoDir         = "C:\repos\hedgeye-dashboard"
$RepoDataDir     = "$RepoDir\project\data"
$BackupDir       = "$RepoDataDir\backups"
$SourceDataDir   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\project\data"
$ScriptsDir      = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\scripts"
$DashboardScript = "C:\Users\matth\OneDrive\Desktop\Python\Python algos\Hedgeye_riskrange_dashboard.py"
$GeneratedHtml   = "C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Dashboards\hedgeye risk range dashboard.html"
$DestHtml        = "$RepoDir\project\risk_range_dashboard.html"
$LockFile        = "$RepoDir\.git\index.lock"
$ValidateScript  = "$ScriptsDir\validate_pipeline.py"

# ==============================================================================
# HELPER: Run a Python script and capture full stdout + stderr.
# Returns the exit code. Prints all output after the process finishes.
# Pass -Fatal to abort the whole script on nonzero exit.
# Pass -FilterFontBBox to suppress noisy PDF font warnings.
# ==============================================================================
function Run-PythonScript {
    param(
        [string]$ScriptPath,
        [string]$Label,
        [switch]$Fatal,
        [switch]$FilterFontBBox
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = 'python'
    $psi.Arguments              = "`"$ScriptPath`""
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false
    $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $psi.CreateNoWindow         = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $proc.Start() | Out-Null

    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    # Print stdout
    if ($stdout) {
        $stdoutLines = $stdout -split "`r`n|`n"
        foreach ($line in $stdoutLines) {
            if ($FilterFontBBox -and $line -match 'FontBBox') { continue }
            if ($line.Trim() -ne '') { Write-Host $line }
        }
    }

    # Print stderr (always -- this is where Python tracebacks go)
    if ($stderr) {
        $stderrLines = $stderr -split "`r`n|`n"
        foreach ($line in $stderrLines) {
            if ($FilterFontBBox -and $line -match 'FontBBox') { continue }
            if ($line.Trim() -ne '') { Write-Host $line -ForegroundColor Yellow }
        }
    }

    if ($exitCode -ne 0) {
        Write-Host "  [FAILED] $Label exited with code $exitCode" -ForegroundColor Red
        if ($Fatal) {
            Write-Host "  Aborting." -ForegroundColor Red
            exit 1
        }
    }

    return $exitCode
}

# ==============================================================================
# HELPER: Timestamped backup of a file
# ==============================================================================
function Backup-File {
    param([string]$FilePath, [string]$Label)
    if (Test-Path $FilePath) {
        $ts   = Get-Date -Format 'yyyyMMdd_HHmmss'
        $name = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
        $ext  = [System.IO.Path]::GetExtension($FilePath)
        $dest = "$BackupDir\${name}_${ts}${ext}"
        Copy-Item -Path $FilePath -Destination $dest -Force
        Write-Host "    Backed up $Label -> backups\${name}_${ts}${ext}" -ForegroundColor DarkGray
        return $dest
    }
    return $null
}

# -- Find git ------------------------------------------------------------------
$GitExe = Get-Command git -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $GitExe) {
    $candidates = @(
        'C:\Program Files\Git\cmd\git.exe',
        'C:\Program Files\Git\bin\git.exe',
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
        "$env:APPDATA\Programs\Git\cmd\git.exe",
        'C:\Program Files (x86)\Git\cmd\git.exe',
        "$env:USERPROFILE\AppData\Local\Programs\Git\cmd\git.exe",
        "$env:USERPROFILE\scoop\shims\git.exe",
        'C:\tools\git\cmd\git.exe'
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $GitExe = $c; break }
    }
}
if (-not $GitExe) {
    Write-Host '[ERROR] git not found. Install Git for Windows or add it to your PATH.' -ForegroundColor Red
    exit 1
}
Write-Host "==> Using git: $GitExe" -ForegroundColor DarkGray

# -- Sanity check: repo must exist --------------------------------------------
if (-not (Test-Path "$RepoDir\.git")) {
    Write-Host "[ERROR] Repo not found at $RepoDir" -ForegroundColor Red
    exit 1
}

# -- Remove stale git lock ----------------------------------------------------
if (Test-Path $LockFile) {
    Write-Host '==> Removing stale git lock file...' -ForegroundColor Yellow
    Remove-Item $LockFile -Force
}

# -- Ensure backup directory exists -------------------------------------------
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# ==============================================================================
# BLOCK 1: RESEARCH PARSERS -- only when -Research is passed
# ==============================================================================
if ($Research) {
    Write-Host ''
    Write-Host '==> [RESEARCH] Running research pipeline...' -ForegroundColor Cyan

    Backup-File "$RepoDataDir\macro_context.json" 'macro_context.json'

    # R1: build_macro_context.py -- full rewrite, must run first
    $BuildScript = "$ScriptsDir\build_macro_context.py"
    if (Test-Path $BuildScript) {
        Write-Host '==> [R1] build_macro_context.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $BuildScript -Label 'build_macro_context.py' -Fatal -FilterFontBBox
        if ($rc -eq 0) {
            Write-Host '    macro_context.json rebuilt from research folders' -ForegroundColor DarkGray
            # Sync the freshly generated macro_context.json into the repo immediately.
            # build_macro_context.py writes to OneDrive (its __file__ parent); R2-R4 and
            # validation all read the repo copy -- must copy before they run.
            $mcjSrc  = "$SourceDataDir\macro_context.json"
            $mcjDest = "$RepoDataDir\macro_context.json"
            if (Test-Path $mcjSrc) {
                Copy-Item -Path $mcjSrc -Destination $mcjDest -Force
                Write-Host '    macro_context.json synced OneDrive -> repo' -ForegroundColor DarkGray
            } else {
                Write-Host "  [ERROR] macro_context.json not found at $mcjSrc -- aborting" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "  [WARN] build_macro_context.py not found at $BuildScript" -ForegroundColor Yellow
    }

    # R2: process_sss.py -- patches SSS section
    $SssScript = "$ScriptsDir\process_sss.py"
    if (Test-Path $SssScript) {
        Write-Host '==> [R2] process_sss.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $SssScript -Label 'process_sss.py' -FilterFontBBox
        if ($rc -eq 0) { Write-Host '    SSS section updated' -ForegroundColor DarkGray }
    } else {
        Write-Host '  [WARN] process_sss.py not found' -ForegroundColor Yellow
    }

    # R3: process_ham.py -- patches HAM section
    $HamScript = "$ScriptsDir\process_ham.py"
    if (Test-Path $HamScript) {
        Write-Host '==> [R3] process_ham.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $HamScript -Label 'process_ham.py'
        if ($rc -eq 0) { Write-Host '    HAM section updated' -ForegroundColor DarkGray }
    } else {
        Write-Host '  [WARN] process_ham.py not found' -ForegroundColor Yellow
    }

    # R4: parse_position_sizing.py -- patches position_sizing section
    $SizingScript = "$ScriptsDir\parse_position_sizing.py"
    if (Test-Path $SizingScript) {
        Write-Host '==> [R4] parse_position_sizing.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $SizingScript -Label 'parse_position_sizing.py' -Fatal -FilterFontBBox
        if ($rc -eq 0) { Write-Host '    position_sizing section updated' -ForegroundColor DarkGray }
    } else {
        Write-Host '  [WARN] parse_position_sizing.py not found' -ForegroundColor Yellow
    }

    # R5: Copy newest RTA CSV
    Write-Host '==> [R5] Updating rta_latest.csv...' -ForegroundColor Cyan
    $RtaGlob   = 'C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\RTA\real-time-alerts-history-*.csv'
    $newestRta = Get-ChildItem $RtaGlob -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
    if ($newestRta) {
        Copy-Item $newestRta.FullName "$RepoDataDir\rta_latest.csv" -Force
        Write-Host "    rta_latest.csv <- $($newestRta.Name)" -ForegroundColor DarkGray
    } else {
        Write-Host "  [WARN] No RTA CSV found at $RtaGlob" -ForegroundColor Yellow
    }

    # R6: extract_macro_show_charts.py -- extract chart images from newest Macro Show PDF
    $ChartScript = "$ScriptsDir\extract_macro_show_charts.py"
    if (Test-Path $ChartScript) {
        Write-Host '==> [R6] extract_macro_show_charts.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $ChartScript -Label 'extract_macro_show_charts.py' -FilterFontBBox
        if ($rc -eq 0) { Write-Host '    Macro Show chart images extracted' -ForegroundColor DarkGray }
        else           { Write-Host '  [WARN] Chart extraction failed -- charts will show Unavailable' -ForegroundColor Yellow }
    } else {
        Write-Host '  [WARN] extract_macro_show_charts.py not found' -ForegroundColor Yellow
    }

    Write-Host '==> [RESEARCH] Pipeline complete.' -ForegroundColor Green
}

# ==============================================================================
# BLOCK 2: DASHBOARD (Risk Range) -- only when -Dashboard is passed
# ==============================================================================
if ($Dashboard) {
    Write-Host ''
    Write-Host '==> [DASHBOARD] Regenerating Risk Range from Excel...' -ForegroundColor Cyan

    Backup-File $DestHtml 'risk_range_dashboard.html'
    Backup-File "$RepoDataDir\official_levels.json" 'official_levels.json'

    # D1: Hedgeye_riskrange_dashboard.py -> HTML
    if (Test-Path $DashboardScript) {
        Write-Host '==> [D1] Hedgeye_riskrange_dashboard.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $DashboardScript -Label 'Hedgeye_riskrange_dashboard.py'
        if ($rc -eq 0) {
            if (Test-Path $GeneratedHtml) {
                Copy-Item -Path $GeneratedHtml -Destination $DestHtml -Force
                Write-Host '    risk_range_dashboard.html updated' -ForegroundColor DarkGray
            } else {
                Write-Host "  [WARN] Generated HTML not found at $GeneratedHtml" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  [WARN] Dashboard script not found at $DashboardScript" -ForegroundColor Yellow
    }

    # D2: import_official_levels.py -> official_levels.json
    # NOTE: The script writes to OneDrive (its own folder). We sync to repo immediately
    # after success so D3 and validation read the fresh file, not a stale repo copy.
    $ImportLevelsScript = "$ScriptsDir\import_official_levels.py"
    $OlOneDrivePath     = "$SourceDataDir\official_levels.json"
    if (Test-Path $ImportLevelsScript) {
        Write-Host '==> [D2] import_official_levels.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $ImportLevelsScript -Label 'import_official_levels.py'
        if ($rc -eq 0) {
            Write-Host '    official_levels.json updated from Excel' -ForegroundColor DarkGray
            # Sync OneDrive output -> repo immediately (before D3 and validation)
            if (Test-Path $OlOneDrivePath) {
                Copy-Item -Path $OlOneDrivePath -Destination "$RepoDataDir\official_levels.json" -Force
                Write-Host '    official_levels.json synced OneDrive -> repo after D2' -ForegroundColor DarkGray
            } else {
                Write-Host "  [ERROR] official_levels.json not found at $OlOneDrivePath after D2 -- aborting" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "  [WARN] import_official_levels.py not found at $ImportLevelsScript" -ForegroundColor Yellow
    }

    # D3: parse_rr_history.py -> injects RR_HISTORY into risk_range_dashboard.html
    $RrHistScript = "$ScriptsDir\parse_rr_history.py"
    if (Test-Path $RrHistScript) {
        Write-Host '==> [D3] parse_rr_history.py...' -ForegroundColor Cyan
        $rc = Run-PythonScript -ScriptPath $RrHistScript -Label 'parse_rr_history.py'
        if ($rc -eq 0) { Write-Host '    RR_HISTORY injected into risk_range_dashboard.html' -ForegroundColor DarkGray }
    } else {
        Write-Host '  [WARN] parse_rr_history.py not found' -ForegroundColor Yellow
    }

    Write-Host '==> [DASHBOARD] Complete.' -ForegroundColor Green
}

# ==============================================================================
# BLOCK 3: SYNC JS/JSX files from OneDrive -> repo
# ==============================================================================
Write-Host ''
Write-Host '==> Syncing JS/JSX project files...' -ForegroundColor Cyan
$SourceJsDir = 'C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\project'
$RepoJsDir   = "$RepoDir\project"

$jsFiles = @(
    'js\he_shared.jsx',
    'js\he_app.jsx',
    'js\he_signals.jsx',
    'js\he_etfpro.jsx',
    'js\he_ham.jsx',
    'js\he_rta.jsx',
    'js\he_prices.jsx',
    'js\he_research_status.jsx',
    'js\he_pos.jsx',
    'js\he_data.js',
    'index.html'
)
foreach ($f in $jsFiles) {
    $src  = "$SourceJsDir\$f"
    $dest = "$RepoJsDir\$f"
    if (Test-Path $src) {
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item -Path $src -Destination $dest -Force
        Write-Host "    Copied: $f" -ForegroundColor DarkGray
    } else {
        Write-Host "    [WARN] Not found: $f" -ForegroundColor Yellow
    }
}

# Chart assets: extract_macro_show_charts.py (R6) writes directly to C:\repos.
# Just ensure the directory exists and report what's present.
$RepoAssetsDir = "$RepoJsDir\assets\generated"
if (-not (Test-Path $RepoAssetsDir)) {
    New-Item -ItemType Directory -Path $RepoAssetsDir -Force | Out-Null
}
$chartPngs = Get-ChildItem "$RepoAssetsDir\*.png" -ErrorAction SilentlyContinue
if ($chartPngs) {
    foreach ($cp in $chartPngs) {
        Write-Host "    Chart asset present: assets/generated/$($cp.Name)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "    (no chart assets yet -- R6 will create them on -Research run)" -ForegroundColor DarkGray
}
# chart_manifest.json also goes directly to C:\repos\project\data via R6 -- no copy needed.

# Sync update_cowork.ps1 itself -- keeps repo copy in sync with OneDrive source
$selfSrc = 'C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\update_cowork.ps1'
if (Test-Path $selfSrc) {
    Copy-Item -Path $selfSrc -Destination "$RepoDir\update_cowork.ps1" -Force
    Write-Host '    Copied: update_cowork.ps1' -ForegroundColor DarkGray
}

# Sync pipeline scripts to repo
$destScripts = "$RepoDir\scripts"
if (-not (Test-Path $destScripts)) { New-Item -ItemType Directory -Path $destScripts | Out-Null }
foreach ($script in @('build_macro_context.py', 'parse_position_sizing.py', 'process_ham.py', 'process_sss.py', 'validate_pipeline.py', 'extract_macro_show_charts.py', 'parse_rr_history.py', 'import_official_levels.py')) {
    if (Test-Path "$ScriptsDir\$script") {
        Copy-Item -Path "$ScriptsDir\$script" -Destination "$destScripts\$script" -Force
        Write-Host "    Copied: scripts\$script" -ForegroundColor DarkGray
    }
}

# ==============================================================================
# BLOCK 4: Sync data files
# ==============================================================================
Write-Host ''
Write-Host '==> Syncing data files...' -ForegroundColor Cyan

$hamCsv = "$SourceDataDir\ham_holdings_latest.csv"
if (Test-Path $hamCsv) {
    Copy-Item -Path $hamCsv -Destination "$RepoDataDir\ham_holdings_latest.csv" -Force
    Write-Host '    Copied: ham_holdings_latest.csv' -ForegroundColor DarkGray
}

# official_levels_NEW_*.json: legacy manual-export fallback.
# When -Dashboard is set, import_official_levels.py (D2) has already written a
# fresh official_levels.json from the current Excel workbook -- do NOT override it.
# When -Dashboard is NOT set, apply the NEW file only if it is strictly newer
# than the current repo copy (prevents stale exports from silently replacing good data).
if ($Dashboard) {
    Write-Host '    official_levels.json: generated by D2 (import_official_levels.py) -- NEW file fallback skipped' -ForegroundColor DarkGray
} else {
    $TradingDir     = 'C:\Users\matth\OneDrive\Desktop\Trading'
    $NewLevelsFiles = Get-ChildItem "$TradingDir\official_levels_NEW_*.json" -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending
    $olRepoPath     = "$RepoDataDir\official_levels.json"
    if ($NewLevelsFiles) {
        $newest = $NewLevelsFiles[0]
        $repoExists = Test-Path $olRepoPath
        $newerThanRepo = (-not $repoExists) -or ($newest.LastWriteTime -gt (Get-Item $olRepoPath).LastWriteTime)
        if ($newerThanRepo) {
            Write-Host "==> New levels file found and is newer: $($newest.Name)" -ForegroundColor Cyan
            Copy-Item -Path $newest.FullName -Destination $olRepoPath -Force
            Copy-Item -Path $newest.FullName -Destination "$SourceDataDir\official_levels.json" -Force
            Write-Host "    official_levels.json updated from $($newest.Name)" -ForegroundColor DarkGray
        } else {
            Write-Host "    official_levels_NEW file ($($newest.Name)) is not newer than repo copy -- skipping" -ForegroundColor DarkGray
        }
    } else {
        $olSrc = "$SourceDataDir\official_levels.json"
        if ((Test-Path $olSrc) -and (-not (Test-Path $olRepoPath))) {
            Copy-Item -Path $olSrc -Destination $olRepoPath -Force
            Write-Host '    Copied: official_levels.json (repo was missing)' -ForegroundColor DarkGray
        }
    }
}

# ==============================================================================
# BLOCK 5: Write version.json
# ==============================================================================
Write-Host ''
Write-Host '==> Writing version.json...' -ForegroundColor Cyan
$versionTs   = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
$versionDate = (Get-Date).ToString('yyyy-MM-dd')
$versionJson = "{`"deployed_at`":`"$versionTs`",`"date`":`"$versionDate`"}"
Set-Content -Path "$RepoDataDir\version.json" -Value $versionJson -Encoding ASCII
Set-Content -Path "$SourceDataDir\version.json" -Value $versionJson -Encoding ASCII
Write-Host "    version.json -> $versionTs" -ForegroundColor DarkGray

# ==============================================================================
# BLOCK 6: VALIDATION -- always runs; Tier 2 added when -Research or -Dashboard
# ==============================================================================
Write-Host ''
Write-Host '==> Running validation...' -ForegroundColor Cyan

if (Test-Path $ValidateScript) {
    $validateArgs = ''
    if ($Research)  { $validateArgs += ' --research' }
    if ($Dashboard) { $validateArgs += ' --dashboard' }
    $validateArgs = $validateArgs.Trim()

    $psi2 = New-Object System.Diagnostics.ProcessStartInfo
    $psi2.FileName               = 'python'
    $psi2.Arguments              = "`"$ValidateScript`" $validateArgs"
    $psi2.RedirectStandardOutput = $true
    $psi2.RedirectStandardError  = $true
    $psi2.UseShellExecute        = $false
    $psi2.CreateNoWindow         = $true
    $psi2.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $vProc = New-Object System.Diagnostics.Process
    $vProc.StartInfo = $psi2
    $vProc.Start() | Out-Null
    $vStdout = $vProc.StandardOutput.ReadToEnd()
    $vStderr = $vProc.StandardError.ReadToEnd()
    $vProc.WaitForExit()
    $vExit = $vProc.ExitCode

    if ($vStdout) { $vStdout -split "`r`n|`n" | Where-Object { $_.Trim() -ne '' } | ForEach-Object { Write-Host $_ } }
    if ($vStderr) { $vStderr -split "`r`n|`n" | Where-Object { $_.Trim() -ne '' } | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }

    if ($vExit -ne 0) {
        Write-Host ''
        Write-Host '[DEPLOY ABORTED] Validation failed. Repo not committed.' -ForegroundColor Red
        Write-Host "                 Backups are in: $BackupDir" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  [WARN] validate_pipeline.py not found at $ValidateScript -- running basic JSON check" -ForegroundColor Yellow
    $MacroCtxRepo = "$RepoDataDir\macro_context.json"
    if (Test-Path $MacroCtxRepo) {
        $jsonRaw  = Get-Content $MacroCtxRepo -Raw -Encoding UTF8
        $jsonObj  = $jsonRaw | ConvertFrom-Json
        $keyCount = ($jsonObj.PSObject.Properties | Measure-Object).Count
        $fileSize = (Get-Item $MacroCtxRepo).Length
        if ($keyCount -lt 15) {
            Write-Host "  [ABORT] macro_context.json has only $keyCount keys -- likely truncated!" -ForegroundColor Red
            exit 1
        }
        if ($fileSize -lt 100000) {
            Write-Host "  [ABORT] macro_context.json is only $fileSize bytes -- suspiciously small!" -ForegroundColor Red
            exit 1
        }
        Write-Host "  JSON check OK: $keyCount keys, $([math]::Round($fileSize/1024,0)) KB" -ForegroundColor Green
    }
}

# ==============================================================================
# BLOCK 7: GIT -- skipped entirely when -NoPush is set
# ==============================================================================
Write-Host ''
if ($NoPush) {
    Write-Host '==> -NoPush: skipping all git operations (add, commit, push).' -ForegroundColor Yellow
    Write-Host '==> Done! Dry run complete. No git state was changed.' -ForegroundColor Yellow
} else {
    Write-Host '==> Committing and pushing to GitHub...' -ForegroundColor Cyan

    $commitParts = @()
    if ($Research)  { $commitParts += 'research' }
    if ($Dashboard) { $commitParts += 'dashboard' }
    if ($commitParts.Count -eq 0) { $commitParts += 'sync' }
    $commitType = $commitParts -join '+'

    Push-Location $RepoDir
    try {
        & $GitExe add -A
        $status = & $GitExe status --porcelain
        if ($status) {
            $ts = Get-Date -Format 'yyyy-MM-dd HH:mm'
            & $GitExe commit -m "auto: $commitType update $ts"
            & $GitExe push origin main
            Write-Host '==> Pushed successfully.' -ForegroundColor Green
        } else {
            Write-Host '==> No changes to commit.' -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "[ERROR] Git operation failed: $_" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host '==> Done! Cloudflare will deploy in ~60 seconds.' -ForegroundColor Green
    Write-Host '    Hard-refresh the site: Ctrl+Shift+R' -ForegroundColor DarkGray
}
