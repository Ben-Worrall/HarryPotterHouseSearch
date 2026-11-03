# The Sorting Register — project context

A web app that lists fictional characters from books and films and sorts each into a Hogwarts house. Each character gets per-house percentage scores, a detailed reasoning paragraph, a runner-up house and background on the character.

The user (address him as "Sir") started this in a Claude chat and moved it here. He runs it on his Ubuntu laptop from the terminal and drives Claude Code with remote control (/rc).

## Current state
- Static front end in `public/` (vanilla HTML/CSS/JS, no build step). `app.js` fetches `public/data/characters.json`.
- 45 hand-written starter characters in `public/data/characters.json`.
- `serve.py` serves `public/` with the Python standard library on `0.0.0.0:8080`. Run: `python3 serve.py`.
- Pipeline scripts are written but not yet run against live services:
  1. `scripts/fetch_characters.py` queries Wikidata for characters present in literary works or films, ranked by Wikipedia sitelinks, into `data/candidates.json`. Harry Potter and Fantastic Beasts characters are excluded because their houses are canon.
  2. `scripts/sort_characters.py` sorts candidates by calling Claude Code headless (`claude -p --output-format json`), 10 characters per call, and merges results into `public/data/characters.json`. It strips `ANTHROPIC_API_KEY` from the subprocess env so usage stays on Sir's Pro plan. Stops cleanly on usage limits.
  3. `scripts/nightly.sh` is the cron job: tops up candidates when fewer than 200 are waiting, sorts `SORT_COUNT` (default 40), commits and pushes.
  - `scripts/rubric.py` holds the house rubric and shared helpers. `scripts/sort_with_api.py` is an optional paid-API sorter for big one-off runs; not the default.

## Decisions made in chat
- **Hosting:** Vercel, on Sir's own account, embedded on his website. Do not add Vercel config until he says to; he said to hold that.
- **Source control:** Sir will give access to his GitHub. Push the repo there once he provides it.
- **Database:** Supabase, once the character list outgrows one JSON file (roughly 5,000+) or live features are needed. Planned shape: a `characters` table matching the record format below; the sort script upserts into it; the front end reads with supabase-js and searches server-side; the anon key stays read-only through row-level security.
- **Scope:** characters from as many books and films as possible, growing over time.
- **Where character information comes from:**
  - The list of characters: Wikidata (free, CC0). TMDB for films and Open Library for books can fill gaps.
  - Background material: each character's Wikipedia summary, passed to Claude as grounding.
  - House, scores, traits and reasoning: written by Claude using the rubric in `sort_characters.py`.
- **Sorting engine:** Claude Code on Sir's Pro plan, not the paid API. He chose this to avoid paying twice. Throughput is limited by Pro usage limits, so the list grows in nightly batches.
- **Automatic updates:** a cron job on the laptop (`scripts/nightly.sh`) that finds characters not yet stored, sorts them with Claude Code and saves them. Later it will also pull Wikipedia summaries and write to Supabase. Sorts where the top two houses are within 12 points get flagged for review. The laptop must be on when it runs.

## Keys and access Sir will provide (not needed until each step)
- GitHub repo access
- Supabase project URL, anon key and service role key
- TMDB API key (free)

Store these in `.env` (gitignored). See `.env.example`. Never commit keys.

## Next steps, in order
1. Confirm the site runs locally with `python3 serve.py`.
2. Push to Sir's GitHub once he gives access.
3. Run `fetch_characters.py`, then `sort_characters.py --count 30`, and review quality with Sir.
4. Install the nightly cron job (see README) once he's happy with the results.
5. Add Wikipedia summary grounding to `sort_characters.py`.
6. Set up Supabase, migrate the JSON data and switch the front end to read from it.
7. Deploy to Vercel when Sir is ready.

## Conventions
- Record format is documented in README.md. Keep `scores` as an object keyed by house, summing to 100; `house` must equal the top score.
- Background and reasoning are original writing, never quoted from the source works.
- Design: archival "register" look. Colors are CSS tokens in `styles.css` with light and dark themes; house colors are `--gry`, `--sly`, `--rav`, `--huf`. Fonts: IM Fell English (display), Source Serif 4 (body), IBM Plex Mono (labels).
- Python scripts use the standard library where possible; dependencies are listed in `requirements.txt`.
