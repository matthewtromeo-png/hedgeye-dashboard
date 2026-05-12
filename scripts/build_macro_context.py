#!/usr/bin/env python3
"""
build_macro_context.py
======================
Stage 1: Excel / CSV sources only (no Claude API).

Sources:
  - etf pro dash board\etf-pro-all-active-tickers-*.xlsx
  - HAM holdings\ETF_Holdings*.csv
  - RTA\real-time-alerts-history-*.csv
  - risk_range_tracker_excelworkbook.xlsx  (reuses import_official_levels logic)

Output: project/data/macro_context.json
"""

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

def newest_file(pattern: str) -> Path | None:
    matches = [Path(p) for p in glob.glob(pattern)]
    if not matches:
        return None
    return max(matches, key=lambda p: p.stat().st_mtime)


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
    pattern = str(HEDGEYE_BASE / "etf pro dash board" / "etf-pro-all-active-tickers-*.xlsx")
    path = newest_file(pattern)
    if not path:
        warn("etf pro: no file found")
        return {"etf_rerank": [], "active_longs": [], "active_shorts": [], "_source": None}

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        warn("etf pro: empty workbook")
        return {"etf_rerank": [], "active_longs": [], "active_shorts": [], "_source": path.name}

    # Find the header row dynamically — it contains 'Ticker' somewhere in first 5 rows
    header_idx = 0
    for i, row in enumerate(rows[:5]):
        if any(str(c or '').strip().lower() == 'ticker' for c in row):
            header_idx = i
            break
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

    return {
        "etf_rerank":    rerank,
        "active_longs":  longs,
        "active_shorts": shorts,
        "_source":       path.name,
    }


# ── HAM HOLDINGS ─────────────────────────────────────────────────────────────

def read_ham_holdings() -> dict:
    pattern = str(HEDGEYE_BASE / "HAM holdings" / "ETF_Holdings*.csv")
    path = newest_file(pattern)
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


def read_rta_trades() -> dict:
    pattern = str(HEDGEYE_BASE / "RTA" / "real-time-alerts-history-*.csv")
    path = newest_file(pattern)
    if not path:
        warn("RTA: no file found")
        return {"rta": {"recent_trades": [], "stats": {}, "recently_traded_tickers": []}, "_source": None}

    today      = date.today()
    cutoff_90d = today - timedelta(days=90)
    cutoff_60d = today - timedelta(days=60)

    all_closed: list = []

    with open(path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            close_date_raw  = (row.get('Close Date')  or '').strip()
            close_price_raw = (row.get('Close Price') or '').strip()
            if not close_date_raw or not close_price_raw:
                continue  # open position — skip

            close_date_str = close_date_raw[:10]
            try:
                close_date = datetime.strptime(close_date_str, '%Y-%m-%d').date()
            except ValueError:
                continue

            symbol   = (row.get('Symbol')   or '').strip()
            position = (row.get('Position') or '').strip().lower()
            if not symbol:
                continue

            open_date_str = (row.get('Open Date') or '')[:10]

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


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    print("build_macro_context.py — Stage 1 (CSV/Excel sources)")
    print(f"Output: {OUTPUT_PATH}\n")

    etf   = read_etf_pro()
    ham   = read_ham_holdings()
    rta   = read_rta_trades()
    rr    = read_risk_range_levels()

    now = datetime.now(tz=timezone.utc)

    output = {
        "generated_at": now.isoformat(),
        "source_date":  date.today().isoformat(),
        "sources_used": {
            "etf_pro":      etf.pop("_source"),
            "ham_holdings": ham.pop("_source"),
            "rta":          rta.pop("_source"),
            "risk_range":   rr.pop("_source"),
        },
        **etf,
        **ham,
        **rta,
        **rr,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)

    rta_data = output.get('rta', {})
    print(f"  etf_rerank:              {len(output['etf_rerank'])} tickers")
    print(f"  active_longs:            {len(output['active_longs'])}")
    print(f"  active_shorts:           {len(output['active_shorts'])}")
    print(f"  ham_holdings:            {len(output['ham_holdings'])} tickers")
    print(f"  rta.recent_trades (90d): {len(rta_data.get('recent_trades', []))}")
    print(f"  rta.recently_traded(60d):{len(rta_data.get('recently_traded_tickers', []))}")
    print(f"  rta.stats:               {rta_data.get('stats', {})}")
    print(f"  levels:                  {len(output['levels'])} tickers")
    print(f"\nWritten: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
