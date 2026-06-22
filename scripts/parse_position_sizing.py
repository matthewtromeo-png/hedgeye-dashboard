#!/usr/bin/env python3
"""
parse_position_sizing.py
Reads the latest Portfolio Solutions PDF and extracts the official
Macro ETFs by Rank table + Keith Commentary + 1-week/1-month callouts.
Writes position_sizing block to macro_context.json.
Usage: python parse_position_sizing.py
"""
import json, os, re, sys, logging
from datetime import datetime

logging.getLogger("pdfminer").setLevel(logging.ERROR)

REPO_DATA_DIR = r'C:\repos\hedgeye-dashboard\project\data'
ONEDRIVE_CTX  = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                '..', 'project', 'data', 'macro_context.json'))
DATA_DIR  = REPO_DATA_DIR
MCJ_PATH  = os.path.join(DATA_DIR, 'macro_context.json')
PS_FOLDER = r'C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Portfolio solutions'

def _find_linux_ps_folder():
    import glob as _glob
    for p in _glob.glob('/sessions/*/mnt/Trading/hedgeye/Portfolio solutions'):
        return p
    return None

PS_FOLDER_LINUX = _find_linux_ps_folder()

def _find_linux_data_dir():
    import glob as _glob
    for p in _glob.glob('/sessions/*/mnt/hedgeye-dashboard/project/data'):
        if os.path.exists(p):
            return p
    return None

_linux_data = _find_linux_data_dir()
if _linux_data:
    DATA_DIR = _linux_data
    MCJ_PATH = os.path.join(_linux_data, 'macro_context.json')

def safe_read_ctx(write_path, fallback_path):
    for label, p in [('repo', write_path), ('OneDrive', fallback_path)]:
        if not os.path.exists(p):
            continue
        try:
            with open(p, 'r', encoding='utf-8') as _f:
                return json.load(_f)
        except Exception as e:
            print(f"  [WARN] Could not read {label} JSON ({p}): {e}")
    print("  [ERROR] No readable macro_context.json found -- starting fresh")
    return {}

# ── Date helpers ──────────────────────────────────────────────────────────────
def parse_entry_date(s):
    s = s.strip()
    if not s or s in ('–', '-', '—', ''):
        return None
    try:
        if len(s) <= 8:
            return datetime.strptime(s, '%m/%d/%y').strftime('%Y-%m-%d')
        else:
            return datetime.strptime(s, '%m/%d/%Y').strftime('%Y-%m-%d')
    except ValueError:
        return s

def parse_change(s):
    s = s.strip()
    if s == '0':
        return 0
    if s in ('–', '-', '—', ''):
        return None
    m = re.match(r'[▲↑]\s*(\d+)', s)
    if m:
        return int(m.group(1))
    m = re.match(r'[▼↓]\s*(\d+)', s)
    if m:
        return -int(m.group(1))
    try:
        return int(s)
    except ValueError:
        return None

# ── PDF extraction ────────────────────────────────────────────────────────────
def extract_pdf_text(pdf_path):
    try:
        import pdfplumber
    except ImportError:
        print("pdfplumber not installed -- pip install pdfplumber", file=sys.stderr)
        return None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
    except Exception as e:
        print(f"  [ERROR] Could not read PDF: {e}", file=sys.stderr)
        return None

# ── Row regex ─────────────────────────────────────────────────────────────────
# Matches lines like:
#   1 FDRXX 0 0 - Cash 0% - 100%
#   2 BUXX UP1 UP1 10/16/23 Domestic Fixed Income 3% - 10%
#  11 QTUM DN3 UP9 05/13/26 Global Equities 2% - 6%
# where UP/DN are the unicode triangle chars
_UP = '▲'
_DN = '▼'
_DASH = '–'
ROW_RE = re.compile(
    r'^(\d{1,2})\s+'
    r'([A-Z]{2,6})\s+'
    r'([' + _UP + _DN + r']\s*\d+|0|' + _DASH + r')\s+'
    r'([' + _UP + _DN + r']\s*\d+|0|' + _DASH + r')\s+'
    r'(\d{1,2}/\d{2}/\d{2,4}|' + _DASH + r')\s+'
    r'(.+?)\s+'
    r'(\d+)%\s*[' + _DASH + r'\-]\s*(\d+)%',
    re.MULTILINE
)

def parse_rank_table(text):
    rows = []
    seen_ranks = set()
    for m in ROW_RE.finditer(text):
        rank = int(m.group(1))
        if rank in seen_ranks:
            continue
        seen_ranks.add(rank)
        rows.append({
            'rank':        rank,
            'ticker':      m.group(2).strip(),
            'rerank_1w':   parse_change(m.group(3)),
            'rerank_1m':   parse_change(m.group(4)),
            'entry_date':  parse_entry_date(m.group(5)),
            'asset_class': m.group(6).strip(),
            'min_pct':     int(m.group(7)),
            'max_pct':     int(m.group(8)),
        })
    rows.sort(key=lambda r: r['rank'])
    return rows

def parse_commentary(text):
    m = re.search(r"Keith.{1,3}s Commentary:\s*(.+?)(?:Watch Keith|$)", text, re.DOTALL | re.IGNORECASE)
    if not m:
        return None
    raw = m.group(1).replace('\n', ' ').strip()
    # Strip surrounding quote chars (straight or curly)
    raw = raw.strip('“”‘’"\'')
    raw = re.split(r'Watch Keith', raw, maxsplit=1)[0].strip()
    return raw if raw else None

def parse_rank_summary(text):
    m = re.search(r'Macro ETFs by Rank:\s*(.+?)(?:\n|Keith)', text, re.DOTALL)
    if m:
        return m.group(1).replace('\n', ' ').strip().rstrip(',')
    return None

def parse_movers(line):
    return [
        {'ticker': m.group(1), 'delta': int(m.group(2))}
        for m in re.finditer(r'([A-Z]{2,6})\s*\(([+\-]\d+)\)', line)
    ]

def parse_callouts(text):
    callouts = {}
    for label, key in [('1-WEEK', '1w'), ('1-MONTH', '1m')]:
        sec = re.compile(
            rf'{label} RE-RANK HISTORY[^\n]*\n'
            rf'Top Movers:\s*(.+?)\n'
            rf'Bottom Movers:\s*(.+?)(?:\n|$)',
            re.IGNORECASE
        )
        m = sec.search(text)
        if m:
            callouts[key] = {
                'top_movers':    parse_movers(m.group(1)),
                'bottom_movers': parse_movers(m.group(2)),
            }
        else:
            callouts[key] = {'top_movers': [], 'bottom_movers': []}
    return callouts

def extract_date_from_filename(filename):
    m = re.search(r'\((\d{1,2})[_/](\d{1,2})[_/](\d{4})\)', filename)
    if m:
        mo, dy, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f'{yr:04d}-{mo:02d}-{dy:02d}'
    return None

def find_latest_pdf(folder):
    if not os.path.exists(folder):
        return None
    pdfs = [f for f in os.listdir(folder) if f.lower().endswith('.pdf')]
    if not pdfs:
        return None
    def sort_key(f):
        d = extract_date_from_filename(f)
        if d:
            return d
        mtime = os.path.getmtime(os.path.join(folder, f))
        return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
    return os.path.join(folder, max(pdfs, key=sort_key))

def main():
    print("Parsing latest Portfolio Solutions PDF...")
    folder = PS_FOLDER_LINUX if PS_FOLDER_LINUX and os.path.exists(PS_FOLDER_LINUX) else PS_FOLDER
    pdf_path = find_latest_pdf(folder)
    if not pdf_path:
        print(f"[ERROR] No Portfolio Solutions PDFs found in: {folder}", file=sys.stderr)
        sys.exit(1)

    pdf_name    = os.path.basename(pdf_path)
    source_date = extract_date_from_filename(pdf_name) or datetime.now().strftime('%Y-%m-%d')
    print(f"  PDF: {pdf_name}")
    print(f"  Source date: {source_date}")

    text = extract_pdf_text(pdf_path)
    if not text:
        print("[ERROR] Failed to extract text from PDF", file=sys.stderr)
        sys.exit(1)

    positions    = parse_rank_table(text)
    commentary   = parse_commentary(text)
    rank_summary = parse_rank_summary(text)
    callouts     = parse_callouts(text)

    if len(positions) < 5:
        print(f"[WARN] Only {len(positions)} rows parsed -- aborting write", file=sys.stderr)
        sys.exit(1)

    print(f"  Positions parsed:   {len(positions)}")
    print(f"  Commentary:         {'YES' if commentary else 'not found'}")
    print(f"  1W top movers:  {len(callouts.get('1w',{}).get('top_movers',[]))}")
    print(f"  1W bot movers:  {len(callouts.get('1w',{}).get('bottom_movers',[]))}")
    print(f"  1M top movers:  {len(callouts.get('1m',{}).get('top_movers',[]))}")
    print(f"  1M bot movers:  {len(callouts.get('1m',{}).get('bottom_movers',[]))}")

    result = {
        'as_of_date':       source_date,
        'source_pdf':       pdf_name,
        'source_date':      source_date,
        'keith_commentary': commentary,
        'rank_summary':     rank_summary,
        'rerank_1w':        callouts.get('1w', {}),
        'rerank_1m':        callouts.get('1m', {}),
        'positions':        positions,
    }

    mcj = safe_read_ctx(MCJ_PATH, ONEDRIVE_CTX)
    mcj['position_sizing'] = result
    src = mcj.get('sources_used', [])
    src_entry = f'Portfolio Solutions PDF ({source_date})'
    if isinstance(src, list):
        mcj['sources_used'] = [s for s in src if 'Portfolio Solutions' not in s] + [src_entry]
    else:
        mcj['sources_used']['position_sizing'] = src_entry

    tmp_path = MCJ_PATH + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(mcj, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, MCJ_PATH)

    print(f"\nWrote {len(positions)} positions to macro_context.json  (as_of={source_date})")
    if commentary:
        print(f"Commentary: \"{commentary[:90]}...\"")

    print("\n--- Macro ETFs by Rank ---")
    for p in positions:
        w = p['rerank_1w']
        wstr = (f'+{w}' if w and w > 0 else str(w) if w is not None else '-')
        print(f"  {p['rank']:>2}. {p['ticker']:<6}  1w:{wstr:<5}  {p['asset_class']:<25}  {p['min_pct']}%-{p['max_pct']}%")

if __name__ == '__main__':
    main()
