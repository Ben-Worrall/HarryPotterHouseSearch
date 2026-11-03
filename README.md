# The Sorting Register

Search fictional characters from books and films and see which Hogwarts house they'd be sorted into: a score for each house, the reasoning, a runner-up house, and background on the character.

## Run it

```bash
python3 serve.py              # http://localhost:8080
python3 serve.py --port 3000  # pick a port
```

No dependencies for the site itself. It binds to `0.0.0.0`, so other devices on your network can reach it at `http://<laptop-ip>:8080`.

## Grow the character list

Sorting runs through Claude Code on your Pro plan, so there's no API bill.

```bash
pip install -r requirements.txt
claude          # once, to sign in to Claude Code with your Pro account

# 1. Pull candidates from Wikidata (best-known first)
python3 scripts/fetch_characters.py --limit 2000

# 2. Sort them with Claude Code (10 characters per call)
python3 scripts/sort_characters.py --count 30
```

Sorted characters are merged into `public/data/characters.json`. Refresh the page to see them. If you hit your plan's usage limit, the script stops and keeps everything sorted so far; the next run carries on.

### Run it every night

```bash
crontab -e
# add this line (02:15 every night, 40 characters per run):
15 2 * * * /full/path/to/sorting-register/scripts/nightly.sh >> /full/path/to/sorting-register/data/nightly.log 2>&1
```

`nightly.sh` tops up the candidate list when it runs low, sorts the next batch, and commits the result (and pushes, once a GitHub remote is set). Change the batch size with `SORT_COUNT=60` in the cron line. The laptop needs to be on at that time.

### Optional: bulk runs through the API

`scripts/sort_with_api.py` does the same job through the Anthropic API, which is billed separately from Pro. Only worth it for a big one-off jump (thousands at once).

## Layout

```
serve.py                      local web server (stdlib only)
public/index.html             page markup
public/styles.css             design tokens + styles (light/dark)
public/app.js                 search, filters, detail card
public/data/characters.json   sorted characters the site reads
data/candidates.json          raw list from Wikidata (created by step 1)
scripts/fetch_characters.py   step 1: build candidate list
scripts/sort_characters.py    step 2: sort with the Claude API
```

## Character record

```json
{
  "id": "samwise-gamgee",
  "name": "Samwise Gamgee",
  "source": "The Lord of the Rings",
  "creator": "J. R. R. Tolkien",
  "year": 1954,
  "medium": "Book & film",
  "house": "Hufflepuff",
  "scores": { "Gryffindor": 30, "Slytherin": 2, "Ravenclaw": 6, "Hufflepuff": 62 },
  "traits": ["Loyalty", "Endurance", "Humility"],
  "background": "...",
  "reasoning": "..."
}
```
