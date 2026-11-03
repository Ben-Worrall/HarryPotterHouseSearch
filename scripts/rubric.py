"""Shared sorting rubric and data helpers used by both sorters."""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CANDIDATES = os.path.join(HERE, "..", "data", "candidates.json")
SITE_DATA = os.path.join(HERE, "..", "public", "data", "characters.json")
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


def normalise(data):
    """Validate one result dict. Returns None for unknown or malformed results."""
    if not isinstance(data, dict) or data.get("unknown"):
        return None
    try:
        scores = {h: int(data["scores"][h]) for h in HOUSES}
        total = sum(scores.values()) or 1
        scores = {h: round(v * 100 / total) for h, v in scores.items()}
        return {
            "house": max(scores, key=scores.get),
            "scores": scores,
            "traits": list(data["traits"])[:3],
            "background": str(data["background"]).strip(),
            "reasoning": str(data["reasoning"]).strip(),
        }
    except (KeyError, TypeError, ValueError):
        return None


def parse_object(text):
    m = re.search(r"\{.*\}", text, re.S)
    return normalise(json.loads(m.group(0))) if m else None


def merge(c, result):
    return {
        "id": c["id"], "name": c["name"], "source": c["source"], "creator": c.get("creator", ""),
        "year": c.get("year"), "medium": c["medium"], **result,
    }


def load(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save(chars):
    tmp = SITE_DATA + ".tmp"
    with open(tmp, "w") as f:
        json.dump(sorted(chars, key=lambda c: c["name"]), f, indent=2, ensure_ascii=False)
    os.replace(tmp, SITE_DATA)


def pending(count):
    candidates = load(CANDIDATES, [])
    if not candidates:
        raise SystemExit("No data/candidates.json yet. Run scripts/fetch_characters.py first.")
    chars = load(SITE_DATA, [])
    done = {c["id"] for c in chars}
    return [c for c in candidates if c["id"] not in done][:count], chars
