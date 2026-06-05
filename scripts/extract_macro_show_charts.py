"""
extract_macro_show_charts.py
============================
Finds the newest Macro Show PDF, locates specific chart slides by title text,
extracts the embedded PNG image from each slide, and saves them as static
assets for the Volatility tab.

Called by update_cowork.ps1 during -Research.

Output files (in REPO_ROOT/project/assets/generated/):
  macro_show_usd_corr.png    -- Key $USD Correlations slide
  macro_show_ivol.png        -- Implied & Realized Volatility slide

Manifest (in REPO_ROOT/project/data/):
  chart_manifest.json        -- provenance: source PDF, page numbers, extraction date

Exit codes:
  0 = all charts extracted successfully
  1 = one or more charts could not be found or extracted
"""

import glob
import json
import os
import sys
from datetime import date
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("[ERROR] pdfplumber not installed. Run: pip install pdfplumber --break-system-packages")
    sys.exit(1)

try:
    from pypdf import PdfReader
except ImportError:
    print("[ERROR] pypdf not installed. Run: pip install pypdf --break-system-packages")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MACRO_SHOW_FOLDER = Path(r"C:\Users\matth\OneDrive\Desktop\Trading\hedgeye\macro show slides")

# All output goes directly to C:\repos -- consistent with Task #79 architecture.
# (Never use __file__-relative paths: when the script runs from OneDrive it would
#  write to OneDrive, but validation reads from C:\repos.)
REPO_ROOT   = Path(r"C:\repos\hedgeye-dashboard")
ASSETS_DIR  = REPO_ROOT / "project" / "assets" / "generated"
MANIFEST    = REPO_ROOT / "project" / "data" / "chart_manifest.json"

# ---------------------------------------------------------------------------
# Chart targets: key -> (output_filename, search_text_fragments)
# Multiple fragments: ANY match triggers. Title text is lowercased for search.
# ---------------------------------------------------------------------------
CHART_TARGETS = {
    "usd_corr": {
        "output":  "macro_show_usd_corr.png",
        "label":   "Key $USD Correlations",
        "search":  ["key $usd correlations", "key usd correlations"],
    },
    "ivol": {
        "output":  "macro_show_ivol.png",
        "label":   "Implied & Realized Volatility",
        "search":  ["implied & realized volatility", "implied and realized volatility"],
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_newest_pdf(folder: Path) -> Path | None:
    candidates = sorted(folder.glob("HE_TMS_*.pdf"), key=lambda p: p.stat().st_mtime)
    return candidates[-1] if candidates else None


def _find_pages(pdf_path: Path) -> dict[str, int]:
    """Return {chart_key: 0-indexed page number} by searching text."""
    found: dict[str, int] = {}
    remaining = set(CHART_TARGETS.keys())

    with pdfplumber.open(str(pdf_path)) as pdf:
        for pg_idx, page in enumerate(pdf.pages):
            if not remaining:
                break
            text = (page.extract_text() or "").lower().replace("$", "")
            for key in list(remaining):
                for fragment in CHART_TARGETS[key]["search"]:
                    if fragment.replace("$", "") in text:
                        found[key] = pg_idx
                        remaining.discard(key)
                        break

    return found


def _extract_largest_image(reader: "PdfReader", pg_idx: int) -> bytes | None:
    """Extract the largest embedded image from a page and return PNG bytes.

    Uses img.image (pypdf PIL wrapper) so the image is always decoded and
    re-encoded as PNG regardless of the original format embedded in the PDF
    (PNG, JPEG, JPEG2000/JP2, etc.).  This fixes slides where the chart is
    stored as JPEG2000, which browsers cannot display.
    """
    try:
        from PIL import Image as PILImage
        import io as _io
    except ImportError:
        print("[ERROR] Pillow not installed. Run: pip install Pillow --break-system-packages")
        return None

    page = reader.pages[pg_idx]
    imgs = list(page.images)
    if not imgs:
        return None

    # Slide chart is always the largest embedded image; logos are tiny
    largest = max(imgs, key=lambda img: len(img.data))
    if len(largest.data) <= 10_000:
        return None   # guard against logo-only page

    # Use .image (PIL Image) to decode and re-encode as PNG
    pil_img = largest.image
    if pil_img is None:
        # Fallback: raw bytes (only works if already PNG)
        return largest.data if largest.data[:4] == b'\x89PNG' else None

    buf = _io.BytesIO()
    pil_img.save(buf, format='PNG')
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print("extract_macro_show_charts.py")

    # 1. Find source PDF
    pdf_path = _find_newest_pdf(MACRO_SHOW_FOLDER)
    if pdf_path is None:
        print(f"[ERROR] No Macro Show PDF found in {MACRO_SHOW_FOLDER}")
        return 1
    print(f"  Source: {pdf_path.name}")

    # 2. Search pages by text
    print("  Searching for chart slides by title text...")
    pages = _find_pages(pdf_path)
    for key, cfg in CHART_TARGETS.items():
        if key in pages:
            print(f"    [{key}] '{cfg['label']}' -> page {pages[key] + 1}")
        else:
            print(f"    [{key}] '{cfg['label']}' -> NOT FOUND")

    if not pages:
        print("[ERROR] Could not locate any target slides in the PDF.")
        return 1

    # 3. Extract images
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf_path))

    manifest = {
        "source_pdf":  pdf_path.name,
        "extracted_at": date.today().isoformat(),
        "charts":      {},
    }

    any_ok  = False
    any_err = False

    for key, cfg in CHART_TARGETS.items():
        out_path = ASSETS_DIR / cfg["output"]

        if key not in pages:
            print(f"  [SKIP] {key}: page not found -- no image written")
            manifest["charts"][key] = {"status": "not_found", "page": None}
            if out_path.exists():
                out_path.unlink()   # remove stale asset so UI shows "unavailable"
            any_err = True
            continue

        pg_idx = pages[key]
        img_data = _extract_largest_image(reader, pg_idx)

        if img_data is None:
            print(f"  [FAIL] {key}: no usable image on page {pg_idx + 1}")
            manifest["charts"][key] = {"status": "extract_failed", "page": pg_idx + 1}
            any_err = True
            continue

        # Atomic write -- temp + rename
        tmp = out_path.with_suffix(".tmp")
        with open(tmp, "wb") as f:
            f.write(img_data)
        tmp.replace(out_path)
        size_kb = len(img_data) // 1024
        print(f"  [OK]  {key}: {out_path.name}  ({size_kb} KB  from page {pg_idx + 1})")
        # Record dimensions for the UI (aspect ratio helps lay out the card)
        try:
            from PIL import Image as _PIL
            import io as _io
            _im = _PIL.open(_io.BytesIO(img_data))
            _w, _h = _im.size
        except Exception:
            _w, _h = None, None
        manifest["charts"][key] = {
            "status":    "ok",
            "page":      pg_idx + 1,
            "size_kb":   size_kb,
            "label":     cfg["label"],
            "width_px":  _w,
            "height_px": _h,
            "note":      "slide image only — table data requires OCR",
        }
        any_ok = True

    # 4. Write manifest (atomic)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    tmp_m = MANIFEST.with_suffix(".manifest_tmp")
    with open(tmp_m, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    tmp_m.replace(MANIFEST)
    print(f"  Manifest written: {MANIFEST.name}")

    if any_err and not any_ok:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
