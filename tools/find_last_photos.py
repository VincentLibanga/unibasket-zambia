"""Final targeted photo lookup for items with poor initial matches."""

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from find_extra_photos import get

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    5: "flashcards on desk", 7: "power bank charger",
    13: "bag maize meal", 39: "laptop elevated stand", 40: "neoprene laptop sleeve",
    48: "toothbrush toothpaste soap", 68: "tin chopped tomatoes",
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
    (ROOT / "tools" / "last-photo-candidates.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
