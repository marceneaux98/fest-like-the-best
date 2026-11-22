# Fest like the Best: context for Claude

Static web app (no framework, no build) for Festival International de Louisiane 2026 patrons. See README.md for running and data updates.

## Decisions already made with the user
- Product name / tagline: **"Fest like the Best"** (brand script, next to the logo; in page titles).
- Brand kit: Blue #1984C7, Purple #542E91, Orange #F26631. Fonts: Futura Bold Italic (headlines), Futura Medium (text), Ando (condensed display), Thirsty Script (accent). Free stand-ins: Jost, Saira Condensed, Yellowtail. Full-colour logo on white; reversed/white on dark.
- Stage order everywhere: Internationale, Fais Do Do, Lafayette, Biergarten, FrancoSphere, Pavillon, Scène des Jeunes (driven by the order in locations.json).
- Languages: menu lists Français first; English is the default; also Español, Tiếng Việt. All UI strings live in i18n.js; never hard-code English in pages.
- Merch: three booths (Pavillon, Lafayette, Fais Do Do). The app suggests a time automatically (break that fits detour + shopping with ≥3 min spare, else before first set); patron can accept, pick another time, or decline.
- Overlaps / tight connections: patron chooses leave early, split the difference, or stay to the end.
- Picking an artist already in the plan opens a "Switch / Keep both / Cancel" prompt; grid blocks list the artist's other shows at the bottom ("Also: …", ✓ = in plan).
- Picking or changing options must not reset scroll position or re-zoom the map.

## Working notes
- Schedule data: source of truth is Monday.com (board IDs/columns in `feed.config.json`). `build_feed.py` writes `data/schedule.json` + `data/artists.json`; pages load them at runtime via `FIL.ready()`. The 2027 lineup is confidential until announced: never set `public_from` for 2027 or commit `data/preview/`; the sync workflow is manual only. The Artist board holds SSNs and payment details, so only allowlisted columns are ever read.
- Shared code lives in `common.js` (`FIL.esc`, `FIL.toMin`, `FIL.store`, `FIL.stages`/`stageById`/`stageColor`, brand bar from `<div class="brand-bar" data-page="…">`) and `brand.css` (colour tokens, fonts, base styles). Stage names, colours and order come from `locations.json` only. Pages keep only page-specific CSS/JS.
- Git: branch `main`, commit identity set per-repo. This machine has `python` (Store install), not the `py` launcher, Git lives at `C:\Program Files\Git\cmd` and the GitHub CLI at `C:\Program Files\GitHub CLI` (both may need adding to PATH in a fresh shell).
- Serve with `python serve.py` (no-cache headers). Test in a separate origin (http://127.0.0.1:8765) so test picks don't overwrite the user's saved picks on http://localhost:8765. localStorage keys start with `fil-`.
- Python here may be old (3.8) and pip installs may be blocked; keep scripts standard-library only.
- Check pages at phone width (375px) as well as desktop; `phones.html` shows all three.
