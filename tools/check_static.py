#!/usr/bin/env python3
"""Static checks for Fest like the Best. Standard library only; run from anywhere:

    python tools/check_static.py

What it checks (each line of output says OK or FAIL):
  1. Every *.py file compiles (catches syntax errors before the sync workflow trips on them).
  2. The data/config files parse as JSON, the schedule is internally consistent (every set has a
     known stage, a date from the days list, and ends after it starts), the 2027 edition stays
     embargoed (public_from null) and nothing under data/preview/ is committed.
  3. Every data-i18n* key used in the pages exists in the English dictionary in i18n.js
     (English is the fallback, so a key missing there shows up to patrons as the raw key).
     Keys that other languages have but English lacks are reported as warnings.

Exit code 1 if any check fails, so GitHub Actions marks the run red.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_FILES = ["data/schedule.json", "data/artists.json", "locations.json", "feed.config.json"]
PAGES = ["lineup.html", "itinerary.html", "planner.html", "common.js"]  # common.js injects the brand bar
EMBARGOED_EDITIONS = ["2027"]  # must keep public_from = null until the lineup is announced
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".lighthouseci"}

failures = []
warnings = []


def ok(msg):
    print("OK    " + msg)


def fail(msg):
    failures.append(msg)
    print("FAIL  " + msg)


def warn(msg):
    warnings.append(msg)
    print("WARN  " + msg)


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def to_min(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# ---------- 1. Python compiles ----------
def check_python():
    count = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith(".py"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, "/")
            count += 1
            try:
                compile(read(rel), rel, "exec")
            except SyntaxError as e:
                fail("%s does not compile: line %s: %s" % (rel, e.lineno, e.msg))
    ok("%d Python files compile" % count)


# ---------- 2. JSON + data consistency ----------
def check_json():
    docs = {}
    for rel in JSON_FILES:
        try:
            docs[rel] = json.loads(read(rel))
            ok("%s is valid JSON" % rel)
        except FileNotFoundError:
            fail("%s is missing" % rel)
        except ValueError as e:
            fail("%s is not valid JSON: %s" % (rel, e))

    sched = docs.get("data/schedule.json")
    locs = docs.get("locations.json")
    cfg = docs.get("feed.config.json")

    if isinstance(sched, dict) and isinstance(locs, dict):
        stage_ids = set(l.get("id") for l in locs.get("locations", []))
        days = set(d.get("date") for d in sched.get("days", []))
        perfs = sched.get("performances", [])
        problems = []
        for p in perfs:
            pid = p.get("id", "?")
            if p.get("stage") not in stage_ids:
                problems.append("%s: unknown stage %r" % (pid, p.get("stage")))
            if p.get("date") not in days:
                problems.append("%s: date %r is not in the days list" % (pid, p.get("date")))
            try:
                if to_min(p.get("end")) <= to_min(p.get("start")):
                    problems.append("%s: ends (%s) before it starts (%s)" % (pid, p.get("end"), p.get("start")))
            except (AttributeError, ValueError):
                problems.append("%s: bad start/end time %r-%r" % (pid, p.get("start"), p.get("end")))
        if not perfs:
            problems.append("schedule has no performances")
        if not days:
            problems.append("schedule has no days")
        if problems:
            for msg in problems[:20]:
                fail("schedule: " + msg)
            if len(problems) > 20:
                fail("schedule: ... and %d more" % (len(problems) - 20))
        else:
            ok("schedule: %d sets over %d days, all on known stages with sane times" % (len(perfs), len(days)))

    if isinstance(cfg, dict):
        for ed in EMBARGOED_EDITIONS:
            pf = cfg.get("editions", {}).get(ed, {}).get("public_from")
            if pf is None:
                ok("feed.config.json: edition %s is still embargoed (public_from is null)" % ed)
            else:
                fail("feed.config.json: edition %s has public_from=%r. The lineup is confidential until it is "
                     "announced; once it is, remove %s from EMBARGOED_EDITIONS in tools/check_static.py" % (ed, pf, ed))

    try:
        out = subprocess.run(["git", "ls-files", "data/preview"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        tracked = out.split()
        if tracked:
            fail("data/preview/ is committed (%d files). Preview builds must never be in git." % len(tracked))
        else:
            ok("data/preview/ is not committed")
    except (OSError, subprocess.CalledProcessError):
        warn("git not available, skipped the data/preview/ check")


# ---------- 3. i18n keys ----------
def dict_keys(src, lang):
    """Keys of the `D.<lang> = { ... };` block in i18n.js, or None if the block is not found."""
    m = re.search(r"^\s*D\.%s\s*=\s*\{(.*?)^\s*\};" % re.escape(lang), src, re.S | re.M)
    if not m:
        return None
    body = m.group(1)
    body = re.sub(r"'(?:[^'\\]|\\.)*'", "''", body)  # blank out string values so text can't look like keys
    body = re.sub(r'"(?:[^"\\]|\\.)*"', '""', body)
    body = re.sub(r"//[^\n]*", "", body)
    return set(re.findall(r"(?:^|[{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", body, re.M))


def check_i18n():
    src = read("i18n.js")
    en = dict_keys(src, "en")
    if not en:
        fail("i18n.js: could not find the English dictionary (D.en = { ... };)")
        return
    used = {}
    for rel in PAGES:
        for key in re.findall(r"data-i18n(?:-html|-ph|-aria|-title)?=\"([A-Za-z0-9_]+)\"", read(rel)):
            used.setdefault(key, set()).add(rel)
    missing = sorted(k for k in used if k not in en)
    for k in missing:
        fail("i18n: key %r used in %s is not in the English dictionary" % (k, ", ".join(sorted(used[k]))))
    if not missing:
        ok("i18n: all %d data-i18n keys used in %s exist in English (%d keys)" % (len(used), ", ".join(PAGES), len(en)))
    for lang in re.findall(r"^\s*D\.([a-z]{2})\s*=", src, re.M):
        if lang == "en":
            continue
        keys = dict_keys(src, lang) or set()
        extra = sorted(keys - en)
        if extra:
            warn("i18n: %s has keys that English lacks (probably typos): %s" % (lang, ", ".join(extra)))
        gaps = len(en - keys)
        if gaps:
            print("      i18n: %s is missing %d English keys (they fall back to English)" % (lang, gaps))


def main():
    check_python()
    check_json()
    check_i18n()
    lines = ["## Static checks", ""]
    if failures:
        lines += ["**%d problem(s):**" % len(failures), ""] + ["- " + f for f in failures]
    else:
        lines.append("All static checks passed.")
    if warnings:
        lines += ["", "Warnings:", ""] + ["- " + w for w in warnings]
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    print()
    print("%d failure(s), %d warning(s)" % (len(failures), len(warnings)))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
