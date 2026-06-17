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


def _ocr_extract_tickers(pdf_path):
    """
    OCR fallback: when pdfplumber can't extract the table (image-only PDF),
    use pypdf + pytesseract to read the embedded slide image and parse rows.

    Returns list of dicts: {ticker, days_on_list, signal_date, entry_price,
    recent_price, pct_since_entry, sector, analyst, ocr_raw, ocr_uncertain}
    """
    try:
        from pypdf import PdfReader
        from PIL import Image
        import pytesseract
        import io as _io
    except ImportError as e:
        print(f"  [WARN] OCR fallback unavailable: {e}")
        return []

    reader = PdfReader(str(pdf_path))
    rows = []
    seen_hashes = set()

    # Row pattern: DAYS  TICKER  DATE  PRICE  PRICE  [rest...]
    # OCR frequently garbles:
    #   - days col:   "28" → "2B", "54" → "5t", "34" → "M"
    #   - dates:      "2/19/2026" → "219/2026", "6/11/2026" → "6112/2026",
    #                 trailing comma "4/10/2026,"
    #   - prices:     digit→letter confusion: "44.5" → "aa", "54.0" → "a4"
    #   - tickers:    mixed-case ("cP","casy"), dropped/swapped chars
    ROW_RE = re.compile(
        r'^([\dA-Za-z]{1,3})\s+'               # days (OCR-noisy: "28","2B","5t","M")
        r'([A-Za-z0-9][A-Za-z0-9./]{0,7}):?\s+'  # ticker + optional trailing colon (leading digit allowed: OCR reads T→1)
        r'([\d/]{4,12}),?\s+'                  # signal date (relaxed: garbled digits/slashes OK, trailing comma OK)
        r'([A-Za-z\d,.]+)[,]?\s+'              # entry price (OCR may garble digits as letters: "aa","a4")
        r'([A-Za-z\d,.]+)'                     # recent price
    )

    # Known OCR misreads — applied after uppercasing ticker.
    # These are empirically observed artifacts from SSS PDF image OCR.
    # Key = garbled OCR result (uppercase); Value = correct ticker.
    OCR_CORRECTIONS = {
        # ── Original corrections ─────────────────────────────────────────
        'CZ':   'CZR',
        'ESX':  'CSX',
        'POS':  'DDOG',
        'TX':   'TXG',
        'OT':   'DT',
        'MOE':  'MDB',
        'MOM':  'MGM',
        'HAY':  'HQY',
        'CRC':  'CFG',
        'KOP':  'KDP',
        'SUM':  'SJM',
        'LV':   'LYV',
        'GT':   'TGT',
        'ET':   'TGT',   # OCR variant of GT→TGT (ET=Energy Transfer doesn't appear on SSS)
        'BURI': 'BJRI',  # BJ's Restaurants — OCR drops J, misreads J→U
        # ── 6/16 PDF additions ───────────────────────────────────────────
        'SX':    'CSX',   # CSX Railroad — alternate OCR drop of leading C (ESX also mapped above)
        'CR':    'CP',    # Canadian Pacific (Jay Van Sciver/Industrials) — CR=Crane unlikely on SSS
        'LO':    'TWLO',  # Twilio (Andrew Freedman/Software) — LO=Lorillard inactive/acquired
        'ATZAF': 'AZTAF', # Letter transposition artifact
        'CRAY':  'CPAY',  # Corpay (Josh Steiner/Financials) — CRAY=Cray Inc acquired by HPE, delisted
        'MEM':   'MGM',   # MGM Resorts — OCR variant of MOM→MGM
        'TET':   'TGT',   # Target — OCR variant of GT/ET→TGT
        'SC':    'SG',    # Sweetgreen (Bennett Cheer/Restaurants) — SC=Santander Consumer unlikely on SSS
        # ── 6/17 PDF additions ───────────────────────────────────────────
        'XG':    'TXG',   # 10x Genomics — alternate OCR drop of leading T (TX also mapped above)
        'PPOS':  'DDOG',  # Datadog — OCR variant of POS→DDOG (non-deterministic P prefix)
        'DPOS':  'DDOG',  # Datadog — OCR variant of POS→DDOG (non-deterministic D prefix)
        '1X6':   'TXG',   # 10x Genomics — OCR reads capital T as digit 1, G as 6
        '1XG':   'TXG',   # 10x Genomics — OCR reads capital T as digit 1
    }

    for page in reader.pages:
        for img_obj in page.images:
            pil = img_obj.image
            if pil is None or pil.size[0] < 400:   # skip tiny logos
                continue
            h = hash(img_obj.data[:512])
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            # Ensure RGB for tesseract
            if pil.mode != 'RGB':
                bg = Image.new('RGB', pil.size, (255, 255, 255))
                if 'A' in pil.mode:
                    bg.paste(pil, mask=pil.split()[-1])
                else:
                    bg.paste(pil)
                pil = bg

            ocr_text = pytesseract.image_to_string(pil, config='--psm 6 --oem 1')

            for line in ocr_text.splitlines():
                line = line.strip().replace("'", "").replace("`", "").replace("‘", "").replace("’", "")
                m = ROW_RE.match(line)
                if not m:
                    continue

                days_raw   = m.group(1)
                ticker_raw = m.group(2)
                date_raw   = m.group(3)
                ep_raw     = m.group(4)
                rp_raw     = m.group(5)

                # Normalize ticker: uppercase, strip trailing punctuation
                ticker = ticker_raw.upper().rstrip('.:,;')
                # Flag if OCR returned mixed/lower case — likely misread
                ocr_uncertain = (ticker_raw != ticker_raw.upper()) or (len(ticker) < 2)
                # Apply known OCR correction map (corrections always flagged as uncertain)
                if ticker in OCR_CORRECTIONS:
                    ticker = OCR_CORRECTIONS[ticker]
                    ocr_uncertain = True

                # Parse signal date
                signal_date = None
                for fmt in ['%m/%d/%Y', '%m/%d/%y']:
                    try:
                        signal_date = datetime.strptime(date_raw, fmt).strftime('%Y-%m-%d')
                        break
                    except ValueError:
                        pass

                def _pp(s):
                    try:
                        return round(float(re.sub(r'[,$%]', '', s.strip())), 2)
                    except Exception:
                        return None

                entry  = _pp(ep_raw)
                recent = _pp(rp_raw)
                pct = None
                if entry and recent and entry > 0:
                    pct = round((recent - entry) / entry * 100, 1)

                # Extract sector/analyst from remainder of line (best-effort)
                remainder = line[m.end():].strip()
                sector = analyst = None
                rem_parts = remainder.split()
                # Sector is usually 1-3 capitalized words before analyst name
                if len(rem_parts) >= 2:
                    # Simple heuristic: sector ends before first name-like word
                    pct_str = rem_parts[0] if rem_parts else ''
                    # Skip pct field if present
                    rest_after_pct = rem_parts[1:] if re.match(r'[\d.]+%?$', pct_str.rstrip('%')) else rem_parts
                    if rest_after_pct:
                        sector = rest_after_pct[0] if rest_after_pct else None

                # Extract leading digits from days field (handles "2B"→2, "5t"→5, "M"→None)
                _dm = re.match(r'(\d+)', days_raw)
                days_int = int(_dm.group(1)) if _dm else None

                rows.append({
                    'ticker':           ticker,
                    'days_on_list':     days_int,
                    'signal_date':      signal_date,
                    'entry_price':      entry,
                    'recent_price':     recent,
                    'pct_since_entry':  pct,
                    'sector':           None,    # OCR sector parsing is unreliable; skip
                    'analyst':          None,
                    'best_idea_rank':   None,
                    'ocr_raw':          line[:120],
                    'ocr_uncertain':    ocr_uncertain,
                })

    print(f"  OCR extracted: {len(rows)} rows from {pdf_path.rsplit('/', 1)[-1]}")
    return rows


def parse_sss_pdf(pdf_path):
    """
    Extract SSS data from a Hedgeye Signal Strength PDF using pdfplumber.
    Falls back to OCR when the table is image-only.
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

    # ── OCR fallback when table extraction yielded nothing ─────────────
    extraction_method  = 'text'
    extraction_warning = None
    ocr_uncertain_list = []

    if len(tickers_detail) < 10:
        print("  Text table extraction yielded 0 rows — trying OCR fallback...")
        try:
            ocr_rows = _ocr_extract_tickers(pdf_path)
            if len(ocr_rows) >= 5:
                for r in ocr_rows:
                    t = r.pop('ocr_raw',    None)   # don't store raw line
                    unc = r.pop('ocr_uncertain', False)
                    ticker = r['ticker']
                    tickers_detail[ticker] = {k: v for k, v in r.items() if k != 'ticker'}
                    if unc:
                        ocr_uncertain_list.append(ticker)
                extraction_method = 'ocr'
                if ocr_uncertain_list:
                    extraction_warning = (
                        f"Ticker list extracted via OCR — {len(ocr_uncertain_list)} symbol(s) "
                        f"may be misread: {', '.join(ocr_uncertain_list)}. "
                        f"Verify against source PDF."
                    )
                else:
                    extraction_warning = "Ticker list extracted via OCR — verify against source PDF if accuracy is critical."
                print(f"  OCR fallback produced {len(tickers_detail)} tickers "
                      f"({len(ocr_uncertain_list)} uncertain)")
            else:
                print("  [WARN] OCR fallback also yielded too few rows — tickers_detail will be cleared")
                tickers_detail = {}
                extraction_method  = 'failed'
                extraction_warning = (
                    "Full ticker list could not be extracted (table is image-only and OCR produced insufficient results). "
                    "Showing count/added/removed only."
                )
        except Exception as e:
            print(f"  [WARN] OCR fallback failed: {e}")
            tickers_detail = {}
            extraction_method  = 'failed'
            extraction_warning = f"Ticker extraction failed: {e}. Showing count/added/removed only."

    # ── Count validation ────────────────────────────────────────────────
    # Strict check: header count must equal number of extracted tickers.
    # A mismatch means OCR missed rows or the corrections map has gaps.
    # We warn but still return the extracted data (never discard partial results
    # — caller can decide how to handle a mismatch).
    count_match = True
    if count is not None and len(tickers_detail) > 0:
        if len(tickers_detail) != count:
            count_match = False
            mismatch_msg = (
                f"Count mismatch: header says {count} stocks, "
                f"extracted {len(tickers_detail)}. "
                f"Possible OCR miss or unresolved misread in OCR_CORRECTIONS."
            )
            print(f"  [WARN] {mismatch_msg}")
            if extraction_warning:
                extraction_warning += f" {mismatch_msg}"
            else:
                extraction_warning = mismatch_msg

    return {
        'count':              count or len(tickers_detail),
        'added':              added,
        'removed':            removed,
        'date_str':           date_str,
        'tickers_detail':     tickers_detail,
        'extraction_method':  extraction_method,
        'extraction_warning': extraction_warning,
        'ocr_uncertain':      ocr_uncertain_list,
        'count_match':        count_match,
    }


def main():
    pdf_path = find_latest_sss_pdf()
    if not pdf_path:
        print(f'[ERROR] No SSS PDFs found in {SSS_DIR}')
        return
    print(f'SSS PDF     : {os.path.basename(pdf_path)}')

    result = parse_sss_pdf(pdf_path)
    if not result:
        return

    count   = result['count']
    added   = result['added']
    removed = result['removed']
    date_str = result['date_str']
    td      = result['tickers_detail']

    print(f'Date        : {date_str}')
    print(f'Count       : {count}')
    print(f'Added       : {added}')
    print(f'Removed     : {removed}')
    print(f'Tickers     : {len(td)}')

    extraction_method  = result.get('extraction_method', 'text')
    extraction_warning = result.get('extraction_warning')
    ocr_uncertain      = result.get('ocr_uncertain', [])

    print(f'Extraction  : {extraction_method}'
          + (f'  [{len(ocr_uncertain)} uncertain]' if ocr_uncertain else ''))
    if extraction_warning:
        print(f'[WARN] {extraction_warning}')

    # ── Update macro_context.json ───────────────────────
    ctx = safe_read_ctx(CTX_PATH, ONEDRIVE_CTX)
    sss = ctx.setdefault('pdf', {}).setdefault('sss', {})

    if len(td) >= 5:
        existing = dict(td)
        for t in removed:
            existing.pop(t, None)
        sss['tickers_detail'] = existing
        sss['tickers']        = list(existing.keys())
    else:
        print('[WARN] Clearing tickers_detail — current extraction failed. UI will show warning.')
        sss['tickers_detail'] = {}
        sss['tickers']        = []

    sss['extraction_method']  = extraction_method
    sss['extraction_warning'] = extraction_warning
    sss['ocr_uncertain']      = ocr_uncertain
    sss['count']   = count
    sss['added']   = added
    sss['removed'] = removed
    sss['as_of']   = date_str

    history = ctx.setdefault('sss_history', [])
    existing_dates = {h['date'] for h in history}
    if date_str not in existing_dates:
        history.append({'date': date_str, 'count': count, 'added': added, 'removed': removed})
        history.sort(key=lambda x: x['date'])
    else:
        for h in history:
            if h['date'] == date_str:
                h.update({'count': count, 'added': added, 'removed': removed})

    tmp_path = CTX_PATH + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(ctx, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, CTX_PATH)
    print(f'Updated     : macro_context.json  (pdf.sss + sss_history)')
    print('\nDone.')


if __name__ == '__main__':
    main()
