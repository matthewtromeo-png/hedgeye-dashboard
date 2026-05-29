#!/usr/bin/env python3
"""
process_sss.py — Signal Strength Stocks pipeline
- Scans Trading/hedgeye/signal strength list/ for the latest SSS PDF
- Extracts: count, added, removed, and full per-ticker metadata
  (signal_date, entry_price, recent_price, pct_since_entry, sector, analyst, days_on_list)
- Updates macro_context.json:  pdf.sss.tickers_detail, pdf.sss.added/removed/count
                                sss_history (appends today's snapshot)
- Removed tickers are DELETED from tickers_detail so they never appear in the table

Run from repo root: python scripts/process_sss.py
"""

import csv, io, json, os, glob, re, logging
from datetime import datetime

# Suppress pdfminer font warnings (FontBBox errors are cosmetic, not fatal)
logging.getLogger("pdfminer").setLevel(logging.ERROR)

# ── Paths ──────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
# Always write to the git repo, NOT OneDrive — avoids OneDrive sync corruption
REPO_DATA_DIR    = r'C:\repos\hedgeye-dashboard\project\data'
ONEDRIVE_CTX     = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'project', 'data', 'macro_context.json'))

def safe_read_ctx(write_path, fallback_path):
    """Read macro_context.json: try repo first, fall back to OneDrive if repo is missing/corrupt."""
    import json as _json
    for label, p in [('repo', write_path), ('OneDrive', fallback_path)]:
        if not os.path.exists(p):
            continue
        try:
            with open(p, 'r', encoding='utf-8') as _f:
                return _json.load(_f)
        except Exception as e:
            print(f"  [WARN] Could not read {label} JSON ({p}): {e}")
    print("  [ERROR] No readable macro_context.json found — starting fresh")
    return {}
ONEDRIVE   = r"C:\Users\matth\OneDrive\Desktop\Trading"
SSS_DIR    = os.path.join(ONEDRIVE, "hedgeye", "signal strength list")
DATA_DIR   = REPO_DATA_DIR  # write directly to repo, not OneDrive
CTX_PATH   = os.path.join(DATA_DIR, "macro_context.json")


def find_latest_sss_pdf():
    """Return path to the most recently modified SSS PDF in SSS_DIR."""
    pdfs = glob.glob(os.path.join(SSS_DIR, "*.pdf"))
    if not pdfs:
        return None
    return max(pdfs, key=os.path.getmtime)


def parse_sss_pdf(pdf_path):
    """
    Extract SSS data from a Hedgeye Signal Strength PDF using pdfplumber.
    Returns dict with: count, added[], removed[], tickers_detail{}, date_str
    """
    try:
        import pdfplumber
    except ImportError:
        print("[ERROR] pdfplumber not installed. Run: pip install pdfplumber --break-system-packages")
        return None

    added   = []
    removed = []
    count   = None
    date_str = datetime.now().strftime('%Y-%m-%d')
    tickers_detail = {}

    with pdfplumber.open(pdf_path) as pdf:
        # ── Page 1: header — count, added, removed, date ────────────────
        p1_text = pdf.pages[0].extract_text() or ''
        # Date e.g. "05/28/26 12:49PM EDT"
        date_m = re.search(r'(\d{2}/\d{2}/\d{2,4})', p1_text)
        if date_m:
            raw = date_m.group(1)
            for fmt in ['%m/%d/%Y', '%m/%d/%y']:
                try:
                    date_str = datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
                    break
                except ValueError:
                    pass
        # Count e.g. "85 Stocks (2 Added, 2 Removed)"
        cnt_m = re.search(r'(\d+)\s+Stocks?', p1_text)
        if cnt_m:
            count = int(cnt_m.group(1))
        # Added / Removed
        add_m = re.search(r'Added:\s*([A-Z0-9,\s]+?)(?=Removed:|$)', p1_text, re.IGNORECASE)
        if add_m:
            added = [t.strip() for t in add_m.group(1).split(',') if t.strip() and re.match(r'^[A-Z]{1,6}$', t.strip())]
        rem_m = re.search(r'Removed:\s*([A-Z0-9,\s]+?)(?=\n|$)', p1_text, re.IGNORECASE)
        if rem_m:
            removed = [t.strip() for t in rem_m.group(1).split(',') if t.strip() and re.match(r'^[A-Z]{1,6}$', t.strip())]

        # ── Pages 2+: ticker table ───────────────────────────────────────
        for page in pdf.pages[1:]:
            rows = page.extract_table()
            if not rows:
                continue
            for row in rows:
                if not row or len(row) < 3:
                    continue
                # Row format: [Days, Ticker, Signal Date, Entry Price, Recent Price, %, Sector, Analyst, Rank]
                # or similar — find ticker column
                ticker = None
                days_raw = None
                sig_date_raw = None
                entry_raw = None
                recent_raw = None
                sector_raw = None
                analyst_raw = None
                rank_raw = None

                # Try to identify columns from row content
                # Row is a list; find ticker (1-6 uppercase letters)
                for ci, cell in enumerate(row):
                    if cell and re.match(r'^[A-Z]{1,6}$', str(cell).strip()):
                        ticker = str(cell).strip()
                        # Columns around ticker
                        if ci > 0: days_raw    = str(row[ci-1]).strip() if row[ci-1] else None
                        if ci+1 < len(row): sig_date_raw = str(row[ci+1]).strip() if row[ci+1] else None
                        if ci+2 < len(row): entry_raw    = str(row[ci+2]).strip() if row[ci+2] else None
                        if ci+3 < len(row): recent_raw   = str(row[ci+3]).strip() if row[ci+3] else None
                        if ci+5 < len(row): sector_raw   = str(row[ci+5]).strip() if row[ci+5] else None
                        if ci+6 < len(row): analyst_raw  = str(row[ci+6]).strip() if row[ci+6] else None
                        if ci+7 < len(row): rank_raw     = str(row[ci+7]).strip() if row[ci+7] else None
                        break

                if not ticker:
                    continue

                # Parse days
                days = None
                if days_raw:
                    dm = re.search(r'(\d+)', days_raw)
                    if dm:
                        days = int(dm.group(1))

                # Parse signal_date
                signal_date = None
                if sig_date_raw:
                    for fmt in ['%m/%d/%Y', '%m/%d/%y', '%Y-%m-%d']:
                        try:
                            signal_date = datetime.strptime(sig_date_raw, fmt).strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            pass

                # Parse prices
                def parse_price(s):
                    if not s: return None
                    try:
                        return round(float(re.sub(r'[,$%]','',s).strip()), 2)
                    except:
                        return None

                entry_price  = parse_price(entry_raw)
                recent_price = parse_price(recent_raw)
                pct = None
                if entry_price and recent_price and entry_price > 0:
                    pct = round((recent_price - entry_price) / entry_price * 100, 1)

                tickers_detail[ticker] = {
                    'signal_date':      signal_date,
                    'entry_price':      entry_price,
                    'recent_price':     recent_price,
                    'pct_since_entry':  pct,
                    'days_on_list':     days,
                    'sector':           sector_raw if sector_raw and sector_raw not in ('None','') else None,
                    'analyst':          analyst_raw if analyst_raw and analyst_raw not in ('None','') else None,
                    'best_idea_rank':   rank_raw if rank_raw and rank_raw not in ('None','') else None,
                }

    return {
        'count':          count or len(tickers_detail),
        'added':          added,
        'removed':        removed,
        'date_str':       date_str,
        'tickers_detail': tickers_detail,
    }


def main():
    pdf_path = find_latest_sss_pdf()
    if not pdf_path:
        print(f"[ERROR] No SSS PDFs found in {SSS_DIR}")
        return
    print(f"SSS PDF     : {os.path.basename(pdf_path)}")

    result = parse_sss_pdf(pdf_path)
    if not result:
        return

    count   = result['count']
    added   = result['added']
    removed = result['removed']
    date_str = result['date_str']
    td      = result['tickers_detail']

    print(f"Date        : {date_str}")
    print(f"Count       : {count}")
    print(f"Added       : {added}")
    print(f"Removed     : {removed}")
    print(f"Tickers     : {len(td)}")

    if len(td) < 10:
        print("[WARN] Very few tickers extracted — PDF may be image-only or table format changed.")
        print("       Keeping existing tickers_detail and only updating added/removed/count/history.")

    # ── Update macro_context.json ───────────────────────────────────────
    ctx = safe_read_ctx(CTX_PATH, ONEDRIVE_CTX)

    sss = ctx.setdefault('pdf', {}).setdefault('sss', {})

    if len(td) >= 10:
        # Full update: merge new data into existing tickers_detail
        existing = sss.get('tickers_detail', {})
        # Remove tickers that are no longer on the list
        for t in removed:
            existing.pop(t, None)
        # Merge new data (preserves any extra fields we've manually added)
        for t, data in td.items():
            if t not in existing:
                existing[t] = data
            else:
                # Update mutable fields but preserve ones not in PDF
                existing[t].update({k: v for k, v in data.items() if v is not None})
        sss['tickers_detail'] = existing
        sss['tickers']  = list(td.keys())
    else:
        # Partial update: just remove the removed tickers
        existing = sss.get('tickers_detail', {})
        for t in removed:
            existing.pop(t, None)
        sss['tickers_detail'] = existing

    sss['count']   = count
    sss['added']   = added
    sss['removed'] = removed
    sss['as_of']   = date_str

    # Append to sss_history (avoid duplicates for same date)
    history = ctx.setdefault('sss_history', [])
    existing_dates = {h['date'] for h in history}
    if date_str not in existing_dates:
        history.append({'date': date_str, 'count': count, 'added': added, 'removed': removed})
        history.sort(key=lambda x: x['date'])
    else:
        for h in history:
            if h['date'] == date_str:
                h.update({'count': count, 'added': added, 'removed': removed})

    # ── Atomic write with fsync ────────────────────────────────────────
    tmp_path = CTX_PATH + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(ctx, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, CTX_PATH)
    print(f"Updated     : macro_context.json  (pdf.sss + sss_history)")
    print("\nDone.")


if __name__ == '__main__':
    main()
