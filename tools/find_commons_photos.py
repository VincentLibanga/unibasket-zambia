"""Find Wikimedia Commons photograph candidates for the 72 catalogue items."""

import json
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from find_product_photos import QUERIES, names

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tools" / "commons-candidates.json"


def candidates_for(index, name, query):
    # Commons bitmap search can still include scans and drawings, so final picks
    # are reviewed and recorded separately before use on the website.
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": query + " filetype:bitmap",
        "gsrnamespace": 6, "gsrlimit": 8, "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime", "iiurlwidth": 500, "format": "json",
    })
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "UniBasketStudentProject/1.0 (photo source research)"})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = json.load(response)
        pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda page: page.get("index", 999))
        matches = []
        for page in pages:
            info = page["imageinfo"][0]
            if info.get("mime") != "image/jpeg" or not info.get("thumburl"):
                continue
            metadata = info.get("extmetadata", {})
            matches.append({
                "title": page["title"], "thumburl": info["thumburl"],
                "descriptionurl": info.get("descriptionurl"),
                "artist": metadata.get("Artist", {}).get("value", ""),
                "license": metadata.get("LicenseShortName", {}).get("value", ""),
                "licenseurl": metadata.get("LicenseUrl", {}).get("value", ""),
            })
        return {"index": index, "product": name, "query": query, "candidates": matches}
    except Exception as exc:
        return {"index": index, "product": name, "query": query, "error": str(exc), "candidates": []}


def main():
    results = [None] * len(names)
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(candidates_for, i + 1, name, query)
                   for i, (name, query) in enumerate(zip(names, QUERIES))]
        for future in as_completed(futures):
            result = future.result()
            results[result["index"] - 1] = result
            print(f'{result["index"]:02d} {result["product"]}: {len(result["candidates"])} candidates', flush=True)
    OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
