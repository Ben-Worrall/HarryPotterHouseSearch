#!/usr/bin/env bash
# Nightly update: top up the candidate list, sort a batch with Claude Code, commit the result.
# Install with:  crontab -e   then add (runs 02:15 every night):
#   15 2 * * * /path/to/sorting-register/scripts/nightly.sh >> /path/to/sorting-register/data/nightly.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
# cron has a minimal PATH; include the usual places the claude CLI lives.
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

COUNT="${SORT_COUNT:-40}"
echo "=== $(date '+%Y-%m-%d %H:%M') nightly run ==="

# Fetch more candidates when fewer than 200 are waiting.
waiting=$(python3 - <<'PY'
import json, os
c = json.load(open("data/candidates.json")) if os.path.exists("data/candidates.json") else []
s = {x["id"] for x in json.load(open("public/data/characters.json"))}
print(sum(1 for x in c if x["id"] not in s))
PY
)
if [ "$waiting" -lt 200 ]; then
  have=$(python3 -c "import json,os;print(len(json.load(open('data/candidates.json'))) if os.path.exists('data/candidates.json') else 0)")
  python3 scripts/fetch_characters.py --limit 1000 --offset "$have" || echo "fetch failed, continuing"
fi

python3 scripts/sort_characters.py --count "$COUNT"

if [ -d .git ] && ! git diff --quiet -- public/data/characters.json; then
  git add public/data/characters.json data/candidates.json
  git commit -qm "Nightly sort: $(date +%F)"
  git push -q 2>/dev/null || echo "push skipped (no remote yet)"
fi
