# CHANGELOG
## Hedgeye Dashboard — Session History
## Paste session debriefs here. Most recent at top.

---

## [2026-06-04] — CLAUDE.md created + pipeline wiring fixes

### What we created:
- `C:\repos\hedgeye-dashboard\CLAUDE.md` — permanent dashboard project memory
  Covers: repo architecture rule, pipeline structure (R1-R6, D1-D3), research
  source folders, key files, architecture decisions, JSX editing rule, validation
  rules, behavior rules for Claude, session workflow, quick diagnosis guide.
- `C:\Users\matth\OneDrive\Desktop\Trading\hedgeye-dashboard\CLAUDE.md` — OneDrive mirror
- `README.md` — replaced stale design-handoff boilerplate with real architecture docs

### What we fixed this session:
- **MSR card blank** — `he_app.jsx` was reading `pv_band_resistance`/`pv_band_support`/
  `key_points` (none exist). Fixed to read actual fields: `resistance`, `support`,
  `gamma_exposure`, `gex_flip`, `pv_band`, `systematic_flow`, `strategic_allocation`.
- **Volatility tab missing charts** — Added Macro Show chart image cards to `he_signals.jsx`
  VolTab. Cards display `assets/generated/macro_show_usd_corr.png` and `macro_show_ivol.png`,
  show source PDF + page number in header, fall back to "Unavailable from source."
- **R6 not running** — `extract_macro_show_charts.py` was using `__file__`-relative
  `REPO_ROOT` (wrote to OneDrive); validation reads from `C:\repos`. Fixed: hardcoded
  `REPO_ROOT = Path(r"C:\repos\hedgeye-dashboard")`.
- **Repo execution rule codified** — `update_cowork.ps1` header rewritten with permanent
  "!! ALWAYS RUN FROM THE REPO !!" guidance. Memory + CLAUDE.md document the rule.
- **validate_pipeline.py** — added chart asset checks (Tier 1), deploy report now shows
  Macro Show chart status with source PDF and page numbers.
- **update_cowork.ps1** — added R6 step, simplified Block 3 assets section (script now
  writes to C:\repos directly, no OneDrive→repo copy needed).

### Pipeline state as of this session:
- R1-R6 all wired and validated
- MSR field names corrected in UI
- Volatility chart extraction pipeline complete (pending first live run with -Research)
- Validation: Tier 1 + Tier 2 both operational

### Open items:
- First live `-Research` run to confirm R6 extracts both charts end-to-end
- Push all changes live after dry-run confirms clean

### Files changed:
- `project/js/he_app.jsx` — MSR field name fix
- `project/js/he_signals.jsx` — Macro Show chart image cards in VolTab
- `scripts/extract_macro_show_charts.py` — hardcoded C:\repos REPO_ROOT
- `scripts/validate_pipeline.py` — chart asset checks + deploy report
- `update_cowork.ps1` — R6 step, simplified assets sync, header rewrite
- `CLAUDE.md` — created (this file)
- `README.md` — replaced with real architecture docs
- `CHANGELOG.md` — created (this file)

