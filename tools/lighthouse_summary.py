#!/usr/bin/env python3
"""Turn Lighthouse CI reports into a readable score table, and fail on low accessibility.

    python tools/lighthouse_summary.py lighthouse-reports --min-accessibility 90

Reads manifest.json that `lhci upload --target=filesystem` writes next to the HTML/JSON reports,
prints a Markdown table (also appended to the GitHub job summary when run in Actions) with the
performance, accessibility, best-practices and PWA scores per page, and exits 1 if any page's
accessibility score is below the threshold. The other scores are informational for now.
Standard library only.
"""
import argparse
import json
import os
import sys

CATEGORIES = [("performance", "Performance"), ("accessibility", "Accessibility"),
              ("best-practices", "Best practices"), ("pwa", "PWA")]


def pct(value):
    return "n/a" if value is None else str(int(round(value * 100)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report_dir")
    ap.add_argument("--min-accessibility", type=int, default=90)
    args = ap.parse_args()

    manifest_path = os.path.join(args.report_dir, "manifest.json")
    try:
        with open(manifest_path, encoding="utf-8") as f:
            runs = json.load(f)
    except (OSError, ValueError) as e:
        print("Could not read %s: %s" % (manifest_path, e))
        sys.exit(1)

    rows, failures = [], []
    for run in runs:
        if not run.get("isRepresentativeRun", True):
            continue
        url = run.get("url", "?")
        page = url.rsplit("/", 1)[-1] or url
        scores = run.get("summary", {})
        if not scores and run.get("jsonPath"):
            try:
                with open(run["jsonPath"], encoding="utf-8") as f:
                    cats = json.load(f).get("categories", {})
                scores = {k: v.get("score") for k, v in cats.items()}
            except (OSError, ValueError):
                pass
        rows.append((page, scores))
        acc = scores.get("accessibility")
        if acc is None or acc * 100 < args.min_accessibility:
            failures.append("%s: accessibility %s (minimum %d)" % (page, pct(acc), args.min_accessibility))

    lines = ["## Lighthouse (mobile)", "",
             "| Page | " + " | ".join(label for _, label in CATEGORIES) + " |",
             "|---|" + "---:|" * len(CATEGORIES)]
    for page, scores in rows:
        lines.append("| %s | %s |" % (page, " | ".join(pct(scores.get(key)) for key, _ in CATEGORIES)))
    lines += ["", "Scores are out of 100. Only **accessibility below %d fails** the check; the others are "
              "informational. Full HTML reports are in the run's *lighthouse-reports* artifact." % args.min_accessibility]
    if failures:
        lines += ["", "**Failed:**", ""] + ["- " + f for f in failures]
    if not rows:
        failures.append("no Lighthouse runs found in %s" % args.report_dir)
        lines += ["", "No runs found."]

    text = "\n".join(lines) + "\n"
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
