# Fest like the Best

A festival planner for Festival International de Louisiane 2026, presented by LFT Fiber. Patrons pick the sets they want to see, then get a walking plan between stages: when to leave, how much of each set they'll catch, how to handle overlaps, and when to visit merch.

It's plain HTML, CSS and JavaScript with no build step. Python is only needed for the local web server and for regenerating the data files.

## Run it

1. Install **Python 3.8 or newer** if needed (`python --version` on Windows, `python3 --version` on Mac/Linux).
2. In this folder, start the server:
   ```
   python serve.py      # Windows
   python3 serve.py     # Mac / Linux
   ```
3. Open **http://localhost:8765/** (it opens the Lineup page)

An internet connection is needed for the map tiles, fonts and the map/PDF libraries.

| Page | What it is |
|---|---|
| `lineup.html` | Pick sets (grid or list), search, overlap warnings, "already in your schedule" prompt |
| `itinerary.html` | My day: walking plan, leave-by times, overlap choices, merch suggestion, map |
| `planner.html` | Stage map: walk time between any two stages, all-pairs table |
| `phones.html` | All three pages side by side in phone frames, for reviewing the mobile layout |

Language: menu in the top bar (Français, English, Español, Tiếng Việt; English is the default). Link to a language with `?lang=fr`.

## Update the data

The schedule's source of truth is the **Programming Schedule** board in Monday.com. `build_feed.py` reads it (only the columns listed in `feed.config.json`), validates it, and writes `data/schedule.json` + `data/artists.json`, which the pages load at runtime.

- **Preview** (safe, stays on your machine): set `MONDAY_TOKEN` in your terminal, run `python build_feed.py --edition 2027`, open `http://localhost:8765/lineup.html?preview=1`. `data/preview/` is git-ignored.
- **Publish**: on GitHub → Actions → "Sync schedule from Monday" → Run workflow, pick the edition, tick the confirmation. It is refused unless that edition's `public_from` date in `feed.config.json` is set and in the past, so an unannounced lineup cannot reach the public site by accident. Nothing runs on a timer.

| To change… | Edit | Then run |
|---|---|---|
| The schedule | The Programming Schedule / Artist boards in Monday | the "Sync schedule" workflow (or `python build_feed.py --publish` locally) |
| Which boards/columns the feed reads, and when an edition may go public | `feed.config.json` | — |
| The schedule, from a spreadsheet instead (fallback) | Replace `assets/schedule.xlsx` (same columns) | `python build_schedule.py` → writes `data/schedule.json` |
| Stage pins, names, colours, display order, merch booths | `locations.json` (list order = stage order everywhere) | `python build_routes.py` → fetches walking routes, writes `routes.js` |
| Site map overlay alignment | `overlay.js` control points; open `planner.html?align` to see the error per point | — |
| The site map itself | Replace `assets/sitemap.pdf` | — |
| Colours, fonts, logo bar | `brand.css` | — |
| Interface wording / translations | `i18n.js` (one dictionary per language; missing keys fall back to English) | — |

## Files

- `i18n.js`: all interface text in four languages, plus date/time formatting and the language menu
- `common.js`: shared helpers (`FIL.*`): HTML escaping, time parsing, saved-state access, the stage list with colours, and the brand bar that every page shows
- `brand.css`: brand colours (#1984C7 / #542E91 / #F26631), page colour tokens, fonts, base styles, logo bar, title band. Each page's own `<style>` holds only what is specific to that page.
- `site-overlay.js` + `overlay.js`: places the illustrated site map on the street map
- `serve.py`: local server that always serves fresh files (no stale cache after a rebuild)
- `build_feed.py` + `feed.config.json`: the Monday.com feed (allowlisted columns, validation, publish gate); `.github/workflows/sync-schedule.yml` runs it on demand
- `data/`: the published `schedule.json` and `artists.json`; `data/preview/` holds local previews and is never committed
- `build_schedule.py`, `build_routes.py`: spreadsheet fallback and walking-route builder (standard library only, no installs)
- `assets/`: logo (PDF + PNG), swirl icon, site map PDF, schedule spreadsheet
- `tools/pdfview.html`: helper for viewing a PDF page in the browser

## Known open items

- Scène des Jeunes pin is estimated from the site map. Replace it with a real pin in `locations.json`.
- Merch booth pins use their stage's pin. Add exact booth spots if they differ.
- Breabach, Sat 8:45 AM at Fais Do Do looks like a spreadsheet typo (only set before 11 AM).
- Translations are a first draft and need native-speaker review before launch.
- Futura, Ando and Thirsty Script are licensed fonts; free look-alikes (Jost, Saira Condensed, Yellowtail) load unless the real fonts are installed or web-licensed.
- Walking routes use OpenStreetMap streets and don't know about festival fencing or closed gates.
- Picks are saved in each browser (localStorage), so they don't move between devices.
