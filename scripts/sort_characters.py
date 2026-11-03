#!/usr/bin/env python3
"""Step 2: sort candidates into Hogwarts houses with the Claude API.

Reads data/candidates.json, skips anyone already in public/data/characters.json,
asks Claude for scores, traits, background and reasoning, and merges the results
into public/data/characters.json (the file the site reads).

Usage:
  export ANTHROPIC_API_KEY=...
  python3 scripts/sort_characters.py --count 50             # quick run, one request at a time
  python3 scripts/sort_characters.py --count 2000 --batch   # Message Batches API, cheaper for large runs

Requires: pip install anthropic
"""
import argparse
import json
import os
import re
import time

import anthropic

HERE = os.path.dirname(os.path.abspath(__file__))
CANDIDATES = os.path.join(HERE, "..", "data", "candidates.json")
SITE_DATA = os.path.join(HERE, "..", "public", "data", "characters.json")
MODEL = os.environ.get("SORTING_MODEL", "claude-sonnet-5-5")
HOUSES = ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"]

SYSTEM = """You are the Sorting Hat for characters from all of fiction. Judge each character on who they are across their story, not one scene.

House criteria:
- Gryffindor: courage, nerve, chivalry, acting boldly on principle.
- Slytherin: ambition, cunning, resourcefulness, self-preservation, pride.
- Ravenclaw: intellect, curiosity, wit, creativity, love of learning.
- Hufflepuff: loyalty, patience, hard work, fairness, kindness.

Return ONLY a JSON object with these keys:
  "scores": integer percentages for Gryffindor, Slytherin, Ravenclaw, Hufflepuff, summing to 100
  "house": the house with the highest score
  "traits": 3 short trait labels (1-3 words each)
  "background": 2 sentences of spoiler-light background on the character and their story
  "reasoning": 3-4 sentences on why they belong in that house, citing specific actions from the story, and naming the runner-up house and why it came close

Write in plain, direct English in your own words. Do not quote the source text.
If you do not know the character well enough to judge, return {"unknown": true}."""


def prompt_for(c):
    bits = [f"Character: {c['name']}", f"From: {c['source']}"]
    if c.get("creator"):
        bits.append(f"Creator: {c['creator']}")
    if c.get("year"):
        bits.append(f"Year: {c['year']}")
    return "\n".join(bits)


def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    data = json.loads(m.group(0))
    if data.get("unknown"):
        return None
    scores = {h: int(data["scores"][h]) for h in HOUSES}
    total = sum(scores.values()) or 1
    scores = {h: round(v * 100 / total) for h, v in scores.items()}
    data["scores"] = scores
    data["house"] = max(scores, key=scores.get)
    return data


def merge(c, result):
    return {
        "id": c["id"], "name": c["name"], "source": c["source"], "creator": c.get("creator", ""),
        "year": c.get("year"), "medium": c["medium"], "house": result["house"],
        "scores": result["scores"], "traits": result["traits"][:3],
        "background": result["background"], "reasoning": result["reasoning"],
    }


def load(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save(chars):
    with open(SITE_DATA, "w") as f:
        json.dump(sorted(chars, key=lambda c: c["name"]), f, indent=2, ensure_ascii=False)


def request_params(c):
    return {"model": MODEL, "max_tokens": 800, "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt_for(c)}]}


def run_direct(client, todo, chars):
    for i, c in enumerate(todo, 1):
        try:
            msg = client.messages.create(**request_params(c))
            res = parse(msg.content[0].text)
        except Exception as e:
            print(f"  ! {c['name']}: {e}")
            continue
        if res:
            chars.append(merge(c, res))
            print(f"[{i}/{len(todo)}] {c['name']} -> {res['house']}")
        else:
            print(f"[{i}/{len(todo)}] {c['name']} skipped (not well known)")
        if i % 10 == 0:
            save(chars)
    save(chars)


def run_batch(client, todo, chars):
    by_id = {c["id"]: c for c in todo}
    batch = client.messages.batches.create(requests=[
        {"custom_id": c["id"][:64], "params": request_params(c)} for c in todo
    ])
    print(f"Batch {batch.id} submitted with {len(todo)} characters. Polling every 60s...")
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        print(f"  {batch.request_counts}")
        time.sleep(60)
    ok = 0
    for r in client.messages.batches.results(batch.id):
        c = by_id.get(r.custom_id)
        if not c or r.result.type != "succeeded":
            continue
        res = parse(r.result.message.content[0].text)
        if res:
            chars.append(merge(c, res))
            ok += 1
    save(chars)
    print(f"Sorted {ok} of {len(todo)}.")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=50)
    p.add_argument("--batch", action="store_true", help="Use the Message Batches API")
    a = p.parse_args()

    candidates = load(CANDIDATES, [])
    if not candidates:
        raise SystemExit("No data/candidates.json yet. Run scripts/fetch_characters.py first.")
    chars = load(SITE_DATA, [])
    done = {c["id"] for c in chars}
    todo = [c for c in candidates if c["id"] not in done][: a.count]
    if not todo:
        print("Nothing new to sort.")
        return

    client = anthropic.Anthropic()
    (run_batch if a.batch else run_direct)(client, todo, chars)


if __name__ == "__main__":
    main()
