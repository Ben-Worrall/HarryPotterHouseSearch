#!/usr/bin/env python3
"""One-time migration: upsert characters.json into Supabase.

Run after creating the table with supabase/schema.sql:
  python3 scripts/migrate_to_supabase.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment.
"""
import json
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))

def load_env():
    env_path = os.path.join(HERE, "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")

    json_path = os.path.join(HERE, "..", "public", "data", "characters.json")
    with open(json_path) as f:
        characters = json.load(f)

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = requests.post(
        f"{url}/rest/v1/characters",
        headers=headers,
        json=characters,
        timeout=30,
    )
    if not r.ok:
        sys.exit(f"Supabase error {r.status_code}: {r.text[:400]}")

    print(f"Migrated {len(characters)} characters to Supabase.")

if __name__ == "__main__":
    main()
