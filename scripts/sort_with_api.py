#!/usr/bin/env python3
"""Optional: sort candidates with the Anthropic API instead of Claude Code (billed separately from Pro).

Use this only for large one-off runs. The default sorter is sort_characters.py.

Reads data/candidates.json, skips anyone already in public/data/characters.json,
asks Claude for scores, traits, background and reasoning, and merges the results
into public/data/characters.json (the file the site reads).

Usage:
  export ANTHROPIC_API_KEY=...
  python3 scripts/sort_with_api.py --count 50             # quick run, one request at a time
  python3 scripts/sort_with_api.py --count 2000 --batch   # Message Batches API, cheaper for large runs

Requires: pip install anthropic
"""
import argparse
import os
import time

import anthropic

from rubric import SYSTEM, merge, parse_object as parse, pending, prompt_for, save

MODEL = os.environ.get("SORTING_MODEL_API", "claude-sonnet-5-5")


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

    todo, chars = pending(a.count)
    if not todo:
        print("Nothing new to sort.")
        return

    client = anthropic.Anthropic()
    (run_batch if a.batch else run_direct)(client, todo, chars)


if __name__ == "__main__":
    main()
