"""Bundle selected, attributed real photographs for the 72-item catalogue."""

import html
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "images" / "products"

# Each number below is a human-reviewed candidate index, not a search ranking.
# The photos depict the item type; the UniBasket brand names are fictional.
BASE = {
    1: 1, 2: 5, 4: 0, 5: 0, 8: 1, 9: 4, 10: 0,
    19: 1, 21: 3, 23: 3, 27: 0, 29: 1,
    30: 0, 31: 0, 33: 1, 35: 0,
    41: 0, 46: 1, 48: 2, 50: 6, 56: 0, 57: 8,
    60: 1, 61: 3, 62: 0, 64: 1, 65: 0, 67: 0,
}
EXTRA = {
    3: 0, 11: 4, 13: 0, 14: 1, 15: 2, 16: 8, 18: 1,
    20: 0, 24: 11, 26: 2, 32: 1,
    45: 0, 47: 2, 49: 7,
    51: 9, 52: 1, 53: 0, 54: 2, 58: 8, 59: 1,
    63: 0, 66: 6, 69: 0, 70: 0, 71: 5, 72: 2,
}
SPECIAL = {22: 3, 37: 7, 39: 0, 43: 0}
REFINEMENT = {6: 5, 7: 5, 12: 5, 25: 7, 36: 0, 38: 0, 40: 0, 42: 0, 55: 0, 68: 4}
FINAL = {17: 0, 28: 5, 34: 5, 44: 1}


def load_candidates(name):
    path = ROOT / "tools" / name
    return {item["index"]: item for item in json.loads(path.read_text())}


def selected_items():
    assert len(BASE) + len(EXTRA) + len(SPECIAL) + len(REFINEMENT) + len(FINAL) == 72
    sources = {
        "base": load_candidates("photo-candidates.json"),
        "extra": load_candidates("extra-photo-candidates.json"),
        "special": load_candidates("special-photo-candidates.json"),
        "refinement": load_candidates("refinement-photo-candidates.json"),
        "final": load_candidates("final-photo-candidates.json"),
    }
    picks = {}
    for source_name, mapping in (("base", BASE), ("extra", EXTRA), ("special", SPECIAL),
                                 ("refinement", REFINEMENT), ("final", FINAL)):
        for item_id, candidate_index in mapping.items():
            item = sources[source_name][item_id]
            candidate = item["candidates"][candidate_index]
            if candidate["license"] not in {"cc0", "pdm", "by", "by-sa"}:
                raise ValueError(f"Unsupported license on {item_id}: {candidate['license']}")
            picks[item_id] = (item["product"] if "product" in item else sources["base"][item_id]["product"], candidate)
    assert sorted(picks) == list(range(1, 73))
    return picks


def download(item_id, candidate, refresh=False):
    destination = DEST / f"product-{item_id:02d}.jpg"
    if not refresh and destination.exists() and destination.read_bytes().startswith(b"\xff\xd8\xff"):
        return item_id, destination.stat().st_size
    for source_url in (candidate["thumbnail"], candidate.get("url")):
        if not source_url:
            continue
        try:
            request = urllib.request.Request(source_url, headers={
                "User-Agent": "UniBasketStudentProject/1.0 (attributed student catalogue)",
            })
            with urllib.request.urlopen(request, timeout=25) as response:
                data = response.read(15_000_000)
            if len(data) < 1000 or len(data) >= 15_000_000:
                raise ValueError("Unexpected image size")
            if data.startswith(b"\xff\xd8\xff") and source_url == candidate["thumbnail"]:
                destination.write_bytes(data)
            else:
                with tempfile.NamedTemporaryFile(suffix=".image") as source:
                    source.write(data)
                    source.flush()
                    subprocess.run(["sips", "-Z", "600", "-s", "format", "jpeg", source.name,
                                    "--out", str(destination)], check=True, capture_output=True)
            if not destination.read_bytes().startswith(b"\xff\xd8\xff"):
                raise ValueError("Downloaded file is not a JPEG")
            return item_id, destination.stat().st_size
        except Exception as error:
            last_error = error
            time.sleep(.25)
    raise RuntimeError(f"Could not download product {item_id}: {last_error}")


def create_credits(items):
    rows = []
    markdown = ["# UniBasket product photograph credits", "",
                "These are representative photos of product types, not photographs of the fictional UniBasket-branded items.", ""]
    for item_id, (product, candidate) in sorted(items.items()):
        title = candidate.get("title") or "Untitled photograph"
        creator = candidate.get("creator") or "Unknown creator"
        license_name = candidate["license"].upper().replace("BY-SA", "BY-SA")
        source_url = candidate.get("foreign_landing_url") or candidate.get("url")
        license_url = candidate.get("license_url") or "https://creativecommons.org/licenses/"
        rows.append(
            f'<tr><td>{item_id}</td><td>{html.escape(product)}</td><td>'
            f'<a href="{html.escape(source_url, quote=True)}">{html.escape(title)}</a></td>'
            f'<td>{html.escape(creator)}</td><td>'
            f'<a href="{html.escape(license_url, quote=True)}">{html.escape(license_name)}</a></td></tr>'
        )
        markdown.append(f'{item_id}. **{product}**: [{title}]({source_url}) by {creator}, [{license_name}]({license_url}).')
    page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product photo credits | UniBasket</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1100px;margin:auto;padding:1.5rem;color:#14233a}a{color:#1f6853}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #aaa;padding:.6rem}th{background:#eee}@media(max-width:700px){table{display:block;overflow-x:auto}} </style></head><body><p><a href="./">← Back to UniBasket</a></p><h1>Product photo credits</h1><p>These are representative photographs of product types, not photographs of fictional UniBasket-branded items. Catalogue images are bundled for offline display. Photos retain their respective licenses.</p><table><thead><tr><th>#</th><th>Product</th><th>Source photograph</th><th>Creator</th><th>License</th></tr></thead><tbody>''' + "".join(rows) + "</tbody></table></body></html>"
    (ROOT / "public" / "photo-credits.html").write_text(page)
    (ROOT / "PHOTO_CREDITS.md").write_text("\n".join(markdown) + "\n")


def main():
    items = selected_items()
    refresh_ids = {int(value) for value in sys.argv[1:]}
    if refresh_ids and not refresh_ids.issubset(items):
        raise ValueError("Refresh IDs must be catalogue product numbers from 1 to 72")
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(download, item_id, candidate, item_id in refresh_ids)
                   for item_id, (_, candidate) in items.items() if not refresh_ids or item_id in refresh_ids]
        for future in as_completed(futures):
            item_id, size = future.result()
            print(f"{item_id:02d} {size} bytes", flush=True)
    create_credits(items)
    print(f"Bundled {len(items)} attributed product photographs")


if __name__ == "__main__":
    main()
