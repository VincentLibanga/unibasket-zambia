"""Search remaining difficult-to-photograph product types."""

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from find_extra_photos import get

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    5: "student flash cards", 17: "shopping basket groceries",
    28: "index cards", 34: "usb c cable", 39: "adjustable laptop stand",
    44: "smartphone stand", 48: "toiletries toothbrush toothpaste soap",
    71: "roasted peanuts",
}


def main():
    results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(get, index, query) for index, query in QUERIES.items()]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            print(result["index"], len(result["candidates"]), flush=True)
    results.sort(key=lambda item: item["index"])
    (ROOT / "tools" / "final-photo-candidates.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
