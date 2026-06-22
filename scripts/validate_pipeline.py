"""
validate_pipeline.py
====================
Pre-deploy validation for the Hedgeye dashboard pipeline.

USAGE (called by update_cowork.ps1):
    python validate_pipeline.py              # Tier 1 only (structural)
    python validate_pipeline.py --research   # Tier 1 + Tier 2 research freshness
    python validate_pipeline.py --dashboard  # Tier 1 + Tier 2 dashboard freshness

Exit codes:
    0 = all checks passed
    1 = hard failure (deploy must be aborted)

Prints a deploy report on success.
Prints exact file/field/key on failure.
"""

import json
import os
import sys
import glob
import csv
from datetime import datetime, date, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_DATA        = r"C:\repos\hedgeye-dashboard\project\data"
MACRO_CTX        = os.path.join(REPO_DATA, "macro_context.json")
OFFICIAL_LEVELS  = os.path.join(REPO_DATA, "official_levels.json")
RR_HTML          = r"C:\repos\hedgeye-dashboard\project\risk_range_dashboard.html"
RTA_DEST         = os.path.join(REPO_DATA, "rta_latest.csv")
CHART_MANIFEST   = os.path.join(REPO_DATA, "chart_manifest.json")
CHART_ASSETS_DIR = r"C:\repos\hedgeye-dashboard\project\assets\generated"

HE_ROOT          = r"C:\Users\matth\OneDrive\Desktop\Trading\hedgeye"
RTA_SRC_GLOB     = os.path.join(HE_ROOT, "RTA", "real-time-alerts-history-*.csv")
HAM_SRC_GLOB     = os.path.join(HE_ROOT, "HAM holdings", "ETF_Holdings *.csv")
EXCEL_WORKBOOK   = r"C:\Users\matth\OneDrive\Desktop\Trading\risk_range_tracker_excelworkbook.xlsx"

# Research source folders — keyed by logical name
RESEARCH_FOLDERS = {
    "btc":              os.path.join(HE_ROOT, "BTC trend tracker"),
    "early_look":       os.path.join(HE_ROOT, "Early look pdfs"),
    "sss":              os.path.join(HE_ROOT, "signal strength list"),
    "portfolio_sols":   os.path.join(HE_ROOT, "Portfolio solutions"),
    "call_summary":     os.path.join(HE_ROOT, "The call summaries"),
    "macro_show":       os.path.join(HE_ROOT, "macro show slides"),
    "msr":              os.path.join(HE_ROOT, "Market situation report"),
    "momo":             os.path.join(HE_ROOT, "Momentum Stock Tracker"),
    "etf_pro":          os.path.join(HE_ROOT, "etf pro dash board"),
    "investing_ideas":  os.path.join(HE_ROOT, "Investing Ideas"),
    "founders_choice":  os.path.join(HE_ROOT, "Founders Choice"),
    "macro_research":   os.path.join(HE_ROOT, "macro research"),
}

# Map from RESEARCH_FOLDERS key -> key used in macro_context.json sources_used dict.
# The sources_used values use format "filename@unixmtime" (single) or
# "f1@t1|f2@t2" (multi). We parse the mtime to compare against the folder's
# newest file.  Entries with has_mtime=False use presence-only check.
SOURCES_USED_KEY_MAP = {
    # folder key        sources_used key     has @mtime
    "btc":             ("btc",              True),
    "early_look":      ("early_look",       True),
    "sss":             ("sss",              True),
    "portfolio_sols":  ("portfolio",        True),   # sources_used key differs
    "call_summary":    ("call_summary",     True),
    "macro_show":      ("macro_show",       True),
    "msr":             ("msr",              True),
    "momo":            ("momo",             True),
    "etf_pro":         ("etf_pro",          False),  # filename only
    "investing_ideas": ("investing_ideas",  True),
    "founders_choice": ("founders_choice",  True),
    "macro_research":  ("macro_research",   False),  # MD5 hash, no mtime
}

# Required top-level keys that must be present after a -Research run.
# The actual structure after R1-R4: 11 from build_macro_context.py +
# position_sizing (R4) + ham_deltas + ham_per_fund (R3) = 14.
REQUIRED_TOP_KEYS = [
    "generated_at",
    "source_date",
    "sources_used",
    "etf_rerank",
    "active_longs",
    "active_shorts",
    "ham_holdings",
    "rta",
    "levels",
    "pdf",
    "sss_history",
    "position_sizing",
    "ham_deltas",
    "ham_per_fund",
]

# Parser output field names that must be present on every position row (schema drift guard).
# These match parse_position_sizing.py output — Macro ETFs by Rank table.
REQUIRED_POSITION_FIELDS = [
    "rank",
    "ticker",
    "rerank_1w",
    "rerank_1m",
    "entry_date",
    "asset_class",
    "min_pct",
    "max_pct",
]

# Top-level keys the parser always writes to the position_sizing block
REQUIRED_POSITION_TOPLEVEL = [
    "as_of_date",
    "positions",
    "keith_commentary",
    "rerank_1w",
    "rerank_1m",
]

# Keys that only appear in a manually-written (old inferred-sizing) block
MANUAL_EDIT_SENTINEL_KEYS = ["anchor", "above_anchor", "above_hyg_threshold", "estimated_pct"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
failures = []
warnings = []

def fail(msg):
    failures.append(msg)
    print(f"  [FAIL] {msg}", flush=True)

def warn(msg):
    warnings.append(msg)
    print(f"  [WARN] {msg}", flush=True)

def ok(msg):
    print(f"  [OK]   {msg}", flush=True)

def get_nested(d, dotpath):
    """Walk a dot-separated path like 'pdf.sss' through a dict."""
    parts = dotpath.split(".")
    cur = d
    for p in parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur

def _has_future_year(name, exclude_year_after=2027):
    """Return True if filename contains a 4-digit year token > exclude_year_after.
    Ignores Unix epoch timestamps (>8 digits) and short numbers."""
    for token in name.replace("-","_").replace(".","_").split("_"):
        # Only consider exactly 4-digit tokens to avoid epoch timestamps like 1775659217
        if len(token) == 4:
            try:
                yr = int(token)
                if 1900 <= yr > exclude_year_after:
                    return True
            except ValueError:
                pass
    return False

def newest_file(glob_pattern, exclude_year_after=2027):
    """Return (path, mtime_date) of the newest file matching glob_pattern."""
    candidates = []
    for p in glob.glob(glob_pattern):
        name = os.path.basename(p)
        if _has_future_year(name, exclude_year_after):
            continue
        candidates.append(p)
    if not candidates:
        return None, None
    newest = max(candidates, key=os.path.getmtime)
    mtime = datetime.fromtimestamp(os.path.getmtime(newest)).date()
    return newest, mtime

def newest_file_in_folder(folder_path, exclude_year_after=2027):
    """Return (path, mtime_date) of the most recently modified file in a folder."""
    if not os.path.isdir(folder_path):
        return None, None
    candidates = []
    for fname in os.listdir(folder_path):
        fpath = os.path.join(folder_path, fname)
        if not os.path.isfile(fpath):
            continue
        if _has_future_year(fname, exclude_year_after):
            warn(f"Skipping future-dated file in {os.path.basename(folder_path)}: {fname}")
            continue
        candidates.append(fpath)
    if not candidates:
        return None, None
    newest = max(candidates, key=os.path.getmtime)
    mtime = datetime.fromtimestamp(os.path.getmtime(newest)).date()
    return newest, mtime

def parse_json_date(val):
    """Try to parse a date string from JSON. Returns date or None."""
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(str(val)[:10], fmt[:10]).date()
        except ValueError:
            pass
    return None

def _parse_sources_mtime(val):
    """Extract the most recent unix mtime from a sources_used value.

    Handles single entries like 'file.pdf@1780320489' and multi-file entries
    like 'f1.pdf@1780320489|f2.pdf@1779800000'.
    Returns a date, or None if no valid mtime found.
    """
    if not val or not isinstance(val, str):
        return None
    mtimes = []
    for part in val.split("|"):
        at = part.rfind("@")
        if at >= 0:
            try:
                ts = int(part[at + 1:])
                if ts > 1_000_000_000:   # sanity: must be after 2001-09-09
                    mtimes.append(ts)
            except ValueError:
                pass
    return datetime.fromtimestamp(max(mtimes)).date() if mtimes else None

# ---------------------------------------------------------------------------
# Tier 1: Structural checks (run on every deploy)
# ---------------------------------------------------------------------------
def tier1_checks(ctx):
    print("\n--- Tier 1: Structural checks ---")

    # 1. macro_context.json exists and is valid JSON
    if not os.path.exists(MACRO_CTX):
        fail(f"macro_context.json not found at {MACRO_CTX}")
        return  # nothing else can run without it

    try:
        with open(MACRO_CTX, "rb") as f:
            raw_bytes = f.read()
        # Strip trailing null bytes — can appear on OneDrive when new content is
        # shorter than the previous file (non-atomic overwrite).
        raw = raw_bytes.rstrip(b"\x00").decode("utf-8-sig")
        if raw.startswith("﻿"):
            fail("macro_context.json has a UTF-8 BOM — likely written with PowerShell -Encoding utf8. Resave without BOM.")
            return
        data = json.loads(raw)
        ctx["data"] = data
    except json.JSONDecodeError as e:
        fail(f"macro_context.json is invalid JSON: {e}")
        return
    except (UnicodeDecodeError, OSError) as e:
        fail(f"macro_context.json read error: {e}")
        return

    file_kb = len(raw_bytes) // 1024
    if file_kb < 50:
        fail(f"macro_context.json is only {file_kb} KB — suspiciously small")
        return
    ok(f"macro_context.json  valid JSON  {file_kb} KB")

    # 2. Required top-level keys present
    missing_keys = [k for k in REQUIRED_TOP_KEYS if k not in data]
    if missing_keys:
        fail(f"macro_context.json missing required top-level keys: {', '.join(missing_keys)}")
    else:
        ok(f"macro_context.json  all {len(REQUIRED_TOP_KEYS)} required keys present")

    # 3. rta_latest.csv exists
    if not os.path.exists(RTA_DEST):
        fail(f"rta_latest.csv not found at {RTA_DEST}")
    else:
        ok(f"rta_latest.csv exists")

    # 4. Risk Range HTML exists
    if not os.path.exists(RR_HTML):
        fail(f"risk_range_dashboard.html not found at {RR_HTML}")
    else:
        rr_kb = os.path.getsize(RR_HTML) // 1024
        if rr_kb < 10:
            fail(f"risk_range_dashboard.html is only {rr_kb} KB — likely empty or corrupt")
        else:
            ok(f"risk_range_dashboard.html  {rr_kb} KB")

    # 5. position_sizing block: no NaN string values
    ps = data.get("position_sizing", {})
    positions = ps.get("positions", [])
    if not isinstance(positions, list):
        fail(f"position_sizing.positions is not a list (got {type(positions).__name__}) — possible manual JSON edit")
    else:
        nan_found = []
        for p in positions:
            for k, v in p.items():
                if isinstance(v, str) and v.lower() == "nan":
                    nan_found.append(f"{p.get('ticker','?')}.{k}")
        if nan_found:
            fail(f"position_sizing has NaN string values: {', '.join(nan_found[:5])}")
        else:
            ok(f"position_sizing  no NaN values  {len(positions)} positions")

    # 6. position_sizing as_of_date present (parser writes 'as_of_date', not 'as_of')
    as_of = ps.get("as_of_date")
    if not as_of:
        if ps.get("as_of"):
            fail("position_sizing has 'as_of' but not 'as_of_date' — this is a manually-written block. Run parse_position_sizing.py.")
        else:
            fail("position_sizing.as_of_date is missing or empty")
    else:
        ok(f"position_sizing.as_of_date = {as_of}")

    # 7. Schema drift guard — detect old manually-written inferred-sizing block
    sentinel_found = [s for s in MANUAL_EDIT_SENTINEL_KEYS if s in ps]
    if sentinel_found:
        fail(
            f"position_sizing has old inferred-sizing key(s): {', '.join(sentinel_found)} — "
            f"this is stale output from the old model. Run parse_position_sizing.py to replace it."
        )

    # 7b. Top-level required keys (new Macro ETFs by Rank schema)
    missing_top = [k for k in REQUIRED_POSITION_TOPLEVEL if k not in ps]
    if missing_top:
        fail(
            f"position_sizing missing top-level keys: {', '.join(missing_top)} — "
            f"run parse_position_sizing.py to rebuild."
        )
    else:
        ok(f"position_sizing top-level keys present  as_of={ps.get('as_of_date','?')}")

    # 8. Check all position rows for required parser fields
    if isinstance(positions, list) and positions:
        rows_missing = []
        for pos in positions:
            missing = [f for f in REQUIRED_POSITION_FIELDS if f not in pos]
            if missing:
                rows_missing.append(f"{pos.get('ticker','?')}:{','.join(missing)}")
        if rows_missing:
            fail(
                f"position_sizing rows missing required fields: {'; '.join(rows_missing[:6])} — "
                f"stale parser output. Run parse_position_sizing.py."
            )
        else:
            ok(f"position_sizing schema  {len(positions)} rows  all required fields present")

    # 9. SSS: count/sparsity check + price sanity gate
    sss = data.get("pdf", {}).get("sss", {})
    sss_count = sss.get("count", 0) or 0
    sss_detail = sss.get("tickers_detail", {})
    detail_count = len(sss_detail) if isinstance(sss_detail, dict) else 0
    if sss_count > 0 and detail_count == 0:
        warn(f"pdf.sss.count={sss_count} but tickers_detail is empty — SSS extraction may have failed; details are stale")
    elif sss_count > 0 and detail_count < sss_count * 0.5:
        warn(f"pdf.sss.count={sss_count} but tickers_detail has only {detail_count} entries — SSS detail extraction may be incomplete")
    else:
        ok(f"pdf.sss  count={sss_count}  tickers_detail={detail_count} entries")

    # 9b. SSS price sanity gate — hard-fail on unresolved decimal errors
    if isinstance(sss_detail, dict) and len(sss_detail) > 0:
        unresolved_prices = []
        suspicious_no_repair = []
        corrected_prices = []

        for ticker, td in sss_detail.items():
            status = td.get("price_repair_status")
            if status == "unresolved":
                unresolved_prices.append(ticker)
            elif status == "corrected":
                corrected_prices.append(ticker)
            elif status is None:
                # price_repair_status not present — data predates repair.
                # Fall back to raw ratio check to catch obvious errors.
                entry  = td.get("entry_price") or td.get("signal_price")
                recent = td.get("recent_price")
                if entry and recent and entry > 0 and recent > 0:
                    ratio = entry / recent
                    if ratio > 4.0 or ratio < 0.25:
                        suspicious_no_repair.append(f"{ticker}(ratio={ratio:.1f}x)")

        if unresolved_prices:
            fail(
                f"SSS price sanity: {len(unresolved_prices)} ticker(s) have unresolved suspicious "
                f"signal prices (likely OCR decimal error): {', '.join(unresolved_prices[:12])}. "
                f"Re-run process_sss.py to repair. Cannot deploy with broken signal prices."
            )
        elif suspicious_no_repair:
            fail(
                f"SSS price sanity: {len(suspicious_no_repair)} ticker(s) have suspicious "
                f"entry/recent price ratios and price repair has not run: "
                f"{', '.join(suspicious_no_repair[:12])}. "
                f"Run process_sss.py to repair before deploying."
            )
        else:
            n_cor = len(corrected_prices)
            note = f"  ({n_cor} corrected)" if n_cor else ""
            ok(f"pdf.sss  price_repair=ok{note}")

    # 10. generated_at present
    gen_at = data.get("generated_at")
    if not gen_at:
        warn("macro_context.json missing generated_at field")
    else:
        ok(f"generated_at = {gen_at}")

    # 11. Chart manifest + assets (only warn, not fail — R6 is non-fatal)
    if os.path.exists(CHART_MANIFEST):
        try:
            with open(CHART_MANIFEST, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            charts = manifest.get("charts", {})
            source_pdf = manifest.get("source_pdf", "?")
            extracted_at = manifest.get("extracted_at", "?")
            for key, info in charts.items():
                status = info.get("status")
                page   = info.get("page")
                if status == "ok":
                    asset_path = os.path.join(CHART_ASSETS_DIR, f"macro_show_{key}.png")
                    if os.path.exists(asset_path):
                        size_kb = info.get("size_kb", "?")
                        ok(f"chart:{key}  p.{page}  {size_kb} KB  source={source_pdf}  extracted={extracted_at}")
                    else:
                        warn(f"chart:{key}  manifest says OK but asset file missing: {asset_path}")
                else:
                    warn(f"chart:{key}  status={status}  (chart will show 'Unavailable from source')")
        except Exception as e:
            warn(f"chart_manifest.json read error: {e}")
    else:
        warn("chart_manifest.json not found — run with -Research to extract Macro Show charts (R6)")

# ---------------------------------------------------------------------------
# Tier 2: Freshness checks (run with --research or --dashboard)
# ---------------------------------------------------------------------------
def tier2_research_checks(ctx):
    print("\n--- Tier 2: Research freshness checks ---")
    data = ctx.get("data", {})
    sources_used = data.get("sources_used", {})

    # RTA: compare rta_latest.csv mtime against newest source CSV
    newest_rta_path, newest_rta_date = newest_file(RTA_SRC_GLOB)
    if newest_rta_path is None:
        warn(f"No RTA CSV files found at {RTA_SRC_GLOB}")
    else:
        newest_rta_name = os.path.basename(newest_rta_path)
        ctx["rta_source"] = newest_rta_name
        if os.path.exists(RTA_DEST):
            dest_mtime = datetime.fromtimestamp(os.path.getmtime(RTA_DEST)).date()
            if dest_mtime < newest_rta_date:
                fail(
                    f"rta_latest.csv is from {dest_mtime} but newest source is {newest_rta_name} "
                    f"({newest_rta_date}) — copy was not updated"
                )
            else:
                ok(f"rta_latest.csv  up to date  source={newest_rta_name}")
        else:
            fail(f"rta_latest.csv not found — copy from {newest_rta_name}")
    ctx["rta_rows"] = _count_csv_rows(RTA_DEST)

    # HAM: newest source CSV vs ham_deltas.date in JSON
    newest_ham_path, newest_ham_date = newest_file(HAM_SRC_GLOB)
    ham_deltas = data.get("ham_deltas", {})
    ham_json_date = parse_json_date(ham_deltas.get("date"))
    if newest_ham_path:
        ctx["ham_source"] = os.path.basename(newest_ham_path)
        if ham_json_date and newest_ham_date and ham_json_date < newest_ham_date:
            warn(
                f"ham_deltas.date={ham_json_date} but newest HAM CSV is {newest_ham_date} "
                f"({os.path.basename(newest_ham_path)}) — run process_ham.py"
            )
        else:
            ok(f"ham_deltas  date={ham_json_date}  source={os.path.basename(newest_ham_path)}")
    else:
        warn(f"No HAM CSV files found at {HAM_SRC_GLOB}")

    # Research PDF/XLSX sources: compare sources_used @mtime against folder newest file
    # Most PDF sources don't embed a date field in extracted JSON; freshness is
    # tracked via the @mtime suffix in sources_used (e.g. 'file.pdf@1780320489').
    for key, folder in RESEARCH_FOLDERS.items():
        newest_src, newest_src_date = newest_file_in_folder(folder)
        src_name = os.path.basename(newest_src) if newest_src else "none"
        ctx[f"{key}_source"] = src_name

        if newest_src is None:
            warn(f"{key}: no source files found in {folder}")
            continue

        su_entry = SOURCES_USED_KEY_MAP.get(key)
        if su_entry is None:
            continue
        su_key, has_mtime = su_entry
        su_val = sources_used.get(su_key)

        if su_val is None:
            warn(f"{key}: not in sources_used — may not have been parsed yet")
            continue

        if not has_mtime:
            # etf_pro or macro_research: just confirm presence
            ok(f"{key}  present in sources_used  source={src_name}")
            continue

        su_date = _parse_sources_mtime(su_val)
        if su_date is None:
            warn(f"{key}: sources_used entry has no mtime — cannot check freshness  val={su_val[:80]}")
            continue

        if newest_src_date and su_date < newest_src_date:
            warn(
                f"{key}: last parsed {su_date} but newest source is {src_name} "
                f"(mtime {newest_src_date}) — may need re-parse"
            )
        else:
            ok(f"{key}  last_parsed={su_date}  source={src_name}")

def tier2_dashboard_checks(ctx):
    print("\n--- Tier 2: Dashboard freshness checks ---")

    # Excel workbook vs Risk Range HTML and official_levels.json
    if not os.path.exists(EXCEL_WORKBOOK):
        warn(f"Excel workbook not found at {EXCEL_WORKBOOK}")
        return

    excel_mtime = datetime.fromtimestamp(os.path.getmtime(EXCEL_WORKBOOK)).date()

    if os.path.exists(RR_HTML):
        html_mtime = datetime.fromtimestamp(os.path.getmtime(RR_HTML)).date()
        if html_mtime < excel_mtime:
            fail(
                f"risk_range_dashboard.html is from {html_mtime} but Excel was modified {excel_mtime} "
                f"— regenerate with -Dashboard"
            )
        else:
            ok(f"risk_range_dashboard.html  {html_mtime} >= Excel {excel_mtime}")
    else:
        fail(f"risk_range_dashboard.html not found")

    if os.path.exists(OFFICIAL_LEVELS):
        ol_mtime = datetime.fromtimestamp(os.path.getmtime(OFFICIAL_LEVELS)).date()
        if ol_mtime < excel_mtime:
            warn(
                f"official_levels.json is from {ol_mtime} but Excel was modified {excel_mtime} "
                f"— may need parse_rr_history.py"
            )
        else:
            ok(f"official_levels.json  {ol_mtime} >= Excel {excel_mtime}")
    else:
        warn(f"official_levels.json not found at {OFFICIAL_LEVELS}")

# ---------------------------------------------------------------------------
# Deploy report (printed on success)
# ---------------------------------------------------------------------------
def print_deploy_report(ctx):
    data = ctx.get("data", {})
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    macro_kb = os.path.getsize(MACRO_CTX) // 1024 if os.path.exists(MACRO_CTX) else 0
    gen_at = data.get("generated_at", "-")

    ps = data.get("position_sizing", {})
    ps_positions = len(ps.get("positions", []))
    ps_as_of = ps.get("as_of_date") or ps.get("as_of") or "-"

    rta_rows = ctx.get("rta_rows", _count_csv_rows(RTA_DEST))
    rta_src  = ctx.get("rta_source", os.path.basename(RTA_DEST) if os.path.exists(RTA_DEST) else "-")

    ham = data.get("ham_deltas", {})
    ham_date = ham.get("date", "-")
    ham_funds = len(ham.get("funds", {})) if isinstance(ham.get("funds"), dict) else "-"

    sss = data.get("pdf", {}).get("sss", {})
    sss_count = sss.get("total_count") or sss.get("count") or len(sss.get("tickers", []))

    etf_long  = len(data.get("active_longs",  []))
    etf_short = len(data.get("active_shorts", []))

    rr_kb = os.path.getsize(RR_HTML) // 1024 if os.path.exists(RR_HTML) else 0
    rr_status = f"OK  {rr_kb} KB" if rr_kb > 10 else "MISSING or empty"

    warn_count = len(warnings)

    # Chart assets summary
    chart_summary = "-"
    if os.path.exists(CHART_MANIFEST):
        try:
            with open(CHART_MANIFEST, "r", encoding="utf-8") as f:
                m = json.load(f)
            ok_charts = [k for k,v in m.get("charts",{}).items() if v.get("status")=="ok"]
            pages = {k: m["charts"][k].get("page") for k in ok_charts}
            chart_summary = f"{len(ok_charts)}/2 extracted  " + "  ".join(f"{k}=p{p}" for k,p in pages.items()) + f"  source={m.get('source_pdf','?')}"
        except Exception:
            chart_summary = "manifest unreadable"

    print()
    print(f"=== DEPLOY REPORT [{now}] " + "=" * 20)
    print(f"  macro_context.json   generated={gen_at}   size={macro_kb} KB")
    print(f"  position_sizing      {ps_positions} positions   as_of={ps_as_of}")
    print(f"  rta_latest.csv       source={rta_src}   rows={rta_rows}")
    print(f"  ham_deltas           {ham_funds} funds   date={ham_date}")
    print(f"  sss                  {sss_count} tickers")
    print(f"  etf_pro              {etf_long} longs / {etf_short} shorts")
    print(f"  Risk Range HTML      {rr_status}")
    print(f"  Macro Show charts    {chart_summary}")
    print(f"  Warnings             {warn_count}")
    print(f"  Validation           PASSED")
    print("=" * 46)


def _count_csv_rows(path):
    if not os.path.exists(path):
        return "-"
    try:
        with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
            return sum(1 for _ in f) - 1  # subtract header
    except Exception:
        return "?"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    args = sys.argv[1:]
    run_research  = "--research"  in args
    run_dashboard = "--dashboard" in args

    ctx = {}

    tier1_checks(ctx)

    if run_research:
        tier2_research_checks(ctx)

    if run_dashboard:
        tier2_dashboard_checks(ctx)

    if failures:
        print(f"\n[VALIDATION FAILED] {len(failures)} hard failure(s):")
        for f in failures:
            print(f"  - {f}")
        print("\nDeploy aborted. Check backup files in project/data/backups/")
        sys.exit(1)

    if warnings:
        print(f"\n[VALIDATION PASSED] with {len(warnings)} warning(s) -- see above")
    else:
        print("\n[VALIDATION PASSED]")

    print_deploy_report(ctx)
    sys.exit(0)


if __name__ == "__main__":
    main()
