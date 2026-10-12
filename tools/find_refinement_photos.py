"""Find closer visual matches after reviewing the contact sheet."""

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from find_extra_photos import get

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    5: "paper flashcards study", 6: "weekly student planner", 7: "power bank portable charger",
    12: "plastic laundry basket", 13: "maize meal bag", 17: "groceries food basket",
    25: "pencil case stationery", 28: "blank index cards stack", 34: "usb c charging cable",
    36: "usb memory stick", 38: "computer keyboard", 39: "laptop stand desk",
    40: "padded laptop sleeve", 42: "four port usb hub", 44: "phone stand holder",
    48: "toiletry kit toothbrush toothpaste", 55: "stainless steel forks spoons",
    68: "canned tomatoes", 71: "roasted peanuts bowl",
}


def main():
    results = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(get, index, query) for index, query in QUERIES.items()]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            print(result["index"], len(result["candidates"]), flush=True)
    results.sort(key=lambda item: item["index"])
    (ROOT / "tools" / "refinement-photo-candidates.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
