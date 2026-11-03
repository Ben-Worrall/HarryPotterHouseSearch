# The Sorting Register — project context

A web app that lists fictional characters from books and films and sorts each into a Hogwarts house, with per-house percentage scores, a detailed reasoning paragraph, a runner-up house and character background. Started in a Claude chat and moved here to run on Sir's laptop (Ubuntu) and be driven from the terminal / remote control.

## How it works
- Static front end in `public/` (vanilla HTML/CSS/JS, no build step). `app.js` fetches `public/data/characters.json`.
- `serve.py` serves `public/` with the Python standard library on `0.0.0.0:8080`.
- Data pipeline:
  1. `scripts/fetch_characters.py` queries Wikidata for characters present in literary works or films, ranked by Wikipedia sitelinks, into `data/candidates.json`. Harry Potter / Fantastic Beasts characters are excluded (houses are canon).
  2. `scripts/sort_characters.py` sends each candidate to the Claude API with a fixed house rubric and merges results into `public/data/characters.json`. `--batch` uses the Message Batches API for large runs. Model set by `SORTING_MODEL` env var.
- The 45 starter characters were written by hand in chat and match the same record format.

## Conventions
- Record format is documented in README.md. Keep `scores` as an object keyed by house, summing to 100; `house` must equal the top score.
- Background and reasoning are original writing, never quoted from the source works.
- Design: archival "register" look. Colors are CSS tokens in `styles.css` with light and dark themes; house colors are `--gry`, `--sly`, `--rav`, `--huf`. Fonts: IM Fell English (display), Source Serif 4 (body), IBM Plex Mono (labels).

## Roadmap
1. Test-run the pipeline on ~50 characters and review quality.
2. Bulk run (thousands), with a review pass on "close call" sorts (top two houses within 12 points).
3. Once the JSON gets large (~5k+), paginate or move to SQLite with a small API, and add search indexing.
4. Optional: TMDB/Open Library as extra sources, character images (licensed only), a "sort a character on demand" button that calls the API live.
