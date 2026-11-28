"""Ask the free OpenStreetMap street router for every walk, and save the answers to routes.js.

Usage:  python build_routes.py        (python3 on Mac/Linux)

The app measures each walk along the route drawn on the festival map (assets/poster-routes.json
"metres", set by tools/poster-routes.html). This script gets the street router's figure for the same
walks, as a check ("Check all routes" in the route editor) and as a fallback for pages without the map:

- When the map has been fitted to real streets (poster-routes.json "geo"), each walk is routed between
  the two entrances its drawn line starts and ends at, stage to stage and stage to shop. Those entrance
  points are stored with each figure ("ends") so the editor can tell when entrances have moved since.
- Otherwise, between the stages' points in locations.json.

Run it after saving routes in the route editor, before publishing. Writes routes.js, which every page
loads. Standard library only; about one request a second (be polite to the free service).
"""
import itertools
import json
import math
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/{a};{b}?overview=false"


def fetch_route(a, b):
    """Walking distance and time between two (lat, lng) points."""
    url = ROUTER.format(a="{:.6f},{:.6f}".format(a[1], a[0]), b="{:.6f},{:.6f}".format(b[1], b[0]))
    req = urllib.request.Request(url, headers={"User-Agent": "festival-route-planner/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RuntimeError("No route: {}".format(data.get("message", data.get("code"))))
    r = data["routes"][0]
    return {"meters": round(r["distance"]), "seconds": round(r["duration"])}


def poster_to_latlng(geo, p):
    """A poster point [x, y] to (lat, lng), using the editor's fit of the map to real streets."""
    m, (lat0, lng0) = geo["m"], geo["origin"]
    east = m[0][0] * p[0] + m[0][1] * p[1] + m[0][2]
    north = m[1][0] * p[0] + m[1][1] * p[1] + m[1][2]
    return (round(lat0 + north / 110574, 6), round(lng0 + east / (math.cos(math.radians(lat0)) * 111320), 6))


def main():
    with open(os.path.join(HERE, "locations.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    locs = cfg["locations"]
    poster = {}
    path = os.path.join(HERE, "assets", "poster-routes.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            poster = json.load(f)
    geo, lines = poster.get("geo"), poster.get("routes") or {}
    if not geo:
        print("The map isn't fitted to real streets yet (open the route editor and Save): routing between stage points.")

    walks = []                                   # (key, from, to, ends known)
    for a, b in itertools.combinations(locs, 2):
        key = "{}|{}".format(a["id"], b["id"])
        line = lines.get(key)
        if geo and line:
            walks.append((key, poster_to_latlng(geo, line[0]), poster_to_latlng(geo, line[-1]), True))
        else:
            walks.append((key, (a["lat"], a["lng"]), (b["lat"], b["lng"]), False))
    if geo:                                      # stage <-> shop walks
        stage_ids = set(l["id"] for l in locs)
        for key, line in lines.items():
            if key.split("|")[1] not in stage_ids:
                walks.append((key, poster_to_latlng(geo, line[0]), poster_to_latlng(geo, line[-1]), True))

    routes = {}
    for key, frm, to, ends in walks:
        print("  {} ...".format(key.replace("|", " -> ")), end=" ", flush=True)
        r = fetch_route(frm, to)
        if ends:
            r["ends"] = [list(frm), list(to)]
        routes[key] = r
        print("{} m, {:.1f} min".format(r["meters"], r["seconds"] / 60))
        time.sleep(1)  # be polite to the free service
    out = {
        "built": time.strftime("%Y-%m-%d %H:%M"),
        "note": "Street-router (OpenStreetMap) walking distances, a check on the distances measured along the routes "
                "drawn on the festival map (assets/poster-routes.json). ends: the entrance points used, [lat, lng].",
        "crowd_factor_default": cfg.get("crowd_factor_default", 1.0),
        "locations": locs,
        "merch_booths": cfg.get("merch_booths", []),
        "routes": routes,
    }
    with open(os.path.join(HERE, "routes.js"), "w", encoding="utf-8") as f:
        f.write("window.ROUTE_DATA = ")
        json.dump(out, f, indent=1)
        f.write(";\n")
    print("Wrote routes.js with {} walks.".format(len(routes)))


if __name__ == "__main__":
    main()
