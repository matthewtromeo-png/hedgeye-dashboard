#!/usr/bin/env python3
"""
build_macro_context.py
======================
Stage 1: Excel / CSV sources (no API).
Stage 2: PDF extraction via Claude API (skipped with --stage1-only).

Stage 1 sources:
  - etf pro dash board\etf-pro-all-active-tickers-*.xlsx
  - HAM holdings\ETF_Holdings*.csv
  - RTA\real-time-alerts-history-*.csv
  - risk_range_tracker_excelworkbook.xlsx

Stage 2 sources (PDFs → Claude API):
  A  macro show slides\HE_TMS_*.pdf
  B  Market situation report\*.pdf
  C  signal strength list\*.pdf
  D  Investing Ideas\*.pdf
  E  Momentum Stock Tracker\*.pdf
  F  macro research\*.pdf
  G  BTC trend tracker\*.pdf
  H  Founders Choice\*.pdf
  I  macro show slides\macro show reports\*.pdf

Output: project/data/macro_context.json
"""

import argparse
import base64
import csv
import glob
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed.  Run: pip install openpyxl")
    sys.exit(1)

# ── PATHS ─────────────────────────────────────────────────────────────────────
HEDGEYE_BASE = Path(r"C:\Users\matth\OneDrive\Desktop\Trading\hedgeye")
REPO_ROOT    = Path(__file__).resolve().parent.parent
RR_WORKBOOK  = Path(r"C:\Users\matth\OneDrive\Desktop\Trading\risk_range_tracker_excelworkbook.xlsx")
OUTPUT_PATH  = REPO_ROOT / "project" / "data" / "macro_context.json"

# ── HELPERS ───────────────────────────────────────────────────────────────────

def newest_file(folder: Path, glob_pattern: str) -> Path | None:
    """Return most recently modified file in folder matching glob_pattern, or None."""
    matches = sorted(folder.glob(glob_pattern), key=lambda p: p.stat().st_mtime)
    if not matches:
        print(f"  [glob] No matches for {folder / glob_pattern}")
        return None
    print(f"  [glob] Found {len(matches)} match(es) in {folder}")
    print(f"  [glob] Using: {matches[-1].name}")
    return matches[-1]


def warn(msg: str) -> None:
    print(f"  [WARN] {msg}", file=sys.stderr)


def cell_float(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return None if f != f else f
    if isinstance(v, str):
        s = v.strip().replace(',', '').rstrip('%')
        try:
            return float(s) if s else None
        except ValueError:
            return None
    return None


def iso_date(v) -> str:
    """Normalise various date representations to YYYY-MM-DD string."""
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, str):
        s = v.strip()[:10]
        return s
    return ''


# ── ETF PRO ───────────────────────────────────────────────────────────────────

def read_etf_pro() -> dict:
    print("\n── ETF Pro ──")
    path = newest_file(HEDGEYE_BASE / "etf pro dash board", "etf-pro-all-active-tickers-*.xlsx")
    if not path:
        warn("etf pro: no file found")
        return {"etf_rerank": [], "active_longs": [], "active_shorts": [], "_source": None}

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    print(f"  [debug] Total raw rows (including header): {len(rows)}")
    if not rows:
        warn("etf pro: empty workbook")
        return {"etf_rerank": [], "active_longs": [], "active_shorts": [], "_source": path.name}

    # Find the header row dynamically — it contains 'Ticker' somewhere in first 5 rows
    header_idx = 0
    for i, row in enumerate(rows[:5]):
        if any(str(c or '').strip().lower() == 'ticker' for c in row):
            header_idx = i
            break
    print(f"  [debug] Header found at row index {header_idx}: {[str(c or '') for c in rows[header_idx]]}")
    header = [str(c).strip() if c else '' for c in rows[header_idx]]

    def col(name):
        try:
            return header.index(name)
        except ValueError:
            return None

    i_etf   = col('ETF')
    i_class = col('Asset Class')
    i_call  = col('Call')
    i_tick  = col('Ticker')
    i_date  = col('Date Added')
    i_price = col('Last Price')
    i_days  = col('Days Held')

    rerank, longs, shorts = [], [], []
    seen_tickers = set()
    today = date.today()

    for row in rows[header_idx + 1:]:
        def get(i, r=row):
            return r[i] if i is not None and i < len(r) else None

        ticker = str(get(i_tick) or '').strip()
        call   = str(get(i_call) or '').strip().upper()
        # Skip blank rows, header repeats, and non-Long/Short rows
        if not ticker or ticker.lower() == 'ticker' or call not in ('LONG', 'SHORT'):
            continue
        if ticker in seen_tickers:
            print(f"  [debug] Duplicate ticker skipped: {ticker}")
            continue
        seen_tickers.add(ticker)

        rerank.append(ticker)

        added_raw = get(i_date)
        days_held = get(i_days)
        if days_held is None and added_raw:
            try:
                added = datetime.strptime(str(added_raw)[:10], '%Y-%m-%d').date()
                days_held = (today - added).days
            except (ValueError, TypeError):
                days_held = None

        entry = {
            "ticker":      ticker,
            "etf":         str(get(i_etf) or '').strip(),
            "asset_class": str(get(i_class) or '').strip(),
            "date_added":  iso_date(added_raw),
            "last_price":  cell_float(get(i_price)),
            "days_held":   int(days_held) if days_held is not None else None,
        }
        if call == 'LONG':
            longs.append(entry)
        else:
            shorts.append(entry)

    print(f"  [debug] After filter: {len(rerank)} unique tickers ({len(longs)} long, {len(shorts)} short)")
    return {
        "etf_rerank":    rerank,
        "active_longs":  longs,
        "active_shorts": shorts,
        "_source":       path.name,
    }


# ── HAM HOLDINGS ─────────────────────────────────────────────────────────────

def read_ham_holdings() -> dict:
    print("\n── HAM Holdings ──")
    path = newest_file(HEDGEYE_BASE / "HAM holdings", "ETF_Holdings*.csv")
    if not path:
        warn("HAM holdings: no file found")
        return {"ham_holdings": [], "_source": None}

    # Accumulate per-ticker across all accounts
    by_ticker: dict = {}

    with open(path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ticker = (row.get('StockTicker') or '').strip()
            if not ticker or ticker == 'Cash&Other':
                continue
            if (row.get('MoneyMarketFlag') or '').strip().upper() == 'Y':
                continue
            if '-TRS-' in ticker:
                continue

            raw_weight = (row.get('Weightings') or '0').replace('%', '').strip()
            try:
                weight = float(raw_weight) / 100
            except ValueError:
                continue
            if not weight or weight <= 0:
                continue

            account = (row.get('Account') or '').strip()
            name    = (row.get('SecurityName') or '').strip()

            raw_mv = (row.get('MarketValue') or '').replace(',', '').strip()
            try:
                market_value = float(raw_mv)
            except ValueError:
                market_value = None

            if ticker not in by_ticker:
                by_ticker[ticker] = {
                    "ticker":       ticker,
                    "name":         name,
                    "total_weight": 0.0,
                    "accounts":     {},
                    "market_value": 0.0,
                }
            entry = by_ticker[ticker]
            entry["total_weight"] = round(entry["total_weight"] + weight, 6)
            entry["accounts"][account] = round(
                entry["accounts"].get(account, 0.0) + weight, 6
            )
            if market_value:
                entry["market_value"] = round(
                    (entry["market_value"] or 0.0) + market_value, 2
                )
            if not entry["name"] and name:
                entry["name"] = name

    holdings = sorted(by_ticker.values(), key=lambda x: x["total_weight"], reverse=True)
    return {"ham_holdings": holdings, "_source": path.name}


# ── RTA TRADE HISTORY ─────────────────────────────────────────────────────────

def _parse_duration(raw: str) -> str:
    """Extract highest signal level from RTA duration string."""
    s = raw.lower()
    if 'tail'  in s: return 'TAIL'
    if 'trend' in s: return 'TREND'
    return 'TRADE'


def _parse_date(raw: str) -> date | None:
    """Parse RTA date strings: 'M/D/YYYY HH:MM', 'M/D/YYYY', or 'YYYY-MM-DD...'."""
    s = raw.strip()
    for fmt in ('%m/%d/%Y %H:%M', '%m/%d/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:len(fmt)], fmt).date()
        except ValueError:
            continue
    return None


def read_rta_trades() -> dict:
    print("\n── RTA ──")
    path = newest_file(HEDGEYE_BASE / "RTA", "real-time-alerts-history-*.csv")
    if not path:
        warn("RTA: no file found")
        return {"rta": {"recent_trades": [], "stats": {}, "recently_traded_tickers": []}, "_source": None}

    today      = date.today()
    cutoff_90d = today - timedelta(days=90)
    cutoff_60d = today - timedelta(days=60)
    print(f"  [debug] today={today}  cutoff_90d={cutoff_90d}  cutoff_60d={cutoff_60d}")

    all_closed: list = []
    skipped_open = skipped_date_err = total_rows = 0

    with open(path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.DictReader(fh)
        first = True
        for row in reader:
            if first:
                print(f"  [debug] CSV columns: {list(row.keys())}")
                print(f"  [debug] First row sample: Close Date={row.get('Close Date')!r}  Close Price={row.get('Close Price')!r}")
                first = False
            total_rows += 1

            close_date_raw  = (row.get('Close Date')  or '').strip()
            close_price_raw = (row.get('Close Price') or '').strip()
            if not close_date_raw or not close_price_raw:
                skipped_open += 1
                continue  # open position — skip

            close_date = _parse_date(close_date_raw)
            if close_date is None:
                skipped_date_err += 1
                continue

            close_date_str = close_date.strftime('%Y-%m-%d')

            symbol   = (row.get('Symbol')   or '').strip()
            position = (row.get('Position') or '').strip().lower()
            if not symbol:
                continue

            open_date_obj = _parse_date(row.get('Open Date') or '')
            open_date_str = open_date_obj.strftime('%Y-%m-%d') if open_date_obj else ''

            try:
                open_price = float((row.get('Open Price') or '').strip())
            except ValueError:
                open_price = None

            try:
                close_price = float(close_price_raw)
            except ValueError:
                close_price = None

            try:
                realized_return = float((row.get('Realized Return') or '').strip())
            except ValueError:
                realized_return = None

            duration = _parse_duration(row.get('Duration') or '')

            all_closed.append({
                "symbol":           symbol,
                "position":         position,
                "open_date":        open_date_str,
                "open_price":       open_price,
                "close_date":       close_date_str,
                "close_price":      close_price,
                "realized_return":  realized_return,
                "duration":         duration,
                "_close_date_obj":  close_date,
            })

    # Recent trades (last 90 days), most recent first
    recent = [t for t in all_closed if t["_close_date_obj"] >= cutoff_90d]
    recent.sort(key=lambda x: x["close_date"], reverse=True)

    # Recently traded tickers (last 60 days) — for SSS badge
    recently_traded = sorted({
        t["symbol"] for t in all_closed if t["_close_date_obj"] >= cutoff_60d
    })

    # Strip internal field before output
    for t in recent:
        del t["_close_date_obj"]

    # Stats
    longs  = [t for t in recent if t["position"] == "long"  and t["realized_return"] is not None]
    shorts = [t for t in recent if t["position"] == "short" and t["realized_return"] is not None]

    def win_rate(trades):
        if not trades: return None
        return round(sum(1 for t in trades if t["realized_return"] > 0) / len(trades), 4)

    def avg_return(trades):
        if not trades: return None
        return round(sum(t["realized_return"] for t in trades) / len(trades), 4)

    stats = {
        "win_rate_long":    win_rate(longs),
        "win_rate_short":   win_rate(shorts),
        "avg_return_long":  avg_return(longs),
        "avg_return_short": avg_return(shorts),
        "total_trades_90d": len(recent),
    }

    return {
        "rta": {
            "recent_trades":           recent,
            "stats":                   stats,
            "recently_traded_tickers": recently_traded,
        },
        "_source": path.name,
    }


# ── RISK RANGE LEVELS ─────────────────────────────────────────────────────────
# Reuse parse logic from import_official_levels.py rather than duplicating it.

def read_risk_range_levels() -> dict:
    if not RR_WORKBOOK.exists():
        warn(f"risk range workbook not found: {RR_WORKBOOK}")
        return {"levels": {}, "_source": None}

    # Add scripts/ dir to path so we can import the sibling module
    scripts_dir = Path(__file__).resolve().parent
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))

    try:
        import import_official_levels as iol
    except ImportError as e:
        warn(f"Could not import import_official_levels: {e}")
        return {"levels": {}, "_source": RR_WORKBOOK.name}

    wb = openpyxl.load_workbook(RR_WORKBOOK, read_only=True, data_only=True)
    all_rows = []
    year_hint = date.today().year

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        if sheet_name in iol.SKIP_SHEETS:
            continue
        try:
            if ws.sheet_state in ('hidden', 'veryHidden'):
                continue
        except AttributeError:
            pass
        sheet_date = iol.sheet_name_to_date(sheet_name, year_hint)
        if not sheet_date:
            continue
        rows, _ = iol.parse_sheet(ws, sheet_date)
        all_rows.extend(rows)

    wb.close()

    # Build latest-only levels dict
    latest_by_ticker: dict = {}
    for row in all_rows:
        t = row['ticker']
        if t not in latest_by_ticker or row['date'] > latest_by_ticker[t]['date']:
            latest_by_ticker[t] = row

    levels = {
        t: {
            "close":  r['close'],
            "lrr":    r['buy'],
            "trr":    r['sell'],
            "signal": r['signal'],
        }
        for t, r in latest_by_ticker.items()
        if r['buy'] or r['sell'] or r['close']
    }

    return {"levels": levels, "_source": RR_WORKBOOK.name}


# ── STAGE 2: PDF EXTRACTION VIA CLAUDE API ────────────────────────────────────

PDF_SOURCES = [
    {
        "key":    "macro_show",
        "folder": HEDGEYE_BASE / "macro show slides",
        "glob":   "HE_TMS_*.pdf",
        "label":  "A: Macro Show Slides",
        "prompt": (
            "Extract these fields from the Hedgeye Macro Show presentation.\n"
            "Return ONLY valid JSON with this exact structure (null for any field not found):\n"
            "{\n"
            '  "quad": {"monthly": <int 1-4>, "quarterly": <int 1-4>, "depth": <"SHALLOW"|"MODERATE"|"DEEP">},\n'
            '  "vix": {"current": <float>, "lrr": <float>, "trr": <float>, "bucket": <"INVESTABLE"|"CAUTION"|"CRASH">},\n'
            '  "cpi_nowcast": <float>,\n'
            '  "growth_roc": <"ACCELERATING"|"DECELERATING">,\n'
            '  "inflation_roc": <"ACCELERATING"|"DECELERATING">,\n'
            '  "quad_sequence": <string showing next 4 quarters e.g. "2-2-2-3">,\n'
            '  "high_beta_1m": <float, 1-month return % for high-beta factor bucket>,\n'
            '  "low_beta_1m": <float, 1-month return % for low-beta factor bucket>,\n'
            '  "keith_commentary": [<up to 5 key bullet points as strings>]\n'
            "}"
        ),
    },
    {
        "key":    "msr",
        "folder": HEDGEYE_BASE / "Market situation report",
        "glob":   "*.pdf",
        "label":  "B: Market Situation Report",
        "prompt": (
            "Extract these fields from the Hedgeye Market Situation Report (MSR) or Weekly Game Plan.\n"
            "Return ONLY valid JSON (null for any field not found):\n"
            "{\n"
            '  "gamma_exposure": <"POSITIVE"|"NEGATIVE"|"NEUTRAL">,\n'
            '  "systematic_flow": <"BUYING"|"SELLING"|"NEUTRAL">,\n'
            '  "pv_band": <"OVERBOUGHT"|"OVERSOLD"|"NEUTRAL">,\n'
            '  "strategic_allocation": <"RISK_ON"|"RISK_OFF"|"NEUTRAL">,\n'
            '  "spx_upper_pv": <float, upper price/volume level for SPX>,\n'
            '  "spx_lower_pv": <float, lower price/volume level for SPX>,\n'
            '  "gex_flip": <float, GEX zero or flip level for SPX>,\n'
            '  "gvt": <float, gamma velocity threshold>,\n'
            '  "realized_vol_10d": <float, 10-day realized volatility %>,\n'
            '  "spx_last": <float, last SPX price>,\n'
            '  "resistance": <float, key near-term resistance level>,\n'
            '  "support": <float, key near-term support level>\n'
            "}"
        ),
    },
    {
        "key":    "sss",
        "folder": HEDGEYE_BASE / "signal strength list",
        "glob":   "*.pdf",
        "label":  "C: Signal Strength List",
        "prompt": (
            "Extract these fields from the Hedgeye Signal Strength Score (SSS) PDF.\n"
            "Return ONLY valid JSON (null for any field not found):\n"
            "{\n"
            '  "count": <int, total number of tickers currently on the signal strength list>,\n'
            '  "added": [<ticker symbols added this week, e.g. ["LOTMY","CMI"]>],\n'
            '  "removed": [<ticker symbols removed this week>],\n'
            '  "tickers": [<every ticker symbol on the list in the order they appear>]\n'
            "}"
        ),
    },
    {
        "key":    "investing_ideas",
        "folder": HEDGEYE_BASE / "Investing Ideas",
        "glob":   "*.pdf",
        "label":  "D: Investing Ideas",
        "prompt": (
            "Extract all current long and short positions from this Hedgeye Investing Ideas newsletter.\n"
            "Return ONLY valid JSON (null for missing fields):\n"
            "{\n"
            '  "longs": {\n'
            '    "<TICKER>": {"lrr": <float lower risk range>, "trr": <float top risk range>, "thesis": <1-2 sentence summary>}\n'
            "  },\n"
            '  "shorts": {\n'
            '    "<TICKER>": {"lrr": <float>, "trr": <float>, "thesis": <1-2 sentence summary>}\n'
            "  }\n"
            "}"
        ),
    },
    {
        "key":    "momo",
        "folder": HEDGEYE_BASE / "Momentum Stock Tracker",
        "glob":   "*.pdf",
        "label":  "E: Momentum Stock Tracker",
        "prompt": (
            "Extract risk range and signal data for every ticker in the Hedgeye Momentum Stock Tracker.\n"
            "Return ONLY valid JSON as a flat object keyed by ticker symbol (null for any missing value):\n"
            "{\n"
            '  "<TICKER>": {"lrr": <float lower risk range>, "trr": <float top risk range>, '
            '"signal": <"BULLISH"|"BEARISH"|"NEUTRAL">, "close": <float last close price>}\n'
            "}"
        ),
    },
    {
        "key":    "gip",
        "folder": HEDGEYE_BASE / "macro research",
        "glob":   "*.pdf",
        "label":  "F: GIP / Inflation Nowcast",
        "prompt": (
            "Extract macro growth and inflation forecast data from this Hedgeye GIP (Growth, Inflation, Policy) "
            "or Nowcast PDF.\n"
            "Return ONLY valid JSON (null for missing fields):\n"
            "{\n"
            '  "cpi_nowcast": <float, current CPI nowcast %>,\n'
            '  "cpi_trend": <"ACCELERATING"|"DECELERATING">,\n'
            '  "forward_quads": {\n'
            '    "<QNYY e.g. 2Q26>": {"quad": <int 1-4>, "gdp": <float % growth>, "cpi": <float % inflation>}\n'
            "  }\n"
            "}"
        ),
    },
    {
        "key":    "crypto",
        "folder": HEDGEYE_BASE / "BTC trend tracker",
        "glob":   "*.pdf",
        "label":  "G: BTC Trend Tracker",
        "prompt": (
            "Extract risk range and signal data for all crypto assets in this Hedgeye BTC Trend Tracker PDF.\n"
            "Return ONLY valid JSON as a flat object keyed by symbol (null for missing values):\n"
            "{\n"
            '  "<SYMBOL e.g. BTC>": {"lrr": <float lower risk range>, "trr": <float top risk range>, '
            '"signal": <"BULLISH"|"BEARISH"|"NEUTRAL">}\n'
            "}"
        ),
    },
    {
        "key":    "founders_choice",
        "folder": HEDGEYE_BASE / "Founders Choice",
        "glob":   "*.pdf",
        "label":  "H: Founders Choice",
        "prompt": (
            "Extract all sector long and short stock picks from this Hedgeye Founders Choice PDF.\n"
            "Return ONLY valid JSON where keys are lowercase sector names (null if not found):\n"
            "{\n"
            '  "<sector e.g. industrials>": {"longs": [<ticker strings>], "shorts": [<ticker strings>]}\n'
            "}"
        ),
    },
    {
        "key":    "macro_show_notes",
        "folder": HEDGEYE_BASE / "macro show slides" / "macro show reports",
        "glob":   "*.pdf",
        "label":  "I: Macro Show Summary Notes",
        "prompt": (
            "Extract key takeaways from this Hedgeye Macro Show summary notes PDF.\n"
            "Return ONLY valid JSON (null for missing fields):\n"
            "{\n"
            '  "key_points": [<up to 5 most important takeaways as strings>],\n'
            '  "positioning_changes": [<any position adds, removes, or trims mentioned>],\n'
            '  "keith_watching": [<catalysts, price levels, or events Keith is watching>]\n'
            "}"
        ),
    },
]


def _call_claude_pdf(client, path: Path, prompt: str, label: str) -> dict | None:
    """Send a single PDF to Claude API and return parsed JSON dict, or None on failure."""
    size_kb = path.stat().st_size // 1024
    print(f"  [API] Sending {path.name} ({size_kb} KB)...")
    try:
        pdf_b64 = base64.standard_b64encode(path.read_bytes()).decode('utf-8')
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=(
                "You are a financial data extractor. Extract ONLY the requested fields from "
                "this Hedgeye research document. Return ONLY valid JSON, no other text."
            ),
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if the model wrapped the response
        if raw.startswith('```'):
            start = raw.index('{')
            end   = raw.rindex('}') + 1
            raw   = raw[start:end]
        result = json.loads(raw)
        print(f"  [API] OK — {len(result)} top-level keys returned")
        return result
    except json.JSONDecodeError as e:
        warn(f"{label}: JSON parse failed — {e}")
        return None
    except Exception as e:
        warn(f"{label}: API error — {e}")
        return None


def extract_pdf_data() -> dict:
    """Stage 2: extract structured data from each PDF source via the Claude API."""
    print("\n── PDF Extraction (Stage 2) ──")

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        warn("ANTHROPIC_API_KEY not set — skipping PDF extraction")
        return {"pdf": {}, "_pdf_sources": {}}

    try:
        import anthropic
    except ImportError:
        warn("anthropic not installed — run: pip install anthropic")
        return {"pdf": {}, "_pdf_sources": {}}

    client = anthropic.Anthropic(api_key=api_key)
    results      = {}
    sources_used = {}

    for src in PDF_SOURCES:
        key   = src["key"]
        label = src["label"]
        print(f"\n  {label}")
        path = newest_file(src["folder"], src["glob"])
        if not path:
            warn(f"{label}: no PDF found — skipping")
            results[key]      = None
            sources_used[key] = None
            continue
        sources_used[key] = path.name
        results[key] = _call_claude_pdf(client, path, src["prompt"], label)

    return {"pdf": results, "_pdf_sources": sources_used}


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Build macro_context.json")
    parser.add_argument(
        '--stage1-only', action='store_true',
        help='Skip PDF extraction (no Claude API calls) — faster for daily Excel/CSV updates',
    )
    args = parser.parse_args()

    stage = "Stage 1 only (--stage1-only)" if args.stage1_only else "Stage 1 + 2"
    print(f"build_macro_context.py — {stage}")
    print(f"Output: {OUTPUT_PATH}\n")

    etf = read_etf_pro()
    ham = read_ham_holdings()
    rta = read_rta_trades()
    rr  = read_risk_range_levels()

    now = datetime.now(tz=timezone.utc)

    sources_used = {
        "etf_pro":      etf.pop("_source"),
        "ham_holdings": ham.pop("_source"),
        "rta":          rta.pop("_source"),
        "risk_range":   rr.pop("_source"),
    }

    output = {
        "generated_at": now.isoformat(),
        "source_date":  date.today().isoformat(),
        "sources_used": sources_used,
        **etf,
        **ham,
        **rta,
        **rr,
    }

    if not args.stage1_only:
        pdf = extract_pdf_data()
        # sources_used is the same dict object referenced inside output, so this updates both
        sources_used.update(pdf.pop("_pdf_sources", {}))
        output.update(pdf)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)

    rta_data = output.get('rta', {})
    pdf_data  = output.get('pdf', {})
    print(f"\n── Summary ──")
    print(f"  etf_rerank:              {len(output.get('etf_rerank', []))} tickers")
    print(f"  active_longs:            {len(output.get('active_longs', []))}")
    print(f"  active_shorts:           {len(output.get('active_shorts', []))}")
    print(f"  ham_holdings:            {len(output.get('ham_holdings', []))} tickers")
    print(f"  rta.recent_trades (90d): {len(rta_data.get('recent_trades', []))}")
    print(f"  rta.recently_traded(60d):{len(rta_data.get('recently_traded_tickers', []))}")
    print(f"  rta.stats:               {rta_data.get('stats', {})}")
    print(f"  levels:                  {len(output.get('levels', {}))} tickers")
    for k, v in pdf_data.items():
        status = "OK" if v is not None else "null/failed"
        print(f"  pdf.{k:<22} {status}")
    print(f"\nWritten: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
