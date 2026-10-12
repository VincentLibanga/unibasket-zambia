"""Collect reusable Openverse photo candidates for the UniBasket catalogue."""

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "script.js"
OUTPUT = ROOT / "tools" / "photo-candidates.json"

QUERIES = [
    "notebook", "stationery", "highlighters", "writing book", "flashcards", "planner",
    "power bank", "earbuds", "desk lamp", "electric kettle", "bedding", "laundry basket",
    "maize meal", "cooking oil", "rice", "sugar", "groceries", "ballpoint pens",
    "pencils", "binder", "sticky notes", "geometry set", "stapler", "printer paper",
    "pencil case", "document folder", "scientific calculator", "index cards", "whiteboard",
    "accounting book", "programming book", "research book", "book stand", "usb c cable",
    "usb charger", "usb flash drive", "wireless mouse", "keyboard", "laptop stand",
    "laptop sleeve", "headphones", "usb hub", "hdmi cable", "phone stand", "backpack",
    "bath towel", "shower caddy", "toiletries", "laundry detergent", "clothes hangers",
    "water bottle", "lunch box", "food containers", "dinnerware", "cutlery", "trash bin",
    "mosquito net", "oats", "peanut butter", "dried beans", "spaghetti pasta",
    "instant noodles", "milk carton", "tea bags", "instant coffee", "salt",
    "canned baked beans", "canned tomatoes", "soya chunks", "cereal box", "peanuts", "crackers",
]

names = re.findall(r"^\s*\['([^']+)'", SOURCE.read_text(), re.MULTILINE)
assert len(names) == len(QUERIES) == 72, (len(names), len(QUERIES))


def get_candidates(index, name, query):
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({
        "q": query,
        "page_size": 12,
        "license_type": "commercial",
        "category": "photograph",
    })
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "UniBasketStudentProject/1.0 (image attribution research)"})
            with urllib.request.urlopen(request, timeout=25) as response:
                data = json.load(response)
            candidates = []
            for image in data.get("results", []):
                if image.get("mature") or not image.get("thumbnail"):
                    continue
                candidates.append({key: image.get(key) for key in (
                    "id", "title", "url", "thumbnail", "creator", "creator_url",
                    "license", "license_url", "foreign_landing_url", "provider", "width", "height",
                )})
            return {"index": index, "product": name, "query": query, "candidates": candidates}
        except Exception as exc:
            if attempt == 2:
                return {"index": index, "product": name, "query": query, "error": str(exc), "candidates": []}
            time.sleep(2 * (attempt + 1))


if __name__ == "__main__":
    results = [None] * len(names)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(get_candidates, i + 1, name, query)
                   for i, (name, query) in enumerate(zip(names, QUERIES))]
        for future in as_completed(futures):
            result = future.result()
            results[result["index"] - 1] = result
            print(f'{result["index"]:02d} {result["product"]}: {len(result["candidates"])} candidates')

    OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    print(OUTPUT)
