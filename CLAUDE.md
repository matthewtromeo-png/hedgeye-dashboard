# Hedgeye Dashboard — Project Memory
## Permanent Instructions for Claude
## Version: 1.0 | Created: 2026-06-04

> **SESSION START CHECKLIST — do this every time:**
> 1. Read this file fully
> 2. Read CHANGELOG.md — know what changed last session
> 3. Check `macro_context.json` generated_at to know how fresh the data is
> 4. Confirm out loud: which project (dashboard vs Risk Range model), current open issue, last deploy state
> 5. Propose approach before writing any code or running any deploy

---

## EDIT POLICY — READ THIS FIRST

**Claude may NEVER edit this file autonomously.**
All changes require the explicit phrase from the user:
> *"Update CLAUDE.md"*

Same rule as the Risk Range model CLAUDE.md — this exists to prevent silent drift
of the permanent record.

---

## WHAT THIS PROJECT IS

A live Hedgeye research dashboard deployed via Cloudflare Pages.
It aggregates Keith McCullough's daily research outputs (Early Look, Macro Show,
Signal Strength, HAM holdings, Market Situation Report, etc.) into a single
interactive React/JSX app that Matthew uses to run his portfolio.

**This is a DIFFERENT project from the Risk Range Python model.**
- Risk Range model: `C:\Users\matth\OneDrive\Desktop\Python\Python algos\` — k-calibration, Calibration_test.py
- Dashboard: `C:\repos\hedgeye-dashboard\` — this project

Do not import instructions, calibration values, or k-value logic from the Risk Range
CLAUDE.md into this file, and vice versa.

---

## REPO ARCHITECTURE — PERMANENT RULE

### !! ALWAYS RUN FROM THE REPO !!

```powershell
cd C:\repos\hedgeye-dashboard
.\update_cowork.ps1 [flags]
```

**Never run `update_cowork.ps1` from the OneDrive folder** unless there is a very
specific reason and it is explicitly called out. Running the OneDrive copy risks
executing a stale version of the script that does not have the latest changes.

### Two directories, one purpose each

| Directory | Role |
|---|---|
| `C:\repos\hedgeye-dashboard` | **Execution + deployment source of truth.** Git repo. Run all commands here. |
| `C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard` | **Working/source mirror.** Edit JS/JSX and scripts here. Synced into repo at deploy time. |

OneDrive must **not** contain the git repo — OneDrive corrupts git objects.

### File flow: OneDrive → C:\repos

```
OneDrive source                         Repo (deployed)
───────────────────────────────         ──────────────────────────────────────
project/js/*.jsx            ─Block3──►  project/js/*.jsx
scripts/*.py                ─Block3──►  scripts/*.py
update_cowork.ps1           ─Block3──►  update_cowork.ps1 (self-sync)

Research PDFs/XLSX          ──R1────►   project/data/macro_context.json
                            ──R2────►   project/data/macro_context.json (SSS patch)
                            ──R3────►   project/data/macro_context.json (HAM patch)
                            ──R4────►   project/data/macro_context.json (sizing patch)
                            ──R5────►   project/data/rta_latest.csv
                            ──R6────►   project/data/chart_manifest.json
                                        project/assets/generated/*.png

Excel workbook              ──D1────►   project/risk_range_dashboard.html
                            ──D2────►   project/data/official_levels.json
                            ──D3────►   project/risk_range_dashboard.html (RR_HISTORY)
```

### Output path contract

ALL generated output must land in the repo, never in OneDrive:
- `C:\repos\hedgeye-dashboard\project\data\`
- `C:\repos\hedgeye-dashboard\project\assets\`
- `C:\repos\hedgeye-dashboard\project\risk_range_dashboard.html`

Scripts must use **hardcoded** `C:\repos\hedgeye-dashboard` paths — never
`__file__`-relative paths (which resolve to wherever the script lives, which may
be OneDrive when called via `$ScriptsDir`).

**Exception:** `build_macro_context.py` (R1) writes to its own OneDrive folder by
design. `update_cowork.ps1` explicitly copies the result to `C:\repos\project\data`
immediately after R1 succeeds (before R2-R4 run). That copy step is the contract.

### Validation reads from the repo

`validate_pipeline.py` reads exclusively from `C:\repos\hedgeye-dashboard`.
That is what gets committed and deployed. Never add OneDrive paths to the validator.

---

## COMMANDS — QUICK REFERENCE

```powershell
cd C:\repos\hedgeye-dashboard

# Dry-run full refresh (parsers + validation, no git push)
.\update_cowork.ps1 -Research -Dashboard -NoPush

# Live full refresh
.\update_cowork.ps1 -Research -Dashboard

# Research only (new PDFs/data)
.\update_cowork.ps1 -Research

# Risk Range dashboard only (new Excel levels)
.\update_cowork.ps1 -Dashboard

# Sync + validate + push (no parser re-run)
.\update_cowork.ps1

# Dry-run research only
.\update_cowork.ps1 -Research -NoPush
```

**Always dry-run first after any pipeline change.**
Do not push live if validation hard-fails.

---

## PIPELINE STRUCTURE

### Research pipeline (runs with -Research)

| Step | Script | What it does | Fatal? |
|---|---|---|---|
| R1 | `build_macro_context.py` | Full rebuild of `macro_context.json` from all research folders | YES |
| — | *(R1 sync)* | OneDrive `macro_context.json` copied to repo immediately after R1 | — |
| R2 | `process_sss.py` | Patches SSS section with detailed ticker data | no |
| R3 | `process_ham.py` | Patches HAM holdings, deltas, per-fund breakdown | no |
| R4 | `parse_position_sizing.py` | Patches `position_sizing` from Macro Show PDF | YES |
| R5 | *(inline)* | Copies newest `real-time-alerts-history-*.csv` to repo | no |
| R6 | `extract_macro_show_charts.py` | Extracts chart PNGs from Macro Show PDF to `assets/generated/` | no |

### Risk Range dashboard pipeline (runs with -Dashboard)

| Step | Script | What it does |
|---|---|---|
| D1 | `Hedgeye_riskrange_dashboard.py` | Reads Excel → generates `risk_range_dashboard.html` |
| D2 | `import_official_levels.py` | Reads Excel → writes `official_levels.json` |
| D3 | `parse_rr_history.py` | Injects `RR_HISTORY` block into `risk_range_dashboard.html` |

### Validation (always runs, before every push)

`validate_pipeline.py` — Tier 1 (structural) runs on every deploy.
Tier 2 (freshness) runs when `--research` or `--dashboard` flag is set.
Exit 1 aborts deploy. Backups in `project/data/backups/`.

---

## RESEARCH SOURCE FOLDERS

All source files under `C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\`:

| Folder | Parser step | `macro_context.json` key |
|---|---|---|
| `BTC trend tracker\` | R1 | `pdf.btc` |
| `Early look pdfs\` | R1 | `pdf.early_look` |
| `etf pro dash board\` | R1 | `etf_rerank`, `active_longs`, `active_shorts` |
| `Founders Choice\` | R1 | `pdf.founders_choice` |
| `From the desk\` | R1 | `pdf.from_the_desk` |
| `HAM holdings\` | R3 | `ham_holdings`, `ham_deltas`, `ham_per_fund` |
| `Investing Ideas\` | R1 | `pdf.investing_ideas` |
| `macro research\` | R1 | `pdf.macro_research` |
| `macro show slides\` | R1 + R6 | `pdf.macro_show` + `assets/generated/*.png` |
| `Market situation report\` | R1 | `pdf.msr` |
| `Momentum Stock Tracker\` | R1 | `pdf.momo` |
| `Portfolio solutions\` | R1 | `pdf.portfolio` |
| `RTA\` | R5 | `rta_latest.csv` |
| `signal strength list\` | R2 | `pdf.sss` |
| `The call summaries\` | R1 | `pdf.call_summary` |

**Macro Show chart extraction (R6):** finds newest `HE_TMS_*.pdf`, locates
"Key $USD Correlations" and "Implied & Realized Volatility" slides by text search,
extracts the embedded PNG from each slide using `pypdf`.
Output: `project/assets/generated/macro_show_usd_corr.png` and `macro_show_ivol.png`.
Provenance: `project/data/chart_manifest.json` (source PDF, page numbers, extracted date).

---

## KEY FILES

```
C:\repos\hedgeye-dashboard\
├── CLAUDE.md                              ← this file
├── CHANGELOG.md                           ← session history
├── README.md                              ← architecture reference (human-readable)
├── update_cowork.ps1                      ← deploy controller
│
├── scripts\
│   ├── build_macro_context.py             ← R1: full macro_context.json rebuild
│   ├── process_sss.py                     ← R2: SSS patch
│   ├── process_ham.py                     ← R3: HAM patch
│   ├── parse_position_sizing.py           ← R4: position sizing (FATAL on fail)
│   ├── extract_macro_show_charts.py       ← R6: Macro Show PDF chart extraction
│   ├── import_official_levels.py          ← D2: Excel → official_levels.json
│   ├── parse_rr_history.py                ← D3: RR_HISTORY injection
│   └── validate_pipeline.py              ← pre-deploy validation
│
└── project\
    ├── index.html
    ├── js\
    │   ├── he_app.jsx      ← main shell: Overview, MSR card, MOMO card, SizingTab (inlined)
    │   ├── he_signals.jsx  ← Volatility tab (VIX gauge, VolTab, Macro Show charts)
    │   ├── he_ham.jsx      ← HAM Holdings tab
    │   ├── he_etfpro.jsx   ← ETF Pro tab
    │   ├── he_rta.jsx      ← Real-Time Alerts tab
    │   ├── he_prices.jsx   ← Stock Analyzer tab
    │   ├── he_pos.jsx      ← Position Sizing tab
    │   ├── he_research_status.jsx  ← Research Status / freshness checklist
    │   ├── he_shared.jsx   ← shared components
    │   └── he_data.js      ← static reference data (CPI, quad map, etc.)
    ├── data\
    │   ├── macro_context.json      ← primary data feed for ALL tabs
    │   ├── official_levels.json    ← Risk Range levels (from Excel)
    │   ├── rta_latest.csv          ← Real-Time Alerts history
    │   ├── chart_manifest.json     ← Macro Show chart extraction provenance
    │   └── version.json            ← deploy timestamp
    ├── assets\
    │   └── generated\
    │       ├── macro_show_usd_corr.png   ← Key $USD Correlations (R6)
    │       └── macro_show_ivol.png       ← Implied & Realized Volatility (R6)
    └── risk_range_dashboard.html         ← Risk Range dashboard (Excel + D1-D3)
```

OneDrive source mirror has the same structure at:
`C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\`

---

## ARCHITECTURE DECISIONS — DO NOT REVERSE

These were reached after debugging regressions. Each rule has a reason.

**1. Stock Analyzer is inlined into `he_app.jsx`.**
Not loaded from `he_analyzer.jsx`. A separate file caused CDN 404 and blank-screen
regressions. Never split it back out without explicit request.

**2. SizingTab (Position Sizing) is inlined into `he_app.jsx`.**
Same reason — external `he_sizing.jsx` caused 404 at deploy time.

**3. Position Sizing must come from `parse_position_sizing.py`.**
Not from manual JSON patches. Manually-patched `position_sizing` blocks have a
different schema (missing `estimated_pct`, `fill_pct`, `tier`, etc.) and break
the UI. The validator checks for this and will abort if a manual block is detected.

**4. SSS data must read from `macro_context.json → pdf.sss`.**
Not from the legacy `window.HE.SSS` static object. `window.HE.SSS` is stale.

**5. Risk Range levels come from the Excel workbook, not PDF research.**
The Excel workbook is the authoritative source for LRR/TRR/center.
PDFs may quote levels as text — don't parse them for model output.

**6. Volatility charts are locally extracted from Macro Show PDFs.**
`R6` extracts PNGs directly using `pypdf` — no screenshot, no manual copy.
If extraction fails, the UI shows "Unavailable from source," not a blank card.

**7. MSR card reads actual `pdf.msr` field names.**
Fields: `resistance`, `support`, `gamma_exposure`, `gex_flip`, `pv_band`,
`systematic_flow`, `strategic_allocation`, `spx_last`.
Do NOT use: `pv_band_resistance`, `pv_band_support`, `key_points` (these don't exist).

**8. Generated JSON is never manually patched as a shortcut.**
If a section is wrong, fix the parser. If data is missing, show `—` or
"Unavailable from source." Never fake values to make the UI look populated.

**9. JSX files are edited in OneDrive, synced to repo by Block 3.**
Do not edit JSX in the repo directly — overwritten on next deploy.

---

## JSX EDITING RULE

**Never use the Edit tool directly on `.jsx` or `.js` files.**
All JSX/JS edits must use Python `str.replace()` via bash, then Babel-parse-check
before deploying.

```python
# Correct way to edit JSX
path = r"C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\project\js\he_app.jsx"
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()
src = src.replace(OLD, NEW, 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
```

```bash
# Then Babel parse check
node babel_check.js project/js/he_app.jsx project/js/he_signals.jsx
```

If the old string is not found, stop and re-read the file — do not guess at the content.

---

## VALIDATION RULES

1. Always dry-run first after pipeline changes: `.\update_cowork.ps1 -Research -NoPush`
2. No live push if validation hard-fails (exit 1).
3. Validation reads from `C:\repos` — that is what gets committed and deployed.
4. A warning is not a block — deploy can proceed with warnings.
5. A hard failure means: abort, inspect output, fix, dry-run again.
6. Backups of `macro_context.json` and `official_levels.json` are in `project/data/backups/`.

**What validation checks (Tier 1 — every deploy):**
- `macro_context.json` is valid JSON and ≥50 KB
- All 14 required top-level keys are present
- `rta_latest.csv` exists
- `risk_range_dashboard.html` exists and ≥10 KB
- `position_sizing` has no NaN values and correct parser schema
- `pdf.sss` count vs tickers_detail sparsity
- Chart manifest + asset files present (warns if missing, does not fail)

---

## BEHAVIOR RULES FOR CLAUDE

1. **Inspect before editing.** Read the relevant file, JSON key, and component before
   proposing a fix. Never guess at field names or structure.

2. **Explain which layer is broken.** When something is blank or wrong, identify whether
   the issue is in: (a) source folder, (b) parser output, (c) `macro_context.json`,
   (d) UI field mapping, or (e) deployment/sync. Don't jump to the wrong layer.

3. **Propose before major changes.** Any fix touching multiple files or the pipeline
   order needs a stated plan and expected output before code is written.

4. **Do not silently patch.** State what changed, why, and what to check.

5. **Do not redesign unless explicitly asked.** If the layout is working and the bug
   is in data, fix the data. Don't refactor JSX to fix a JSON field name mismatch.

6. **Do not fake missing data.** If a source file wasn't found or extraction failed,
   the correct output is `null`, `—`, or "Unavailable from source." Never fabricate values.

7. **Do not manually patch generated JSON as a shortcut.** Fix the parser instead.
   Manual patches break the schema, trigger validation warnings, and get overwritten.

8. **Keep fixes small and testable.** One fix at a time. Dry-run. Check the output.
   Then move to the next fix.

9. **After changes, give the exact command and expected output.**
   Always include: `cd C:\repos\hedgeye-dashboard` before any deploy command.

10. **When giving commands, always use `cd C:\repos\hedgeye-dashboard`.**
    Never direct the user to run scripts from the OneDrive folder.

---

## SESSION WORKFLOW

### Start of session
1. Read CLAUDE.md + CHANGELOG.md
2. Note the last deployed state (last CHANGELOG entry)
3. State what project we're in and the current open issue
4. Propose approach before any code or deploy

### During session
- After every dry-run: report what passed, what warned, what failed
- If a discovery changes the plan: say so before pivoting
- If validation fails: stop, diagnose the layer, fix, dry-run again

### End of session — MANDATORY DEBRIEF
Write this before ending, then add to CHANGELOG.md:

```
## SESSION DEBRIEF — [DATE]
### What we worked on:
### What we completed:
### What we discovered (unexpected findings):
### What's still open:
### Recommended start point for next session:
### Files changed this session:
### Last deploy state (commit hash if pushed):
```

---

## DEPLOYMENT FLOW

```
update_cowork.ps1 -Research -Dashboard
  Block 1: R1 → R6 (research parsers, write to C:\repos)
  Block 2: D1 → D3 (Risk Range dashboard, write to C:\repos)
  Block 3: Sync OneDrive JS/JSX + scripts → C:\repos
  Block 4: Sync data files (ham CSV, official_levels if -Dashboard)
  Block 5: Write version.json
  Block 6: validate_pipeline.py (abort on failure)
  Block 7: git add -A → git commit → git push origin main
              (skipped entirely if -NoPush)
  Cloudflare: detects push → deploys in ~60 seconds
```

Hard-refresh the site after deploy: **Ctrl+Shift+R**

---

## QUICK DIAGNOSIS GUIDE

| Symptom | Likely cause | Where to look |
|---|---|---|
| Tab is blank | React error or missing data | Browser console; check JSON key exists |
| Card shows `—` everywhere | Field name mismatch | Compare UI field name vs actual JSON key |
| Validation aborts | `macro_context.json` bad/missing or position_sizing schema wrong | Validation output + backups folder |
| R6 doesn't run | `extract_macro_show_charts.py` not found at `$ScriptsDir` | Check OneDrive scripts folder |
| Chart shows "Unavailable" | R6 failed or PDF text search didn't match | `chart_manifest.json` status fields |
| MSR card blank | Field name mismatch — real fields: `resistance`, `support`, `pv_band` | `macro_context.json → pdf.msr` |
| Position Sizing blank | Parser schema mismatch or manual JSON patch detected | Validator output; check `position_sizing.positions[0]` |
| SSS showing stale data | Reading `window.HE.SSS` instead of `macro_context.json` | Check component's data source |
| Push succeeds but site unchanged | Cloudflare cache | Hard-refresh Ctrl+Shift+R |
