#!/usr/bin/env python3
"""
parse_position_sizing.py
Reads all Portfolio Solutions PDFs + ETF Pro rank table.
Applies HYG threshold rule: positions ranked above HYG (rank 21) = above 3%.
Writes position_sizing block to macro_context.json.

Usage: python parse_position_sizing.py
"""
import json, os, re, sys
from collections import defaultdict
from datetime import datetime

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(SCRIPT_DIR, '..', 'project')
DATA_DIR    = os.path.join(PROJECT_DIR, 'data')
MCJ_PATH    = os.path.join(DATA_DIR, 'macro_context.json')
PS_FOLDER   = r'C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\Portfolio solutions'
# Linux mount path (for sandbox):
PS_FOLDER_LINUX = '/sessions/pensive-sharp-lovelace/mnt/Trading/hedgeye/Portfolio solutions'

# ── ETF Pro table — from current Portfolio Solutions visual ───────────────────
# Updated daily from the PDF table. rank=current ETF Pro rank.
ETF_PRO_TABLE = [
    {'rank':1,  'ticker':'FDRXX','class':'Cash',              'min':0,  'max':100,'entry':''},
    {'rank':2,  'ticker':'BUXX', 'class':'Domestic FI',       'min':3,  'max':10, 'entry':'2023-10-16'},
    {'rank':3,  'ticker':'CLOX', 'class':'Fixed Income',      'min':3,  'max':10, 'entry':'2025-03-06'},
    {'rank':4,  'ticker':'CLOZ', 'class':'Fixed Income',      'min':3,  'max':10, 'entry':'2026-04-22'},
    {'rank':5,  'ticker':'UUP',  'class':'Foreign Currency',  'min':4,  'max':12, 'entry':'2026-05-26'},
    {'rank':6,  'ticker':'VYM',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-05-12'},
    {'rank':7,  'ticker':'QTUM', 'class':'Global Equity',     'min':2,  'max':6,  'entry':'2026-05-13'},
    {'rank':8,  'ticker':'NORW', 'class':'Intl Equity',       'min':2,  'max':6,  'entry':'2026-03-03'},
    {'rank':9,  'ticker':'ROBO', 'class':'Global Equity',     'min':2,  'max':6,  'entry':'2026-05-19'},
    {'rank':10, 'ticker':'DRAM', 'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-05-18'},
    {'rank':11, 'ticker':'IWM',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-05-07'},
    {'rank':12, 'ticker':'XTL',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-03-27'},
    {'rank':13, 'ticker':'EQRR', 'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-03-31'},
    {'rank':14, 'ticker':'VXF',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-05-13'},
    {'rank':15, 'ticker':'COM',  'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-03-17'},
    {'rank':16, 'ticker':'TAN',  'class':'Global Equity',     'min':2,  'max':6,  'entry':'2026-05-20'},
    {'rank':17, 'ticker':'OIH',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-02-05'},
    {'rank':18, 'ticker':'AAAU', 'class':'Foreign Currency',  'min':4,  'max':12, 'entry':'2025-02-28'},
    {'rank':19, 'ticker':'SOYB', 'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-04-17'},
    {'rank':20, 'ticker':'PFIX', 'class':'US Fixed Income',   'min':3,  'max':10, 'entry':'2026-05-22'},
    {'rank':21, 'ticker':'HYG',  'class':'Domestic FI',       'min':3,  'max':10, 'entry':'2026-04-21'},
    {'rank':22, 'ticker':'EWW',  'class':'EM Equity',         'min':2,  'max':6,  'entry':'2026-04-16'},
    {'rank':23, 'ticker':'CNXT', 'class':'EM Equity',         'min':2,  'max':6,  'entry':'2026-04-28'},
    {'rank':24, 'ticker':'SLX',  'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-05-15'},
    {'rank':25, 'ticker':'DBB',  'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-05-19'},
    {'rank':26, 'ticker':'XOP',  'class':'Domestic Equity',   'min':2,  'max':6,  'entry':'2026-02-02'},
    {'rank':27, 'ticker':'CPER', 'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-04-24'},
    {'rank':28, 'ticker':'TILL', 'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-05-21'},
    {'rank':29, 'ticker':'BNO',  'class':'Commodity',         'min':1,  'max':4,  'entry':'2026-02-13'},
]

# Threshold anchor: dynamically determined from the book.
# Find the highest-ranked (lowest rank number) position that's at its class minimum.
# Everything ranked above that anchor = confirmed above anchor's minimum %.
# This shifts daily as Keith adds/trims. Do NOT hardcode — recalculate each run.
HYG_RANK      = 21    # starting seed only — overridden below after book is simulated
HYG_THRESHOLD = 3.0   # starting seed only — overridden below

ETF_MAP  = {row['ticker']: row for row in ETF_PRO_TABLE}
RERANK_1W  = {'ROBO':14,'OIH':11,'VYM':10,'NORW':9,'EQRR':6,'CNXT':-10,'QTUM':2,'DRAM':2,
               'DBB':2,'EWW':2,'AAAU':2,'SOYB':3,'IWM':-5,'VXF':-6,'SLX':-6,'XTL':-1,
               'HYG':-11,'CPER':-2,'XOP':0,'BNO':0,'COM':0,'CLOZ':0,'TILL':None}
RERANK_1M  = {'OIH':0,'NORW':5,'EQRR':1,'EWW':-2,'AAAU':-10,'SOYB':-3,'XOP':-4,'BNO':-4,
               'CPER':-4,'HYG':-17,'CLOZ':3,'XTL':-2}

# ── Commentary parser ─────────────────────────────────────────────────────────
def get_min(t): return ETF_MAP.get(t, {}).get('min', 2)
def get_max(t): return ETF_MAP.get(t, {}).get('max', 6)

def parse_moves(text, date):
    moves = []
    # "added X and Y at my mins"
    for m in re.finditer(r'added\s+([\w\s,]+?)\s+at\s+my\s+mins?', text, re.IGNORECASE):
        for t in re.split(r'\s+and\s+|,\s*', m.group(1)):
            t = t.strip().rstrip(',')
            if re.match(r'^[A-Z]{2,6}$', t):
                moves.append((date, t, 'add_min', get_min(t)*100))
    # "Sold all X and Y"
    for m in re.finditer(r'[Ss]old\s+all\s+([\w,\s]+?)(?=\.\s|$|\s+[Ss]old|\s+[Bb]ought)', text):
        for t in re.split(r'\s+and\s+|,\s*', m.group(1)):
            t = t.strip().rstrip('.,')
            if re.match(r'^[A-Z]{2,6}$', t):
                moves.append((date, t, 'close', 0))
    # "Bought/Sold Xbps T1, T2"
    for verb, action in [('Sold|sold', 'sell'), ('Bought|bought', 'buy')]:
        for m in re.finditer(
                rf'(?:{verb})\s+(\d+)\s*bps\s+(?:of\s+)?((?:[A-Z]{{2,6}}(?:[,\s]+(?:and\s+)?)?)+)', text):
            bps = int(m.group(1))
            for t in re.split(r'\s+and\s+|,\s*', m.group(2)):
                t = t.strip().rstrip('.,')
                if re.match(r'^[A-Z]{2,6}$', t):
                    moves.append((date, t, action, bps))
    return moves

# ── Extract from PDFs ─────────────────────────────────────────────────────────
def extract_from_pdfs(folder):
    all_moves = []
    try:
        import pdfplumber
    except ImportError:
        print("pdfplumber not installed — pip install pdfplumber", file=sys.stderr)
        return all_moves

    if not os.path.exists(folder):
        print(f"Folder not found: {folder}", file=sys.stderr)
        return all_moves

    for f in sorted(os.listdir(folder)):
        if not f.endswith('.pdf'): continue
        dm = re.search(r'\((\d+)_(\d+)_(\d+)\)', f)
        date = f'{dm.group(3)}-{int(dm.group(1)):02d}-{int(dm.group(2)):02d}' if dm else None
        if not date: continue
        try:
            with pdfplumber.open(os.path.join(folder, f)) as pdf:
                text = ''.join(p.extract_text() or '' for p in pdf.pages)
            mc = re.search(r"Keith's Commentary:\s*\"(.+?)\"", text, re.DOTALL)
            if mc:
                commentary = mc.group(1).replace('\n', ' ')
                moves = parse_moves(commentary, date)
                all_moves.extend(moves)
                print(f"  {date}: {len(moves)} moves parsed")
        except Exception as e:
            print(f"  {date}: ERROR — {e}", file=sys.stderr)
    return all_moves

# ── Simulate book ─────────────────────────────────────────────────────────────
def simulate_book(all_moves):
    book   = {}
    history = defaultdict(list)
    for date, t, action, bps in sorted(all_moves, key=lambda x: x[0]):
        cur = book.get(t, 0.0)
        if   action == 'add_min': new = get_min(t)
        elif action == 'close':   new = 0.0
        elif action == 'buy':     new = round(cur + bps/100, 2)
        elif action == 'sell':    new = round(max(0.0, cur - bps/100), 2)
        else: continue
        book[t] = new
        history[t].append({'date': date, 'action': action, 'bps': bps, 'size_after': new})
    return book, history

# ── Apply rank threshold rule ─────────────────────────────────────────────────
def apply_rank_rule(ticker, commentary_size, rank, threshold_rank, threshold_pct):
    """
    Dynamic threshold: if this ticker ranks above the current minimum-sized anchor,
    it must be above the anchor's minimum %. Floor the estimate if commentary is lower.
    The anchor shifts daily as the book changes — do not hardcode.
    """
    if rank is None or rank == 0 or threshold_rank is None:
        return commentary_size, 'commentary'
    if rank < threshold_rank and commentary_size < threshold_pct:
        return threshold_pct, 'rank_floor'
    return commentary_size, 'commentary'

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Parsing Portfolio Solutions commentary...")

    # Detect correct folder path
    folder = PS_FOLDER_LINUX if os.path.exists(PS_FOLDER_LINUX) else PS_FOLDER
    all_moves = extract_from_pdfs(folder)

    # Seed pre-history positions (entered before first PDF ~2026-04-08)
    FIRST_PDF = '2026-04-08'
    for row in ETF_PRO_TABLE:
        t = row['ticker']
        if row['entry'] and row['entry'] < FIRST_PDF and t != 'FDRXX':
            all_moves.insert(0, (row['entry'], t, 'add_min', row['min']*100))

    # Inject 5/22 entries missed due to CIFS error
    # Also inject 5/26 commentary (PDF not in folder yet — add daily until downloaded)
    commentary_526 = ('In the PA today, I added UUP at my min. Sold all STIP. '
                      'Sold 50bps CLOZ, XTL, CNXT, IWM, COM. Bought 50bps PFIX.')
    # Only inject if 5/26 PDF not already parsed
    dates_parsed = {m[0] for m in all_moves}
    if '2026-05-26' not in dates_parsed:
        all_moves.extend(parse_moves(commentary_526, '2026-05-26'))
        print('  2026-05-26: injected from screenshot (PDF not in folder)')
    # PFIX entered 5/22 (confirmed by ETF Pro entry date)
    all_moves.append(('2026-05-22', 'PFIX', 'add_min', get_min('PFIX')*100))

    book, history = simulate_book(all_moves)

    # ── Compute dynamic threshold anchor ─────────────────────────────────────
    # Look for the deepest-ranked FI/FX position (min >= 3%) that is currently
    # sitting at its class minimum. FI min=3%, FX min=4% — higher than equity
    # min=2%. A FI/FX position at minimum ranked below equity positions means
    # those equity positions must hold MORE than that FI/FX minimum.
    # Example: HYG (FI, min 3%, rank 21) at minimum → everything ranked above
    # rank 21 is confirmed >3%. This anchor shifts as the book changes.
    threshold_ticker = None
    threshold_rank   = None
    threshold_pct    = None
    for row in sorted(ETF_PRO_TABLE, key=lambda r: r['rank'], reverse=True):
        t2 = row['ticker']
        if t2 == 'FDRXX': continue
        if row['min'] < 3: continue   # only FI/FX class positions (min >= 3%)
        comm = round(book.get(t2, 0.0), 2)
        at_min = 0 < comm <= row['min'] + 0.25
        if at_min:
            if threshold_rank is None or row['rank'] > threshold_rank:
                threshold_ticker = t2
                threshold_rank   = row['rank']
                threshold_pct    = row['min']
    if threshold_ticker:
        print(f"  Anchor: {threshold_ticker} rank={threshold_rank} min={threshold_pct}% "
              f"— positions above rank #{threshold_rank} confirmed >{threshold_pct}%")
    else:
        print("  No FI/FX anchor at minimum — rank-floor not applied")

    # Build position_sizing output
    positions = []
    for row in ETF_PRO_TABLE:
        t = row['ticker']
        if t == 'FDRXX': continue
        comm_size = round(book.get(t, 0.0), 2)
        rank = row['rank']
        est_size, size_source = apply_rank_rule(t, comm_size, rank, threshold_rank, threshold_pct)

        mn, mx = row['min'], row['max']
        fill_pct = round(est_size / mx * 100) if mx > 0 else 0
        tier = ('max' if est_size >= mx - 0.25
                else 'mid' if est_size > mn + 0.25
                else 'min')
        above_hyg = rank < HYG_RANK
        room_to_add = round(mx - est_size, 2)
        last_move = history[t][-1] if history[t] else None
        last_direction = ('adding' if last_move and last_move['action'] in ('add_min','buy')
                          else 'trimming' if last_move and last_move['action'] == 'sell'
                          else 'closed' if last_move and last_move['action'] == 'close'
                          else 'unknown')

        positions.append({
            'rank':         rank,
            'ticker':       t,
            'asset_class':  row['class'],
            'entry_date':   row['entry'],
            'min_pct':      mn,
            'max_pct':      mx,
            'estimated_pct': est_size,
            'commentary_pct': comm_size,
            'size_source':   size_source,   # 'commentary' or 'rank_floor'
            'fill_pct':     fill_pct,
            'tier':         tier,
            'above_hyg_threshold': above_hyg,
            'room_to_add':  room_to_add,
            'last_direction': last_direction,
            'rerank_1w':    RERANK_1W.get(t),
            'rerank_1m':    RERANK_1M.get(t),
            'move_count':   len(history[t]),
        })

    result = {
        'as_of_date':          datetime.now().strftime('%Y-%m-%d'),
        'threshold_ticker':    threshold_ticker,
        'threshold_rank':      threshold_rank,
        'threshold_pct':       threshold_pct,
        'threshold_note':      (f'{threshold_ticker} is currently at minimum ({threshold_pct}%). '
                                f'Positions ranked above it (rank < {threshold_rank}) '
                                f'are confirmed above {threshold_pct}%. '
                                f'This anchor shifts as the book changes.'),
        'source_pdfs':         len([f for f in os.listdir(folder) if f.endswith('.pdf')]) if os.path.exists(folder) else 0,
        'positions':           positions,
    }

    # Write to macro_context.json — atomic write to avoid truncation
    with open(MCJ_PATH) as f:
        mcj = json.load(f)
    mcj['position_sizing'] = result
    # sources_used may be a list (new format) or dict (old format) — handle both
    src = mcj.get('sources_used', [])
    src_entry = f'Portfolio Solutions PDFs + ETF Pro table ({datetime.now().strftime("%Y-%m-%d")})'
    if isinstance(src, list):
        if src_entry not in src:
            src.append(src_entry)
        mcj['sources_used'] = src
    else:
        mcj['sources_used']['position_sizing'] = src_entry
    tmp_path = MCJ_PATH + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(mcj, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, MCJ_PATH)

    print(f"\nWrote {len(positions)} positions to macro_context.json")
    print(f"Above threshold ({threshold_ticker} rank {threshold_rank} @ {threshold_pct}%): {sum(1 for p in positions if p['above_hyg_threshold'])} positions")
    print(f"Rank-floor adjustments:    {sum(1 for p in positions if p['size_source']=='rank_floor')} tickers")

    # Print summary
    print("\n--- Current book ---")
    for p in positions:
        if p['estimated_pct'] > 0:
            flag = chr(9650) if (p['rerank_1w'] or 0) > 0 else (chr(9660) if (p['rerank_1w'] or 0) < 0 else '->')
            adj  = ' [rank-adj]' if p['size_source'] == 'rank_floor' else ''
            print(f"  {p['rank']:>2}. {p['ticker']:<6} {p['estimated_pct']:>4.1f}% "
                  f"[{p['tier'].upper():<3}] {flag}{abs(p['rerank_1w'] or 0):>2} 1w  {adj}")

if __name__ == '__main__':
    main()
