"""Find extra candidates where the initial photo search was too broad."""

import json
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    3: "highlighter pens", 4: "textbook writing", 5: "index flash cards",
    6: "weekly planner notebook", 11: "bedsheet pillow bedding", 13: "maize meal",
    14: "cooking oil bottle", 15: "uncooked rice", 16: "white sugar",
    17: "grocery basket food", 18: "ballpoint pens pack", 20: "lever arch file",
    22: "drawing instruments", 24: "ream paper", 25: "pencil pouch",
    26: "document folders", 28: "blank index cards", 30: "accounting workbook",
    32: "academic research books", 37: "wireless computer mouse", 39: "folding laptop stand",
    40: "laptop case", 42: "usb hub adapter", 43: "hdmi cable connector",
    44: "phone holder stand", 45: "laptop backpack", 47: "bathroom caddy",
    48: "toothbrush toothpaste soap", 49: "washing powder", 51: "reusable water bottle",
    52: "lunch box compartments", 53: "plastic food storage containers",
    54: "plates bowl mug", 58: "oatmeal oats", 59: "peanut butter jar",
    63: "carton milk", 66: "table salt", 68: "canned tomato tin",
    69: "soy chunks", 70: "breakfast cereal box", 71: "roasted peanuts",
    72: "saltine crackers",
}


def get(index, query):
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({
        "q": query, "page_size": 12, "license_type": "commercial",
    })
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "UniBasketStudentProject/1.0 (photo attribution research)"})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
        candidates = []
        for image in data.get("results", []):
            if image.get("mature") or not image.get("thumbnail"):
                continue
            candidates.append({key: image.get(key) for key in (
                "title", "url", "thumbnail", "creator", "creator_url", "license",
                "license_url", "foreign_landing_url", "provider", "width", "height",
            )})
        return {"index": index, "query": query, "candidates": candidates}
    except Exception as exc:
        return {"index": index, "query": query, "error": str(exc), "candidates": []}


def main():
    results = []
    selected = {int(value) for value in sys.argv[1:]} if len(sys.argv) > 1 else set(QUERIES)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(get, index, query) for index, query in QUERIES.items() if index in selected]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            print(result["index"], len(result["candidates"]), flush=True)
    results.sort(key=lambda item: item["index"])
    output = ROOT / "tools" / ("special-photo-candidates.json" if len(sys.argv) > 1 else "extra-photo-candidates.json")
    if len(sys.argv) > 1 and output.exists():
        prior = {item["index"]: item for item in json.loads(output.read_text())}
        prior.update({item["index"]: item for item in results})
        results = sorted(prior.values(), key=lambda item: item["index"])
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
