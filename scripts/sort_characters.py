#!/usr/bin/env python3
"""Step 2: sort candidates into Hogwarts houses using Claude Code (covered by a Pro/Max plan).

Runs `claude -p` in headless mode, a small group of characters per call, and merges the
results into public/data/characters.json (the file the site reads). No API key needed:
it uses whatever account the `claude` CLI is logged in with.

Usage:
  python3 scripts/sort_characters.py                 # sort the next 30, 10 per call
  python3 scripts/sort_characters.py --count 60 --group 10

Requires: the Claude Code CLI installed and logged in (run `claude` once and sign in).
Stops early, keeping everything sorted so far, if the plan's usage limit is reached.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

from rubric import SYSTEM, merge, normalise, pending, prompt_for, save

GROUP_INSTRUCTIONS = """

You will receive several characters, separated by '---'. Return ONLY a JSON array with one
object per character, in the same order, each shaped exactly as described above, plus an
"id" key copied from the input. Do not use any tools. Output the JSON array and nothing else."""


def claude_env():
    env = dict(os.environ)
    # If an API key is in the environment the CLI bills the API instead of the Pro plan.
    env.pop("ANTHROPIC_API_KEY", None)
    env.pop("ANTHROPIC_AUTH_TOKEN", None)
    return env


def run_group(group, model):
    body = "\n---\n".join(f"id: {c['id']}\n{prompt_for(c)}" for c in group)
    cmd = ["claude", "-p", "--output-format", "json",
           "--append-system-prompt", SYSTEM + GROUP_INSTRUCTIONS]
    if model:
        cmd += ["--model", model]
    proc = subprocess.run(cmd, input=body, capture_output=True, text=True,
                          env=claude_env(), timeout=600)
    out = proc.stdout.strip()
    try:
        envelope = json.loads(out)
    except json.JSONDecodeError:
        raise RuntimeError((proc.stderr or out or "no output")[-400:])
    text = envelope.get("result", "") if isinstance(envelope, dict) else ""
    if (isinstance(envelope, dict) and envelope.get("is_error")) or proc.returncode != 0:
        raise RuntimeError(text or proc.stderr[-400:] or "claude returned an error")
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        raise RuntimeError("No JSON array in reply")
    return {str(item.get("id")): normalise(item) for item in json.loads(m.group(0)) if isinstance(item, dict)}


def looks_like_limit(msg):
    return bool(re.search(r"usage limit|rate limit|limit reached|try again", msg, re.I))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=30, help="How many characters to sort this run")
    p.add_argument("--group", type=int, default=10, help="Characters per Claude Code call")
    p.add_argument("--model", default=os.environ.get("SORTING_MODEL", ""),
                   help="Optional model alias for claude, e.g. sonnet or opus")
    a = p.parse_args()

    if not shutil.which("claude"):
        sys.exit("The `claude` CLI isn't on PATH. Install Claude Code and sign in first.")

    todo, chars = pending(a.count)
    if not todo:
        print("Nothing new to sort.")
        return

    sorted_n = skipped = 0
    for i in range(0, len(todo), a.group):
        group = todo[i:i + a.group]
        try:
            results = run_group(group, a.model)
        except Exception as e:
            msg = str(e)
            print(f"  ! group {i // a.group + 1} failed: {msg[:200]}")
            if looks_like_limit(msg):
                print("Usage limit reached. Stopping; the rest will be picked up next run.")
                break
            continue
        for c in group:
            res = results.get(c["id"])
            if res:
                chars.append(merge(c, res))
                sorted_n += 1
                print(f"  {c['name']} -> {res['house']}")
            else:
                skipped += 1
        save(chars)

    print(f"Done: {sorted_n} sorted, {skipped} skipped, {len(chars)} characters on file.")


if __name__ == "__main__":
    main()
