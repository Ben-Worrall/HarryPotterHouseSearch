# The Sorting Register

Search fictional characters from books and films and see which Hogwarts house they'd be sorted into: a score for each house, the reasoning, a runner-up house, and background on the character.

## Run it

```bash
python3 serve.py              # http://localhost:8080
python3 serve.py --port 3000  # pick a port
```

No dependencies for the site itself. It binds to `0.0.0.0`, so other devices on your network can reach it at `http://<laptop-ip>:8080`.

## Grow the character list

```bash
pip install -r requirements.txt
cp .env.example .env   # then add your keys
export ANTHROPIC_API_KEY=sk-ant-...

# 1. Pull candidates from Wikidata (best-known first)
python3 scripts/fetch_characters.py --limit 2000

# 2. Sort them with Claude
python3 scripts/sort_characters.py --count 50            # small test run
python3 scripts/sort_characters.py --count 2000 --batch  # bulk, cheaper
```

Sorted characters are merged into `public/data/characters.json`. Refresh the page to see them.

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
