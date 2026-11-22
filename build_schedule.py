"""Fallback importer: convert a schedule spreadsheet into data/schedule.json.

The normal path is build_feed.py, which reads Monday.com directly. Keep this only for a
spreadsheet handed over without Monday access.

Usage:  python build_schedule.py [path\\to\\schedule.xlsx]        (python3 on Mac/Linux)
Default input is assets\\schedule.xlsx. Uses only the Python standard library.

The sheet is expected to have blocks of rows with these headers:
  Name | Schedule Name | Date | Start Time | End Time | Act Name | Origin Country | StageName | Set Length
Rows without a date or start time (e.g. "Time TBA" placeholders) are skipped.
"""
import datetime
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

# StageName in the sheet -> location id in locations.json
STAGE_IDS = {
    "fais do do": "faisdodo",
    "internationale": "internationale",
    "lafayette": "lafayette",
    "scène des jeunes": "jeunes",
    "biergarten": "biergarten",
    "pavillon de cuisine": "pavillon",
    "scène francosphère": "francosphere",
}


def col_index(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    first = wb.find("m:sheets", NS)[0]
    target = rels[first.get("{%s}id" % NS["r"])].lstrip("/")
    if not target.startswith("xl/"):
        target = "xl/" + target
    for row in ET.fromstring(z.read(target)).find("m:sheetData", NS):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            t = c.get("t")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
            else:
                val = v.text if v is not None else ""
            cells[col_index(c.get("r"))] = (val or "").strip()
        yield cells


def parse_date(v):
    try:
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(v)))).isoformat()
    except ValueError:
        return None


def parse_time(v):
    """'08:45 PM' or an Excel day fraction -> 'HH:MM' (24h)."""
    if not v:
        return None
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$", v)
    if m:
        h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        h = h % 12 + (12 if ap == "PM" else 0)
        return "%02d:%02d" % (h, mi)
    try:
        mins = round(float(v) * 24 * 60)
        return "%02d:%02d" % (mins // 60 % 24, mins % 60)
    except ValueError:
        return None


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "assets", "schedule.xlsx")
    header = None
    perfs, warnings = [], []
    for cells in read_rows(src):
        vals = [cells.get(i, "") for i in range(max(cells) + 1)] if cells else []
        if "Schedule Name" in vals and "Start Time" in vals:
            header = {name: i for i, name in enumerate(vals)}
            continue
        if not header:
            continue
        g = lambda k: cells.get(header.get(k, -1), "")
        date, start, end = parse_date(g("Date")), parse_time(g("Start Time")), parse_time(g("End Time"))
        if not (date and start and end):
            continue
        stage_name = g("StageName")
        stage = STAGE_IDS.get(stage_name.lower())
        if not stage:
            warnings.append("Unknown stage %r for %r - add it to STAGE_IDS" % (stage_name, g("Name")))
            continue
        act = g("Act Name")
        sched = g("Schedule Name")
        note = ""
        if " - " in sched:
            note = sched.split(" - ", 1)[1].strip()
        if not act:
            # e.g. "Thursday, April 23, ..., Scène Internationale - Opening Ceremonies"
            name = g("Name")
            act = name.split(" - ", 1)[1].strip() if " - " in name else "TBA"
        origin = g("Origin Country")
        perfs.append({
            "id": "%s-%s-%s" % (date, stage, start.replace(":", "")),
            "act": act,
            "origin": "" if origin in ("null", "") else origin,
            "stage": stage,
            "date": date,
            "start": start,
            "end": end,
            "note": note,
        })
        if start < "11:00":
            warnings.append("Early start - check AM/PM: %s %s %s at %s" % (act, date, start, stage_name))
        if end <= start:
            warnings.append("Ends before it starts: %s %s %s-%s" % (act, date, start, end))

    perfs.sort(key=lambda p: (p["date"], p["start"], p["stage"]))
    # Same-stage overlaps are almost always typos in the sheet.
    for a in perfs:
        for b in perfs:
            if a is not b and a["stage"] == b["stage"] and a["date"] == b["date"] and a["start"] < b["start"] < a["end"]:
                warnings.append("Overlap on %s %s: %s (%s-%s) and %s (%s)" % (a["stage"], a["date"], a["act"], a["start"], a["end"], b["act"], b["start"]))

    days = []
    for d in sorted({p["date"] for p in perfs}):
        dt = datetime.date.fromisoformat(d)
        days.append({"date": d, "label": dt.strftime("%a %b ") + str(dt.day), "weekday": dt.strftime("%A")})

    out = {"edition": "spreadsheet", "updated": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
           "source": {"file": os.path.basename(src)}, "days": days, "performances": perfs}
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    with open(os.path.join(HERE, "data", "schedule.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("Wrote data/schedule.json: %d performances over %d days." % (len(perfs), len(days)))
    for w in warnings:
        print("  WARNING:", w)


if __name__ == "__main__":
    main()
