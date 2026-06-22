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




# ── Price repair constants ──────────────────────────────────────────────────
_SUSPICIOUS_RATIO_MAX = 4.0    # entry/reference > this → suspicious
_SUSPICIOUS_RATIO_MIN = 0.25   # entry/reference < this → suspicious
_PLAUSIBLE_MIN        = 0.18   # corrected/reference ≥ this → plausible
_PLAUSIBLE_MAX        = 5.5    # corrected/reference ≤ this → plausible

def fetch_live_prices(tickers):
    """Fetch current market prices via yfinance. Returns {ticker: price} or {}."""
    try:
        import yfinance as yf
    except ImportError:
        print("  [INFO] yfinance not installed — decimal repair uses PDF internal ratios only")
        return {}

    tickers_list = [t for t in tickers if t]
    prices = {}
    try:
        import pandas as pd
        raw = yf.download(tickers_list, period='5d', auto_adjust=True, progress=False)
        if not raw.empty:
            # MultiIndex columns when multiple tickers
            if isinstance(raw.columns, pd.MultiIndex):
                close = raw['Close'].ffill().iloc[-1]
            else:
                close = raw['Close'].ffill().iloc[-1]
            for t in tickers_list:
                try:
                    v = close[t] if t in close.index else None
                    if v is not None and not pd.isna(v) and float(v) > 0:
                        prices[t] = round(float(v), 2)
                except (KeyError, TypeError, ValueError):
                    pass
    except Exception as e:
        print(f"  [WARN] yfinance batch failed: {e}")

    # Fill gaps via fast_info
    missing = [t for t in tickers_list if t not in prices]
    for t in missing[:20]:   # cap at 20 individual calls
        try:
            fi = yf.Ticker(t).fast_info
            p = getattr(fi, 'last_price', None) or getattr(fi, 'regular_market_price', None)
            if p and float(p) > 0:
                prices[t] = round(float(p), 2)
        except Exception:
            pass

    print(f"  Live prices fetched: {len(prices)}/{len(tickers_list)} via yfinance")
    return prices


def _repair_one_price(raw, reference, label='price'):
    """
    Test whether raw price has an OCR decimal error vs reference.
    Returns (corrected, factor, reason, status)
      status: 'ok' | 'corrected' | 'unresolved'
    """
    if raw is None or reference is None or reference <= 0 or raw <= 0:
        return raw, None, None, 'ok'

    ratio = raw / reference
    if _SUSPICIOUS_RATIO_MIN <= ratio <= _SUSPICIOUS_RATIO_MAX:
        return raw, None, None, 'ok'

    # Suspicious — try /10, /100, *10 in that order
    for factor, candidate in [(10, raw / 10), (100, raw / 100), (-10, raw * 10)]:
        candidate = round(candidate, 4)
        if candidate <= 0:
            continue
        c_ratio = candidate / reference
        if _PLAUSIBLE_MIN <= c_ratio <= _PLAUSIBLE_MAX:
            fstr = f"raw/{factor}" if factor > 0 else f"raw*{abs(factor)}"
            reason = (
                f"{label} raw={raw} (ratio={ratio:.2f}x ref); "
                f"{fstr}={candidate:.2f} → ratio={c_ratio:.2f}x (plausible)"
            )
            return round(candidate, 2), factor, reason, 'corrected'

    reason = (
        f"{label} raw={raw} (ratio={ratio:.2f}x ref={reference}); "
        "no /10, /100, *10 candidate restores plausible ratio"
    )
    return raw, None, reason, 'unresolved'


def repair_sss_prices(tickers_detail, data_dir=None):
    """
    Audit and auto-repair OCR decimal errors in SSS signal prices.

    Strategy:
    - With live prices (yfinance): use live price as reference for both entry and recent.
      This catches "both-off-same-factor" cases like MGM where entry=425, recent=479
      are both 10x too high but the internal ratio looks fine.
    - Without live prices: use the internal entry/recent ratio to determine which
      price has the decimal error:
        entry >> recent (ratio > 4): entry is likely 10x too high → repair entry
        recent >> entry (ratio > 4): recent is likely 10x too high → repair recent
      This catches one-sided OCR errors without internet access.

    Returns:
      enriched_detail : tickers_detail dict with repair fields added
      audit           : list of audit rows
      unresolved      : list of tickers with unresolved suspicious prices
    """
    tickers = list(tickers_detail.keys())
    live_prices = fetch_live_prices(tickers)
    has_live = bool(live_prices)

    enriched = {}
    audit    = []
    unresolved = []

    for ticker, info in tickers_detail.items():
        entry_raw  = info.get('entry_price')
        recent_raw = info.get('recent_price')
        live_price = live_prices.get(ticker)

        entry_c = entry_raw
        recent_c = recent_raw
        entry_factor = recent_factor = None
        entry_reason = recent_reason = None
        entry_status = recent_status = 'ok'

        if live_price:
            # ── Best path: live price available ──────────────────────────
            # Use live price as independent reference for both prices.
            entry_c, entry_factor, entry_reason, entry_status = \
                _repair_one_price(entry_raw, live_price, f"{ticker}/entry")
            recent_c, recent_factor, recent_reason, recent_status = \
                _repair_one_price(recent_raw, live_price, f"{ticker}/recent")

        elif entry_raw and recent_raw and entry_raw > 0 and recent_raw > 0:
            # ── Fallback: use internal entry/recent ratio ─────────────────
            # Determine WHICH price is likely the OCR error based on ratio.
            internal_ratio = entry_raw / recent_raw
            if internal_ratio > _SUSPICIOUS_RATIO_MAX:
                # entry much larger than recent → entry is the OCR error
                entry_c, entry_factor, entry_reason, entry_status = \
                    _repair_one_price(entry_raw, recent_raw, f"{ticker}/entry")
                # recent is our reference — don't repair it
            elif internal_ratio < _SUSPICIOUS_RATIO_MIN:
                # recent much larger than entry → recent is the OCR error
                recent_c, recent_factor, recent_reason, recent_status = \
                    _repair_one_price(recent_raw, entry_raw, f"{ticker}/recent")
                # entry is our reference — don't repair it
            # else: ratio is plausible — no repair needed (both-off-same-factor
            # cases like MGM are NOT detectable without live prices)

        # Overall status
        any_corrected  = (entry_status == 'corrected' or recent_status == 'corrected')
        any_unresolved = (entry_status == 'unresolved' or recent_status == 'unresolved')
        if any_unresolved:
            overall = 'unresolved'
            unresolved.append(ticker)
        elif any_corrected:
            overall = 'corrected'
        else:
            overall = 'ok'

        # Recompute pct with corrected values
        pct_corrected = None
        if entry_c and recent_c and entry_c > 0:
            pct_corrected = round((recent_c - entry_c) / entry_c * 100, 1)

        combined_reason = '; '.join(filter(None, [entry_reason, recent_reason])) or None

        enriched_info = dict(info)
        enriched_info.update({
            'signal_price_raw':        entry_raw,
            'recent_price_raw':        recent_raw,
            'signal_price':            entry_c,
            'entry_price':             entry_c,
            'recent_price':            recent_c,
            'pct_since_entry':         pct_corrected,
            'price_corrected':         any_corrected,
            'price_correction_factor': entry_factor,
            'price_correction_reason': combined_reason,
            'price_repair_status':     overall,
            'live_price_used':         live_price,
        })
        enriched[ticker] = enriched_info

        # Audit row
        since_raw = since_ok = None
        if entry_raw and live_price and entry_raw > 0:
            since_raw = round((live_price - entry_raw) / entry_raw * 100, 1)
        if entry_c and live_price and entry_c > 0:
            since_ok = round((live_price - entry_c) / entry_c * 100, 1)

        audit.append({
            'ticker':                       ticker,
            'live_price':                   live_price,
            'entry_price_raw':              entry_raw,
            'entry_price_corrected':        entry_c,
            'entry_correction_factor':      entry_factor,
            'recent_price_raw':             recent_raw,
            'recent_price_corrected':       recent_c,
            'recent_correction_factor':     recent_factor,
            'since_signal_raw_pct':         since_raw,
            'since_signal_corrected_pct':   since_ok,
            'price_repair_status':          overall,
            'price_correction_reason':      combined_reason,
            'days_on_list':                 info.get('days_on_list'),
            'signal_date':                  info.get('signal_date'),
            'sector':                       info.get('sector'),
        })

    # Summary
    n_ok         = sum(1 for r in audit if r['price_repair_status'] == 'ok')
    n_corrected  = sum(1 for r in audit if r['price_repair_status'] == 'corrected')
    n_unresolved = sum(1 for r in audit if r['price_repair_status'] == 'unresolved')
    print(f"  Price repair: {n_ok} ok  {n_corrected} corrected  {n_unresolved} unresolved")
    if unresolved:
        print(f"  UNRESOLVED: {', '.join(unresolved)}")

    # Write audit file
    if data_dir:
        audit_path = os.path.join(data_dir, 'sss_extraction_audit.json')
        audit_doc = {
            'generated_at':      datetime.now().isoformat(),
            'total_tickers':     len(tickers),
            'live_prices_used':  has_live,
            'note': (
                'Live prices from yfinance used — both entry and recent prices validated.' if has_live else
                'No live prices — internal ratio used: only one-sided OCR errors detected. '
                'Prices where both entry and recent are off by the same factor (e.g. MGM) '
                'are not detectable without live prices and may still be incorrect.'
            ),
            'summary': {
                'ok':         n_ok,
                'corrected':  n_corrected,
                'unresolved': n_unresolved,
                'unresolved_tickers': unresolved,
            },
            'tickers': sorted(audit, key=lambda r: r['ticker']),
        }
        tmp = audit_path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as af:
            json.dump(audit_doc, af, indent=2, ensure_ascii=False)
        os.replace(tmp, audit_path)
        print(f"  Audit: {audit_path}")

    return enriched, audit, unresolved


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

    # ── Repair OCR decimal errors in signal prices ───────────────────
    if len(td) >= 5:
        td, _audit, _unresolved = repair_sss_prices(td, DATA_DIR)
        if _unresolved:
            print(f'  [WARN] {len(_unresolved)} tickers with unresolved suspicious signal prices: '
                  f'{", ".join(_unresolved[:8])}')

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
