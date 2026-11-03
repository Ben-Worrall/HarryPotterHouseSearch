#!/usr/bin/env python3
"""Step 1: pull fictional characters from Wikidata into data/candidates.json.

Gets characters that appear in a literary work or a film, with the work's title,
year and author/director. Wikidata is CC0, so the list is free to use.

Usage:
  python3 scripts/fetch_characters.py --limit 2000
  python3 scripts/fetch_characters.py --limit 5000 --offset 2000   # next page

Requires: pip install requests
"""
import argparse
import json
import os
import re
import time

import requests

ENDPOINT = "https://query.wikidata.org/sparql"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "candidates.json")

# Characters (instance of a subclass of fictional character) linked to a work via
# "present in work" (P1441), where the work is a literary work (Q7725634) or a film (Q11424).
# Ranked by number of Wikipedia sitelinks so the best-known characters come first.
QUERY = """
SELECT ?char ?charLabel ?work ?workLabel ?kind (MIN(YEAR(?date)) AS ?year)
       (SAMPLE(?creatorLabel) AS ?creator) ?links WHERE {
  ?char wdt:P31/wdt:P279* wd:Q95074 ;
        wdt:P1441 ?work ;
        wikibase:sitelinks ?links .
  { ?work wdt:P31/wdt:P279* wd:Q7725634 . BIND("Book" AS ?kind) }
  UNION
  { ?work wdt:P31/wdt:P279* wd:Q11424 . BIND("Film" AS ?kind) }
  OPTIONAL { ?work wdt:P577 ?date }
  OPTIONAL { ?work wdt:P50|wdt:P57 ?c . ?c rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel)="en") }
  FILTER(?links >= %(min_links)d)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?char ?charLabel ?work ?workLabel ?kind ?links
ORDER BY DESC(?links)
LIMIT %(limit)d OFFSET %(offset)d
"""

# Their houses are canon, so the app skips them.
EXCLUDE_WORK = re.compile(r"harry potter|fantastic beasts", re.I)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=2000)
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--min-links", type=int, default=8, help="Minimum Wikipedia sitelinks (fame filter)")
    a = p.parse_args()

    q = QUERY % {"limit": a.limit, "offset": a.offset, "min_links": a.min_links}
    headers = {"User-Agent": "SortingRegister/0.1 (character list builder)", "Accept": "application/sparql-results+json"}
    for attempt in range(3):
        r = requests.get(ENDPOINT, params={"query": q}, headers=headers, timeout=120)
        if r.status_code == 200:
            break
        time.sleep(10 * (attempt + 1))
    r.raise_for_status()

    existing = {}
    if os.path.exists(OUT):
        with open(OUT) as f:
            existing = {c["id"]: c for c in json.load(f)}

    added = 0
    for row in r.json()["results"]["bindings"]:
        name = row["charLabel"]["value"]
        work = row["workLabel"]["value"]
        if name.startswith("Q") and name[1:].isdigit():
            continue  # no English label
        if EXCLUDE_WORK.search(work):
            continue
        cid = slug(name)
        kind = row["kind"]["value"]
        if cid in existing:
            c = existing[cid]
            if kind not in c["medium"]:
                c["medium"] = "Book & film"
            continue
        existing[cid] = {
            "id": cid,
            "name": name,
            "source": work,
            "creator": row.get("creator", {}).get("value", ""),
            "year": int(row["year"]["value"]) if "year" in row else None,
            "medium": kind,
            "wikidata": row["char"]["value"].rsplit("/", 1)[-1],
            "fame": int(row["links"]["value"]),
        }
        added += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(sorted(existing.values(), key=lambda c: -c["fame"]), f, indent=2, ensure_ascii=False)
    print(f"Added {added} new candidates, {len(existing)} total in {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
