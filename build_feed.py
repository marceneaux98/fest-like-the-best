"""Build the public schedule feed from Monday.com.

Reads the Programming Schedule board and the Artist board (IDs and column allowlist in
feed.config.json), validates the rows, and writes:

    data/schedule.json   performances by day (what the app loads)
    data/artists.json    name, origin, genre, bio, links and photo per artist
    assets/artists/      one web-sized photo per artist (<artist id>.jpg) + sources.json, which records
                         the Monday file each photo came from so unchanged photos are not downloaded again

Usage:
    python build_feed.py                      preview build (writes to data/preview/, git-ignored)
    python build_feed.py --publish            writes to data/ (the public files) - refused unless the
                                              edition's public_from date in feed.config.json has passed
    python build_feed.py --edition 2027       pick an edition from feed.config.json (default: default_edition)

Needs the environment variable MONDAY_TOKEN (a Monday.com personal API token). The token is never
written anywhere. Standard library only, Python 3.8+. Resizing photos needs Pillow (the GitHub workflow
installs it); without it a preview keeps the original photos and --publish keeps the photos it already has.
Preview builds put their photos in data/preview/artists/, which is never committed.

Exit codes: 0 ok, 1 validation errors (nothing written), 2 publish refused (preview written instead).
"""
import argparse
import datetime
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.monday.com/v2"
API_VERSION = "2025-01"
USER_AGENT = "fest-like-the-best-feed/1.0"


# ---------------------------------------------------------------- Monday API
class Monday:
    def __init__(self, token):
        self.token = token

    def query(self, gql, variables=None):
        body = json.dumps({"query": gql, "variables": variables or {}}).encode("utf-8")
        req = urllib.request.Request(API, data=body, headers={
            "Authorization": self.token,
            "API-Version": API_VERSION,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.load(resp)
        except urllib.error.HTTPError as e:
            raise SystemExit("Monday API HTTP %s: %s" % (e.code, e.read()[:500]))
        if data.get("errors"):
            raise SystemExit("Monday API error: %s" % json.dumps(data["errors"])[:800])
        return data["data"]

    def board_items(self, board_id, column_ids):
        """Every item on a board with the given columns (follows the cursor)."""
        cols = json.dumps(column_ids)
        fields = """
          id name group { id title }
          column_values(ids: %s) {
            id type text
            ... on DateValue { date }
            ... on HourValue { hour minute }
            ... on StatusValue { label }
            ... on BoardRelationValue { linked_item_ids display_value }
            ... on FormulaValue { display_value }
            ... on MirrorValue { display_value }
          }""" % cols
        first = self.query("query($b:[ID!]) { boards(ids:$b) { items_page(limit: 500) { cursor items { %s } } } }" % fields,
                           {"b": [str(board_id)]})
        page = first["boards"][0]["items_page"]
        items = list(page["items"])
        cursor = page.get("cursor")
        while cursor:
            nxt = self.query("query($c:String!) { next_items_page(cursor:$c, limit: 500) { cursor items { %s } } }" % fields,
                             {"c": cursor})["next_items_page"]
            items.extend(nxt["items"])
            cursor = nxt.get("cursor")
        return items

    def items_by_id(self, ids, column_ids):
        out = []
        ids = [str(i) for i in ids]
        for i in range(0, len(ids), 100):
            chunk = ids[i:i + 100]
            # items(ids:) silently returns only 25 unless limit is raised to match the chunk.
            data = self.query("""
              query($ids:[ID!], $cols:[String!]) { items(ids:$ids, limit: 100) { id name
                column_values(ids:$cols) { id type text ... on LinkValue { url } ... on LongTextValue { text }
                  ... on FileValue { files { ... on FileAssetValue { asset_id name is_image } } } } } }""",
                              {"ids": chunk, "cols": column_ids})
            out.extend(data["items"])
        missing = set(ids) - {it["id"] for it in out}
        if missing:
            print("  WARNING: %d linked artist(s) could not be read (not on the artist board, or no access): %s"
                  % (len(missing), ", ".join(sorted(missing)[:5]) + (" …" if len(missing) > 5 else "")))
        return out

    def board_columns(self, board_id, column_ids):
        """Which of these column ids exist on the board (ids only: no item data is read)."""
        data = self.query("query($b:[ID!], $c:[String!]) { boards(ids:$b) { columns(ids:$c) { id } } }",
                          {"b": [str(board_id)], "c": column_ids})
        boards = data.get("boards") or []
        return {c["id"] for c in (boards[0].get("columns") or [])} if boards else set()

    def asset_urls(self, asset_ids):
        """Download links for files. Monday signs them and they expire after about an hour."""
        out = {}
        ids = [str(i) for i in asset_ids]
        for i in range(0, len(ids), 50):
            data = self.query("query($ids:[ID!]!) { assets(ids:$ids) { id public_url } }", {"ids": ids[i:i + 50]})
            for a in data.get("assets") or []:
                if a and a.get("public_url"):
                    out[str(a["id"])] = a["public_url"]
        return out


def colmap(item):
    return {c["id"]: c for c in item["column_values"]}


def hhmm(col):
    if not col or col.get("hour") is None:
        return None
    return "%02d:%02d" % (col["hour"], col["minute"] or 0)


# ---------------------------------------------------------------- artist photos
PHOTO_EXTS = {"jpg", "jpeg", "png", "webp", "tif", "tiff"}
MAX_DOWNLOAD = 40 * 1024 * 1024       # a band photo bigger than this is not a photo we want to fetch
MANIFEST = "sources.json"
PHOTO_FILE = re.compile(r"^\d+\.(jpe?g|png|webp|tiff?)$")


def photo_candidates(c, ac, photo_keys):
    """Every image in the photo columns, best first: Preferred Photo, then Re-sized, then Band Photo."""
    out = []
    for key in photo_keys:
        col = c.get(ac.get(key)) or {}
        for f in col.get("files") or []:
            name = f.get("name") or ""
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if f.get("asset_id") and ext in PHOTO_EXTS:
                out.append({"asset": str(f["asset_id"]), "column": key, "ext": ext})
    return out


def load_pillow():
    try:
        from PIL import Image, ImageOps  # noqa: F401  (only installed in the GitHub workflow)
        return Image, ImageOps
    except ImportError:
        return None


def web_photo(data, pil, max_side, max_bytes):
    """Any image -> (JPEG bytes no larger than max_side on its long side, aiming under max_bytes)."""
    Image, ImageOps = pil
    im = Image.open(io.BytesIO(data))
    icc = im.info.get("icc_profile") if im.mode == "RGB" else None   # keep colours right; drop CMYK profiles
    try:
        im.draft("RGB", (max_side, max_side))  # JPEG: decode at a smaller scale, much faster for big photos
    except Exception:
        pass
    im = ImageOps.exif_transpose(im)  # phone photos store "rotate me" in EXIF; bake it in
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.getchannel("A"))
        im = flat
    elif im.mode != "RGB":
        im = im.convert("RGB")
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    out = b""
    for quality in (82, 76, 70, 64, 58, 52):
        buf = io.BytesIO()
        # No exif= argument, so camera details and any GPS location are not copied into the public file.
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True, **({"icc_profile": icc} if icc else {}))
        out = buf.getvalue()
        if len(out) <= max_bytes:
            break
    return out


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read(MAX_DOWNLOAD + 1)
    if len(data) > MAX_DOWNLOAD:
        raise ValueError("file is larger than %d MB" % (MAX_DOWNLOAD // (1024 * 1024)))
    return data


def sync_photos(m, cfg, artists, photo_dir, web_prefix, publish, warnings):
    """Make photo_dir hold one photo per artist that has one in Monday, and set artists[id]["photo"].

    Photos whose Monday file is unchanged since the last run (sources.json) are not downloaded again.
    If a download fails, the photo already on disk is kept. Photos of artists no longer in the feed,
    or whose photo was removed in Monday, are deleted. Returns a one-line summary.
    """
    opts = cfg.get("photos", {})
    max_side = int(opts.get("max_side", 800))
    max_bytes = int(opts.get("max_kb", 150)) * 1024
    pil = load_pillow()
    os.makedirs(photo_dir, exist_ok=True)
    man_path = os.path.join(photo_dir, MANIFEST)
    try:
        with open(man_path, encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, ValueError):
        manifest = {}

    def on_disk(entry):
        return bool(entry.get("file")) and os.path.isfile(os.path.join(photo_dir, entry["file"]))

    def usable(aid, cands):
        # Files that turned out not to be readable images are remembered, so they are not fetched every run.
        bad = set((manifest.get(aid) or {}).get("unreadable", []))
        return [c for c in cands if c["asset"] not in bad]

    # Which artists need a download: no photo yet, or the best Monday file is not the one we have.
    todo = {}
    for aid, a in artists.items():
        cands = usable(aid, a["_photos"])
        old = manifest.get(aid) or {}
        if cands and on_disk(old) and old.get("asset") == cands[0]["asset"]:
            continue
        if cands:
            todo[aid] = cands
    urls = {}
    if todo and (pil or not publish):
        try:
            urls = m.asset_urls(sorted({c["asset"] for cands in todo.values() for c in cands}))
        except SystemExit as e:  # never let a photo problem stop the schedule from publishing
            warnings.append("Could not get photo download links from Monday (%s); kept the photos already saved." % e)
    elif todo:
        warnings.append("Pillow is not installed, so %d new or changed photo(s) were not resized and were skipped "
                        "(the photos already saved are kept). Run the GitHub workflow, or: python -m pip install pillow"
                        % len(todo))

    new_manifest, fetched, failed = {}, 0, 0
    new_manifest, fetched, failed = {}, 0, 0
    for aid in sorted(artists):
        a = artists[aid]
        in_monday = {c["asset"] for c in a.pop("_photos")}
        old = manifest.get(aid) or {}
        bad = [x for x in old.get("unreadable", []) if x in in_monday]  # forget files deleted in Monday
        entry = None
        if aid not in todo:
            if on_disk(old) and old.get("asset") in in_monday:
                entry = {k: old[k] for k in ("asset", "column", "file")}
        else:
            for cand in todo[aid]:
                url = urls.get(cand["asset"])
                if not url:
                    continue
                try:
                    data = download(url)
                except Exception as e:
                    warnings.append("Photo for %s (%s) could not be downloaded: %s" % (a["name"], cand["column"], e))
                    continue
                if pil:
                    try:
                        data, name = web_photo(data, pil, max_side, max_bytes), "%s.jpg" % aid
                    except Exception as e:  # not an image after all, or a damaged file: try the next one
                        warnings.append("Photo for %s (%s, %s file) is not a readable image (%s); using the next "
                                        "photo column" % (a["name"], cand["column"], cand["ext"], type(e).__name__))
                        bad.append(cand["asset"])
                        continue
                else:  # preview only: keep the original (stays on this machine)
                    name = "%s.%s" % (aid, cand["ext"])
                with open(os.path.join(photo_dir, name), "wb") as f:
                    f.write(data)
                entry = {"asset": cand["asset"], "column": cand["column"], "file": name}
                fetched += 1
                break
            if entry is None and on_disk(old):
                entry, failed = {k: old[k] for k in ("asset", "column", "file")}, failed + 1  # keep the last photo
        record = dict(entry or {})
        if bad:
            record["unreadable"] = sorted(set(bad))
        if record:
            new_manifest[aid] = record
        if entry:
            a["photo"] = web_prefix + entry["file"]
        else:
            warnings.append("No photo yet: %s" % a["name"])

    keep = {e["file"] for e in new_manifest.values() if e.get("file")}
    removed = 0
    for name in os.listdir(photo_dir):
        if PHOTO_FILE.match(name) and name not in keep:
            os.remove(os.path.join(photo_dir, name))
            removed += 1
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(new_manifest, f, indent=1, sort_keys=True)
        f.write("\n")
    return "Photos: %d artists have one (%d downloaded, %d unchanged%s), %d removed." % (
        len(keep), fetched, len(keep) - fetched - failed,
        ", %d kept from last time after a failed download" % failed if failed else "", removed)


# ---------------------------------------------------------------- build
def build(cfg, edition_key, token):
    ed = cfg["editions"][edition_key]
    sc, ac = cfg["schedule_columns"], cfg["artist_columns"]
    m = Monday(token)

    schedule_cols = [sc["date"], sc["start"], sc["end"], sc["stage"], sc["appears_on_schedule"], sc["sponsor"]] + sc["artist_links"]
    rows = m.board_items(ed["schedule_board"], schedule_cols)

    errors, warnings = [], []
    perfs, artist_ids = [], set()
    earliest = cfg["validation"]["earliest_normal_start"]

    for it in rows:
        c = colmap(it)
        label = it["name"]
        if (c[sc["appears_on_schedule"]].get("label") or "") != cfg["appears_on_schedule_label"]:
            continue
        date = c[sc["date"]].get("date")
        start, end = hhmm(c[sc["start"]]), hhmm(c[sc["end"]])
        stage_label = c[sc["stage"]].get("label") or ""
        stage = cfg["stage_ids"].get(stage_label.strip().lower())
        links = []
        for lid in sc["artist_links"]:
            links.extend(c[lid].get("linked_item_ids") or [])

        if not (date and start and end):
            warnings.append("Skipped (no date/time): %s" % label)
            continue
        if not stage:
            errors.append("Unknown stage %r on %s - add it to stage_ids in feed.config.json" % (stage_label, label))
            continue
        if not links:
            # Unfilled slot. Named non-artist events ("... - Opening Ceremonies") still count.
            if " - " in label:
                act = label.split(" - ", 1)[1].strip()
            else:
                warnings.append("Unfilled slot skipped: %s" % label)
                continue
        else:
            act = None  # filled in from the artist board below
        if end <= start:
            errors.append("Ends before it starts: %s (%s-%s)" % (label, start, end))
        if start < earliest:
            warnings.append("Starts before %s - check AM/PM: %s" % (earliest, label))

        perfs.append({
            "id": "%s-%s-%s" % (date, stage, start.replace(":", "")),
            "act": act, "origin": "", "stage": stage, "date": date, "start": start, "end": end,
            "note": (c[sc["sponsor"]].get("display_value") or "").strip().lstrip("-–— ").strip(),
            "artists": [str(x) for x in links],
            "_label": label,
        })
        artist_ids.update(links)

    # Artists (allowlisted columns only)
    artists = {}
    if artist_ids:
        present = m.board_columns(ed["artist_board"], list(ac.values()))
        for key, cid in ac.items():
            if cid not in present:
                warnings.append("The artist board has no column %r (%s): check artist_columns in feed.config.json" % (cid, key))
        photo_keys = cfg.get("photos", {}).get("columns", [])
        for a in m.items_by_id(sorted(artist_ids), list(ac.values())):
            c = colmap(a)
            def txt(key):
                col = c.get(ac[key]) or {}
                return (col.get("text") or "").strip()
            def url(key):
                # Only http(s) links are published: a pasted "javascript:" or "data:" URL must never reach the page.
                col = c.get(ac[key]) or {}
                u = (col.get("url") or "").strip()
                return u if u.lower().startswith(("http://", "https://")) else ""
            artists[a["id"]] = {
                "name": txt("print_name") or a["name"].strip(),
                "origin": txt("origin"),
                "genre": txt("genre"),
                "bio": txt("bio_en"),
                "links": {k: v for k, v in (("website", url("website")), ("facebook", url("facebook")),
                                            ("instagram", url("instagram")), ("video", url("video"))) if v},
                "photo": "",
                "_photos": photo_candidates(c, ac, photo_keys),
            }
            if not artists[a["id"]]["bio"]:
                warnings.append("No English bio yet: %s" % artists[a["id"]]["name"])

    for p in perfs:
        names = [artists[i]["name"] for i in p["artists"] if i in artists]
        if p["act"] is None:
            p["act"] = " + ".join(names) if names else "TBA"
        origins = []
        for i in p["artists"]:
            o = artists.get(i, {}).get("origin")
            if o and o not in origins:
                origins.append(o)
        p["origin"] = " / ".join(origins)

    # Same stage, same day, overlapping times is almost always a data entry slip.
    perfs.sort(key=lambda p: (p["date"], p["start"], p["stage"]))
    seen = {}
    for p in perfs:
        if p["id"] in seen:
            errors.append("Two sets at the same stage and time: %s and %s" % (seen[p["id"]], p["_label"]))
        seen[p["id"]] = p["_label"]
    for i, a in enumerate(perfs):
        for b in perfs[i + 1:]:
            if a["date"] == b["date"] and a["stage"] == b["stage"] and a["start"] < b["start"] < a["end"]:
                warnings.append("Overlap at %s on %s: %s (%s-%s) and %s (%s)" % (a["stage"], a["date"], a["act"], a["start"], a["end"], b["act"], b["start"]))
    for p in perfs:
        del p["_label"]

    days = []
    for d in sorted({p["date"] for p in perfs}):
        dt = datetime.date.fromisoformat(d)
        days.append({"date": d, "label": dt.strftime("%a %b ") + str(dt.day), "weekday": dt.strftime("%A")})

    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    schedule = {"edition": edition_key, "updated": now,
                "source": {"schedule_board": ed["schedule_board"], "artist_board": ed["artist_board"]},
                "days": days, "performances": perfs}
    artists_out = {"edition": edition_key, "updated": now, "artists": artists}
    return schedule, artists_out, errors, warnings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--edition", help="key under 'editions' in feed.config.json")
    ap.add_argument("--publish", action="store_true", help="write the public files in data/ (gated by public_from)")
    args = ap.parse_args()

    with open(os.path.join(HERE, "feed.config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    edition = args.edition or cfg["default_edition"]
    if edition not in cfg["editions"]:
        raise SystemExit("Unknown edition %r. Known: %s" % (edition, ", ".join(cfg["editions"])))
    token = os.environ.get("MONDAY_TOKEN")
    if not token:
        raise SystemExit("MONDAY_TOKEN is not set. Create a token in Monday (avatar > Developers > My access tokens) "
                         "and set it in this terminal only: $env:MONDAY_TOKEN = '...'")

    schedule, artists, errors, warnings = build(cfg, edition, token)

    for w in warnings:
        print("  WARNING:", w)
    for e in errors:
        print("  ERROR:  ", e)
    if errors:
        print("%d error(s): nothing written. Fix the rows in Monday and run again." % len(errors))
        return 1

    # Publish gate: the edition's public_from date must exist and be in the past.
    publish = args.publish
    status = 0
    if publish:
        pf = cfg["editions"][edition].get("public_from")
        today = datetime.date.today().isoformat()
        if not pf or pf > today:
            print("PUBLISH REFUSED for edition %s: public_from is %s. Writing a preview instead." % (edition, pf or "not set"))
            publish, status = False, 2

    out_dir = os.path.join(HERE, "data") if publish else os.path.join(HERE, "data", "preview")
    os.makedirs(out_dir, exist_ok=True)

    # Photos go next to the public site only when publishing; a preview keeps them in data/preview/
    # (git-ignored), so photos of an unannounced lineup never reach the repository either.
    photo_rel = "assets/artists" if publish else "data/preview/artists"
    photo_warnings = []
    summary = sync_photos(Monday(token), cfg, artists["artists"], os.path.join(HERE, *photo_rel.split("/")),
                          photo_rel + "/", publish, photo_warnings)
    for w in photo_warnings:
        print("  WARNING:", w)
    print(summary)

    for name, obj in (("schedule.json", schedule), ("artists.json", artists)):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
            f.write("\n")
    print("Wrote %s: %d performances over %d days, %d artists (%s)." % (
        os.path.relpath(out_dir, HERE), len(schedule["performances"]), len(schedule["days"]),
        len(artists["artists"]), "PUBLIC" if publish else "preview"))
    return status


if __name__ == "__main__":
    sys.exit(main())
