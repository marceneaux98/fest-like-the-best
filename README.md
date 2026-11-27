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

An internet connection is needed for the fonts and the Leaflet map library. The map is the festival's own illustrated site map, so there are no map tiles.

| Page | What it is |
|---|---|
| `lineup.html` | Pick sets (grid or list), search, overlap warnings, "already in your schedule" prompt; the round "i" on each set opens the artist's photo, bio and links |
| `itinerary.html` | My day: walking plan, leave-by times, overlap choices, merch suggestion, map, **Share** (the whole plan in a link to email or text; opening one shows that plan and lets the patron use it, add it to their own picks, or go back) |
| `planner.html` | Stage map: walk time between any two stages, all-pairs table |
| `print.html` | Black-and-white schedules to print or save as PDF (Letter, one day per page): the full schedule with every stage as a column, or *My picks* with the My day leave-by times. Opened from the Lineup's "Print / Save as PDF" button and My day's "Print my day"; direct links: `print.html?day=2026-04-25`, `print.html?day=all`, `print.html?view=mine&day=all` |
| `phones.html` | All three pages side by side in phone frames, for reviewing the mobile layout |

Language: menu in the top bar (Français, English, Español, Tiếng Việt; English is the default). Link to a language with `?lang=fr`.

## Update the data

The schedule's source of truth is the **Programming Schedule** board in Monday.com. `build_feed.py` reads it (only the columns listed in `feed.config.json`), validates it, and writes `data/schedule.json` + `data/artists.json`, which the pages load at runtime.

- **Preview** (safe, stays on your machine): set `MONDAY_TOKEN` in your terminal, run `python build_feed.py --edition 2027`, open `http://localhost:8765/lineup.html?preview=1`. `data/preview/` is git-ignored.
- **Publish**: on GitHub → Actions → "Sync schedule from Monday" → Run workflow, pick the edition, tick the confirmation. It is refused unless that edition's `public_from` date in `feed.config.json` is set and in the past, so an unannounced lineup cannot reach the public site by accident. Nothing runs on a timer.

### Artist photos, bios and links

Tapping the "i" on a set (Lineup) or an act's name (My day) opens the artist's photo, origin, genre, bio, links and other shows. All of it comes from the **Artist** board in Monday:

1. **Choose the photo**: put it in the **Preferred Photo** column. If that is empty the app uses **Re-sized Band Photo**, then **Band Photo**. Bios come from *Bio (English)*, links from the website / Facebook / Instagram / video columns.
2. **Publish**: run the "Sync schedule from Monday" workflow as above. It downloads each photo, makes it phone-sized (800 px, under ~150 KB) and saves it in `assets/artists/`; photos that haven't changed in Monday are not downloaded again, and photos removed in Monday are removed from the site.

An artist without a photo or bio still looks fine (a coloured banner with their initials, "Bio coming soon"). The sync lists them as "No photo yet" / "No English bio yet" so you know what to fill in. Previews (`--edition 2027` without publishing) keep their photos in `data/preview/`, never in git.

| To change… | Edit | Then run |
|---|---|---|
| The schedule | The Programming Schedule / Artist boards in Monday | the "Sync schedule" workflow (or `python build_feed.py --publish` locally) |
| An artist's photo, bio or links | The Artist board in Monday (photo: *Preferred Photo* column) | the "Sync schedule" workflow (resizing photos locally needs `python -m pip install pillow`) |
| Which boards/columns the feed reads, and when an edition may go public | `feed.config.json` | — |
| The schedule, from a spreadsheet instead (fallback) | Replace `assets/schedule.xlsx` (same columns) | `python build_schedule.py` → writes `data/schedule.json` |
| Stage pins, names, colours, display order, merch booths | `locations.json` (list order = stage order everywhere) | `python build_routes.py` → fetches walking routes, writes `routes.js` |
| Stage pin positions on the map | `overlay.js` → `stages` (fractions of the poster page); optional `entrances` (where a stage meets the street) | with the server running open `tools/poster-routes.html`, check the routes, click Save (writes `assets/poster-routes.json`) |
| The site map itself (new year's design) | Save the designer's **vector** PDF as `assets/sitemap-vector.pdf`; with the server running open `tools/pdf2svg.html?save=1` (writes `assets/sitemap-raw.svg`) | `python build_sitemap.py` → writes the layered `assets/sitemap.svg`; check layers in `tools/svgview.html?tint=1`; then re-place pins in `overlay.js` and re-save routes with `tools/poster-routes.html` |
| Colours, fonts, logo bar | `brand.css` | — |
| Interface wording / translations | `i18n.js` (one dictionary per language; missing keys fall back to English) | — |

## Checks

Every push to `main` and every pull request runs three automatic checks on GitHub (nothing to install; they run on GitHub's computers). See them at **GitHub → Actions → "Checks"**: green tick = all good, red cross = open the run, and the **Summary** page says what failed in plain words. Dependabot also opens a pull request about once a week when one of the GitHub Actions the workflows use has a newer version; the checks run on that pull request too, so it is safe to merge when green.

| Check | What it does | If it fails |
|---|---|---|
| **Static checks** | Makes sure every Python script still compiles, that `data/schedule.json`, `data/artists.json`, `locations.json` and `feed.config.json` are valid JSON, that every set in the schedule is on a known stage with an end time after its start, that every piece of translatable text in the pages has an English entry in `i18n.js`, and that the 2027 edition is still embargoed. | The Summary lists each problem with the file and key or set involved. Usually a typo in a data file or a translation key. Run `python tools/check_static.py` locally to see the same report. |
| **Smoke test** | Opens the site in a real browser (Playwright + Chromium), picks two Thursday sets on different stages, opens *My day* and confirms the plan shows both stops and a "Leave …" time, with no JavaScript errors. Then opens the printable schedule and checks every set is on it, no text is cut off, it prints one page per day, and *Print my day* lists the picks with leave-by times. Runs once at desktop size and once at phone size. | Something in the pick → plan → print flow is broken for patrons. The run's *playwright-report* artifact (bottom of the run page) has a screenshot and a step-by-step trace of where it stopped. |
| **Lighthouse (mobile)** | Google's page-quality audit on `lineup.html` and `itinerary.html` as a phone would load them. The Summary shows four scores out of 100: performance, accessibility, best practices and PWA (how close the site is to an installable app). | Only **accessibility below 90** fails the check; the other three are shown for information. The *lighthouse-reports* artifact holds the full HTML reports, each with the list of things to fix. |

The test code lives in `tests/` (Playwright needs Node, but only on GitHub; the app itself still has no build step) and `tools/`. The Monday sync workflow is separate and still runs only when someone presses *Run workflow*.

## Files

- `i18n.js`: all interface text in four languages, plus date/time formatting and the language menu
- `common.js`: shared helpers (`FIL.*`): HTML escaping, time parsing, saved-state access, the share-link format (`FIL.plan`, kept after the `#` so it never reaches a server), the stage list with colours, and the brand bar that every page shows
- `brand.css`: brand colours (#1984C7 / #542E91 / #F26631), page colour tokens, fonts, base styles, logo bar, title band. Each page's own `<style>` holds only what is specific to that page.
- `site-overlay.js` + `overlay.js`: the map, which is the festival poster (`assets/sitemap.svg`) shown upright with pan/zoom, stage pins, routes along its drawn streets (`assets/poster-routes.json`) and layer toggles (streets, areas, icons & vendors, labels, legend, logo)
- `tools/poster-routes.html`: traces stage-to-stage routes along the streets drawn on the poster and saves them
- `build_sitemap.py`, `tools/pdf2svg.html`, `tools/svgview.html`: turn the designer's vector PDF into the layered SVG and check the result
- `serve.py`: local server that always serves fresh files (no stale cache after a rebuild)
- `build_feed.py` + `feed.config.json`: the Monday.com feed (allowlisted columns, validation, publish gate, artist photos); `.github/workflows/sync-schedule.yml` runs it on demand
- `artist.js`: the "About this artist" sheet shared by Lineup and My day (its styles are at the end of `brand.css`)
- `data/`: the published `schedule.json` and `artists.json`; `data/preview/` holds local previews and is never committed
- `build_schedule.py`, `build_routes.py`: spreadsheet fallback and walking-route builder (standard library only, no installs)
- `assets/`: logo (PDF + PNG), swirl icon, site map PDF, schedule spreadsheet; `assets/artists/` holds the artist photos the sync writes (`sources.json` = which Monday file each came from)
- `tools/pdfview.html`: helper for viewing a PDF page in the browser
- `tools/check_static.py`, `tools/lighthouse_summary.py`, `tests/`: the automatic checks (see *Checks* above); `.github/workflows/checks.yml` runs them, `.github/dependabot.yml` keeps the Actions versions current

## Known open items

- Scène des Jeunes pin is estimated from the site map. Replace it with a real pin in `locations.json`.
- Merch booth pins use their stage's pin. Add exact booth spots if they differ.
- Breabach, Sat 8:45 AM at Fais Do Do looks like a spreadsheet typo (only set before 11 AM).
- Translations are a first draft and need native-speaker review before launch.
- Futura, Ando and Thirsty Script are licensed fonts; free look-alikes (Jost, Saira Condensed, Yellowtail) load unless the real fonts are installed or web-licensed.
- Walking routes use OpenStreetMap streets and don't know about festival fencing or closed gates.
- Picks are saved in each browser (localStorage), so they don't move between devices.

## Feedback and sharing

- Every page has a slim **Preview** strip with a **Tell us what you think** link. It opens the Monday form "Fest like the Best · Feedback" (ZSandbox → Fest Like The Best folder); each response becomes an item on that board, with the page and language the person came from filled in automatically. The link lives in `common.js` (`FEEDBACK_URL`).
- Link previews (Facebook, iMessage, Slack) use the `og:` tags in each page's `<head>` and `assets/og-image.png`. To redraw the picture, run the server and open `tools/og-image.html`, then Save. After publishing a change, ask Facebook to re-read the link with its Sharing Debugger (developers.facebook.com/tools/debug).
