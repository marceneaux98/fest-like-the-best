"""Download the named streets around the festival from OpenStreetMap into tools/osm-streets.json.

Usage:  python tools/fetch_osm_streets.py

The route editor (tools/poster-routes.html) lines the poster's drawn streets up with these real street
centre lines to measure walks in real feet. Only needed again if the festival footprint moves; for a new
year's map, just place the pins and use "Fit the map to real streets again" in the editor.
Area: the stages in locations.json plus a margin. Street data (c) OpenStreetMap contributors, ODbL.
Standard library only.
"""
import json
import os
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API = "https://api.openstreetmap.org/api/0.6/map?bbox={w:.4f},{s:.4f},{e:.4f},{n:.4f}"
STREETS = {"primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "pedestrian"}
MARGIN = 0.004                                   # degrees, about 400 m


def main():
    with open(os.path.join(ROOT, "locations.json"), encoding="utf-8") as f:
        locs = json.load(f)["locations"]
    lats, lngs = [l["lat"] for l in locs], [l["lng"] for l in locs]
    url = API.format(w=min(lngs) - MARGIN, s=min(lats) - MARGIN, e=max(lngs) + MARGIN, n=max(lats) + MARGIN)
    req = urllib.request.Request(url, headers={"User-Agent": "festival-route-planner/1.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        root = ET.fromstring(resp.read())
    nodes = {n.get("id"): [round(float(n.get("lat")), 6), round(float(n.get("lon")), 6)] for n in root.iter("node")}
    ways = []
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.iter("tag")}
        if tags.get("highway") in STREETS and tags.get("name"):
            pts = [nodes[nd.get("ref")] for nd in w.iter("nd") if nd.get("ref") in nodes]
            if len(pts) > 1:
                ways.append({"name": tags["name"], "pts": pts})
    out = {"note": "Street centre lines from OpenStreetMap (c) OpenStreetMap contributors, ODbL. "
                   "Used by tools/poster-routes.html to fit the poster map to real distances.",
           "ways": ways}
    with open(os.path.join(HERE, "osm-streets.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print("Wrote tools/osm-streets.json: {} streets, {} points.".format(len(ways), sum(len(w["pts"]) for w in ways)))


if __name__ == "__main__":
    main()
