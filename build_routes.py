"""Fetch walking routes between every pair of locations and save them to routes.js.

Usage:  py build_routes.py
Reads locations.json, calls the free OpenStreetMap walking router (no key needed),
and writes routes.js, which planner.html loads.
"""
import itertools
import json
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/{a};{b}?overview=full&geometries=geojson"


def fetch_route(a, b):
    url = ROUTER.format(a="{},{}".format(a["lng"], a["lat"]), b="{},{}".format(b["lng"], b["lat"]))
    req = urllib.request.Request(url, headers={"User-Agent": "festival-route-planner/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RuntimeError("No route: {}".format(data.get("message", data.get("code"))))
    r = data["routes"][0]
    # GeoJSON is [lng, lat]; store as [lat, lng] for Leaflet.
    path = [[round(lat, 6), round(lng, 6)] for lng, lat in r["geometry"]["coordinates"]]
    return {"meters": round(r["distance"]), "seconds": round(r["duration"]), "path": path}


def main():
    with open(os.path.join(HERE, "locations.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    locs = cfg["locations"]
    routes = {}
    for a, b in itertools.combinations(locs, 2):
        key = "{}|{}".format(a["id"], b["id"])
        print("  {} -> {} ...".format(a["name"], b["name"]), end=" ", flush=True)
        routes[key] = fetch_route(a, b)
        print("{} m, {:.1f} min".format(routes[key]["meters"], routes[key]["seconds"] / 60))
        time.sleep(1)  # be polite to the free service
    out = {
        "built": time.strftime("%Y-%m-%d %H:%M"),
        "crowd_factor_default": cfg.get("crowd_factor_default", 1.0),
        "locations": locs,
        "merch_booths": cfg.get("merch_booths", []),
        "routes": routes,
    }
    with open(os.path.join(HERE, "routes.js"), "w", encoding="utf-8") as f:
        f.write("window.ROUTE_DATA = ")
        json.dump(out, f, indent=1)
        f.write(";\n")
    print("Wrote routes.js with {} routes.".format(len(routes)))


if __name__ == "__main__":
    main()
