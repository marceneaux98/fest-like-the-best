"""Build the public schedule feed from Monday.com.

Reads the Programming Schedule board and the Artist board (IDs and column allowlist in
feed.config.json), validates the rows, and writes:

    data/schedule.json   performances by day (what the app loads)
    data/artists.json    name, origin, genre, bio and links per artist

Usage:
    python build_feed.py                      preview build (writes to data/preview/, git-ignored)
    python build_feed.py --publish            writes to data/ (the public files) - refused unless the
                                              edition's public_from date in feed.config.json has passed
    python build_feed.py --edition 2027       pick an edition from feed.config.json (default: default_edition)

Needs the environment variable MONDAY_TOKEN (a Monday.com personal API token). The token is never
written anywhere. Standard library only, Python 3.8+.

Exit codes: 0 ok, 1 validation errors (nothing written), 2 publish refused (preview written instead).
"""
import argparse
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.monday.com/v2"
API_VERSION = "2025-01"


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
            "User-Agent": "fest-like-the-best-feed/1.0",
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
                column_values(ids:$cols) { id type text ... on LinkValue { url } ... on LongTextValue { text } } } }""",
                              {"ids": chunk, "cols": column_ids})
            out.extend(data["items"])
        missing = set(ids) - {it["id"] for it in out}
        if missing:
            print("  WARNING: %d linked artist(s) could not be read (not on the artist board, or no access): %s"
                  % (len(missing), ", ".join(sorted(missing)[:5]) + (" …" if len(missing) > 5 else "")))
        return out


def colmap(item):
    return {c["id"]: c for c in item["column_values"]}


def hhmm(col):
    if not col or col.get("hour") is None:
        return None
    return "%02d:%02d" % (col["hour"], col["minute"] or 0)


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
        for a in m.items_by_id(sorted(artist_ids), list(ac.values())):
            c = colmap(a)
            def txt(key):
                col = c.get(ac[key]) or {}
                return (col.get("text") or "").strip()
            def url(key):
                col = c.get(ac[key]) or {}
                return (col.get("url") or "").strip()
            artists[a["id"]] = {
                "name": txt("print_name") or a["name"].strip(),
                "origin": txt("origin"),
                "genre": txt("genre"),
                "bio": txt("bio_en"),
                "links": {k: v for k, v in (("website", url("website")), ("facebook", url("facebook")),
                                            ("instagram", url("instagram")), ("video", url("video"))) if v},
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
