#!/usr/bin/env python3
"""
process_ham.py — HAM Holdings pipeline
- Fetches latest ETF_Holdings from S3 (authoritative source) — falls back to local CSV
- Reads all local ETF_Holdings CSVs to compute first-seen date per ticker per fund
- Diffs latest vs yesterday + ~7 days ago for daily/weekly flows
- Writes ham_holdings_latest.csv to repo data folder
- Updates macro_context.json with:
    ham_per_fund  — per-fund holdings with days_held
    ham_deltas    — daily/weekly adds/removes + per-fund breakdown
    ham_first_seen — first date each ticker appeared in each fund

Run from repo root: python scripts/process_ham.py
"""

import csv, io, json, os, glob, shutil, urllib.request  # shutil kept for fallback copy path
from datetime import datetime, timedelta

# Authoritative live source — always use this when reachable
S3_URL = "https://hedgeye.s3.us-east-1.amazonaws.com/ham/ETF_Holdings.csv"

# ── Paths ──────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT   = os.path.dirname(SCRIPT_DIR)
ONEDRIVE    = r"C:\Users\matth\OneDrive\Desktop\Trading"
HAM_DIR     = os.path.join(ONEDRIVE, "hedgeye", "HAM holdings")
DATA_DIR    = os.path.join(REPO_ROOT, "project", "data")
CTX_PATH    = os.path.join(DATA_DIR, "macro_context.json")
OUT_CSV     = os.path.join(DATA_DIR, "ham_holdings_latest.csv")

FUNDS = ['HECA', 'HEFT', 'HGRO', 'HELS', 'ADDS']

# Fund strategy descriptions — shown in the Flows tab
FUND_STRATEGY = {
    'HECA': 'Macro ETFs & Fiji paper portfolios — broad macro themes, sector ETFs aligned with Hedgeye quads',
    'HEFT': 'Equity factor tilts — growth/value/momentum via Hedgeye quad framework',
    'HGRO': 'Growth equities — high-conviction S-curve & secular growth names',
    'HELS': 'Individual equities — SSS ideas, position monitors, call conversation picks',
    'ADDS': 'Recent additions across all funds',
}

# ── Helpers ────────────────────────────────────────────────────────────
def parse_date_from_filename(path):
    """Parse date from ETF_Holdings M.D.YYYY.csv filename."""
    name = os.path.basename(path)
    stem = (name
        .replace('ETF_Holdings ', '')
        .replace('ETF_Holdings', '')
        .replace('.csv', '')
        .strip())
    current_year = datetime.now().year
    for fmt in ['%m.%d.%Y', '%m.%d.%y']:
        try:
            d = datetime.strptime(stem, fmt)
            # Filter out mislabeled files (year more than 1 year in the future)
            if d.year > current_year + 1:
                return None
            return d
        except ValueError:
            pass
    return None


def find_csvs():
    """Return sorted list of (date, path) for all valid ETF_Holdings CSVs."""
    patterns = [
        os.path.join(HAM_DIR, 'ETF_Holdings *.csv'),
        os.path.join(HAM_DIR, 'ETF_Holdings*.csv'),
    ]
    seen, result = set(), []
    for pat in patterns:
        for p in glob.glob(pat):
            d = parse_date_from_filename(p)
            if d and p not in seen:
                seen.add(p)
                result.append((d, p))
    return sorted(result, key=lambda x: x[0])


def read_csv(path):
    rows = []
    with open(path, 'r', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            rows.append(r)
    return rows


def is_derivative(ticker):
    """Return True for swap/TRS/option/CUSIP-based instruments — not real ETF holdings."""
    if not ticker:
        return True
    # Swaps and TRS: contain '-TRS-' or '-SWAP-' in the ticker string
    if '-TRS-' in ticker or '-SWAP-' in ticker:
        return True
    # Options: look like 'SPY 260717P00610000' (ticker + space + date + P/C + strike)
    if ' ' in ticker:
        return True
    # Pure CUSIP (9 digit/alpha string) — no valid ticker is 9+ chars without letters mix
    if len(ticker) > 8 and ticker[:6].isdigit():
        return True
    return False


def extract_fund_tickers(rows):
    """Return {fund: set(tickers)} from a CSV's rows, excluding cash/MM/derivatives."""
    result = {}
    for r in rows:
        fund = r.get('Account', '').strip()
        if fund not in FUNDS:
            continue
        ticker = r.get('StockTicker', '').strip()
        if not ticker:
            continue
        is_cash = ticker in ('Cash&Other',) or r.get('MoneyMarketFlag', '') == 'Y'
        if not is_cash and not is_derivative(ticker):
            result.setdefault(fund, set()).add(ticker)
    return result


def build_per_fund_holdings(rows):
    """Build {fund: {ticker: {weight, price, name, mv}}}."""
    funds = {}
    for r in rows:
        fund = r.get('Account', '').strip()
        if fund not in FUNDS:
            continue
        ticker = r.get('StockTicker', '').strip()
        if not ticker:
            continue
        is_cash = ticker in ('Cash&Other',) or r.get('MoneyMarketFlag', '') == 'Y'
        if is_cash or is_derivative(ticker):
            continue
        try:
            weight = float(r.get('Weightings', '0').replace('%', '').strip()) / 100
        except:
            weight = 0
        try:
            price = round(float(r.get('Price', '0').replace('$', '').replace(',', '').strip()), 4)
        except:
            price = 0
        try:
            mv = float(r.get('MarketValue', '0').replace(',', '').strip())
        except:
            mv = 0
        name = r.get('SecurityName', '').strip()
        funds.setdefault(fund, {})[ticker] = {
            'weight': weight, 'price': price, 'name': name, 'mv': mv
        }
    return funds


def build_combined(per_fund):
    """Deduplicated ticker set across all funds (best weight wins)."""
    combined = {}
    for fund, holdings in per_fund.items():
        for ticker, h in holdings.items():
            if ticker not in combined or h['weight'] > combined[ticker]['weight']:
                combined[ticker] = {**h, 'ticker': ticker}
    return combined


def compute_deltas(curr_per_fund, prev_per_fund):
    """
    Diff two per-fund snapshots.
    Returns (daily_dict, added[], removed[], pf_adds{}, pf_removes{})
    """
    curr_combined = build_combined(curr_per_fund)
    prev_combined = build_combined(prev_per_fund)

    curr_tickers = set(curr_combined)
    prev_tickers = set(prev_combined)
    added   = sorted(curr_tickers - prev_tickers)
    removed = sorted(prev_tickers - curr_tickers)

    delta_dict = {}
    for t in added:
        delta_dict[t] = {'added': True, 'curr_weight': round(curr_combined[t]['weight'], 4)}
    for t in removed:
        delta_dict[t] = {'removed': True, 'prev_weight': round(prev_combined[t]['weight'], 4)}
    for t in curr_tickers & prev_tickers:
        d = curr_combined[t]['weight'] - prev_combined[t]['weight']
        if abs(d) > 0.0005:
            delta_dict[t] = {
                'delta': round(d, 4),
                'curr_weight': round(curr_combined[t]['weight'], 4),
                'prev_weight': round(prev_combined[t]['weight'], 4),
            }

    pf_adds    = {}
    pf_removes = {}
    for fund in FUNDS:
        curr_f = set(curr_per_fund.get(fund, {}))
        prev_f = set(prev_per_fund.get(fund, {}))
        pf_adds[fund]    = sorted(curr_f - prev_f)
        pf_removes[fund] = sorted(prev_f - curr_f)

    return delta_dict, added, removed, pf_adds, pf_removes


# ── Main ───────────────────────────────────────────────────────────────
def main():
    csvs = find_csvs()

    # ── Step 1: Local CSV is authoritative — S3 only if no local file ────
    # The manually-downloaded ETF_Holdings CSVs are the ground truth.
    # S3 is a fallback for when no local file exists for today.
    if csvs:
        latest_date, latest_path = csvs[-1]
        today_str = latest_date.strftime('%Y-%m-%d')
        latest_rows = read_csv(latest_path)
        print(f"Local CSV   : {os.path.basename(latest_path)} ({today_str})")
        os.makedirs(DATA_DIR, exist_ok=True)
        shutil.copy2(latest_path, OUT_CSV)
        print(f"Copied      : {os.path.basename(latest_path)} → ham_holdings_latest.csv")
    else:
        # No local CSV — try S3
        print("[INFO] No local CSVs found — trying S3...")
        s3_raw = None
        s3_rows = None
        try:
            req = urllib.request.Request(S3_URL, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                s3_raw = r.read().decode('utf-8-sig')
            s3_rows = list(csv.DictReader(io.StringIO(s3_raw)))
            print(f"S3 fetch OK : {len(s3_rows)} rows")
        except Exception as e:
            print(f"[ERROR] S3 fetch failed ({e})")
            return
        raw_date = s3_rows[0].get('Date', '').strip()
        try:
            latest_date = datetime.strptime(raw_date, '%m/%d/%Y')
        except ValueError:
            latest_date = datetime.now()
        latest_rows = s3_rows
        today_str = latest_date.strftime('%Y-%m-%d')
        print(f"S3 date     : {today_str}")
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
            f.write(s3_raw)
        print(f"Written     : ham_holdings_latest.csv  (from S3)")

    # ── Step 2: Scan ALL local CSVs for first_seen dates ──────────────
    # (S3 gives us today's snapshot; local history gives us when each ticker
    #  first appeared so we can compute days_held accurately)
    if not csvs:
        print("[WARN] No local CSVs found — first_seen will default to today")
        csvs = [(latest_date, None)]
    print(f"Scanning {len(csvs)} local CSVs for first-seen dates...")
    first_seen = {f: {} for f in FUNDS}
    for d, p in csvs:
        if p is None:
            continue
        date_str = d.strftime('%Y-%m-%d')
        fund_tickers = extract_fund_tickers(read_csv(p))
        for fund, tickers in fund_tickers.items():
            for ticker in tickers:
                if ticker not in first_seen[fund]:
                    first_seen[fund][ticker] = date_str

    # Also seed first_seen from S3/latest rows for any ticker not yet seen locally
    # (handles tickers that are new today and don't appear in any local file)
    s3_fund_tickers = extract_fund_tickers(latest_rows)
    for fund, tickers in s3_fund_tickers.items():
        for ticker in tickers:
            if ticker not in first_seen[fund]:
                first_seen[fund][ticker] = today_str

    # ── Step 3: Build current per-fund holdings from latest data ───────
    curr_per_fund = build_per_fund_holdings(latest_rows)

    # ── Step 4: Daily diff (vs previous local CSV) ────────────────────
    # Find the most recent local CSV that predates today's S3 date
    prev_csvs = [(d, p) for d, p in csvs if p and d.date() < latest_date.date()]
    prev_daily = prev_csvs[-1] if prev_csvs else None
    prev_daily_per_fund = build_per_fund_holdings(read_csv(prev_daily[1])) if prev_daily else {}
    daily_dict, daily_added, daily_removed, pf_daily_adds, pf_daily_removes = (
        compute_deltas(curr_per_fund, prev_daily_per_fund))

    # ── Step 5: Weekly diff (~7 days ago) ─────────────────────────────
    target_weekly = latest_date - timedelta(days=7)
    weekly_candidates = [(d, p) for d, p in csvs if p and d.date() < latest_date.date()]
    weekly_csv = (min(weekly_candidates, key=lambda x: abs((x[0] - target_weekly).days))
                  if weekly_candidates else None)
    prev_weekly_per_fund = build_per_fund_holdings(read_csv(weekly_csv[1])) if weekly_csv else {}
    weekly_dict, weekly_added, weekly_removed, pf_weekly_adds, pf_weekly_removes = (
        compute_deltas(curr_per_fund, prev_weekly_per_fund))

    # ── ham_per_fund with days_held ────────────────────────────────────
    ham_per_fund = {'date': today_str, 'fund_strategy': FUND_STRATEGY}
    for fund, holdings in curr_per_fund.items():
        fund_list = []
        for ticker, h in sorted(holdings.items(), key=lambda x: -x[1]['weight']):
            fs = first_seen.get(fund, {}).get(ticker)
            if fs:
                days_held = (latest_date - datetime.strptime(fs, '%Y-%m-%d')).days
            else:
                days_held = 0
            fund_list.append({
                'ticker':    ticker,
                'name':      h['name'],
                'weight':    round(h['weight'] * 100, 2),
                'price':     h['price'],
                'mv':        h['mv'],
                'first_seen': fs,
                'days_held': days_held,
            })
        ham_per_fund[fund] = fund_list

    # ── ham_deltas ─────────────────────────────────────────────────────
    # Annotate per_fund_daily_adds with days_held + first_seen
    def annotate_adds(pf_adds_dict, per_fund_h, fs_dict, curr_date):
        result = {}
        for fund, tickers in pf_adds_dict.items():
            if not tickers:
                continue
            annotated = []
            for t in tickers:
                fs = fs_dict.get(fund, {}).get(t)
                days = (curr_date - datetime.strptime(fs, '%Y-%m-%d')).days if fs else 0
                h = per_fund_h.get(fund, {}).get(t, {})
                annotated.append({
                    'ticker': t,
                    'name': h.get('name', ''),
                    'weight': round(h.get('weight', 0) * 100, 2),
                    'first_seen': fs,
                    'days_held': days,
                })
            result[fund] = annotated
        return result

    pf_daily_adds_ann  = annotate_adds(pf_daily_adds,  curr_per_fund, first_seen, latest_date)
    pf_weekly_adds_ann = annotate_adds(pf_weekly_adds, curr_per_fund, first_seen, latest_date)

    ham_deltas = {
        'date':                    today_str,
        'prev_date':               prev_daily[0].strftime('%Y-%m-%d') if prev_daily else None,
        'prev_weekly_date':        weekly_csv[0].strftime('%Y-%m-%d') if weekly_csv else None,
        'daily_added':             daily_added,
        'daily_removed':           daily_removed,
        'weekly_added':            weekly_added,
        'weekly_removed':          weekly_removed,
        'daily':                   daily_dict,
        'weekly':                  weekly_dict,
        'per_fund_daily_adds':     pf_daily_adds_ann,
        'per_fund_daily_removes':  {f: v for f, v in pf_daily_removes.items() if v},
        'per_fund_weekly_adds':    pf_weekly_adds_ann,
        'per_fund_weekly_removes': {f: v for f, v in pf_weekly_removes.items() if v},
        'fund_strategy':           FUND_STRATEGY,
    }

    # ── Print summary ──────────────────────────────────────────────────
    print(f"\nDaily  : +{len(daily_added)} added, -{len(daily_removed)} removed, "
          f"{len([v for v in daily_dict.values() if 'delta' in v])} weight shifts")
    print(f"Weekly : +{len(weekly_added)} added, -{len(weekly_removed)} removed")
    non_empty = {f: [x['ticker'] for x in v] for f,v in pf_daily_adds_ann.items()}
    if non_empty:
        print(f"Per-fund daily adds: {non_empty}")
    else:
        print("Per-fund daily adds: none (no new tickers vs yesterday)")
