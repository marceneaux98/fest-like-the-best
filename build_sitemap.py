"""Turn the raw pdf.js SVG of the site map into a small, layered assets/sitemap.svg.

Input:  assets/sitemap-raw.svg  (made by tools/pdf2svg.html from assets/sitemap-vector.pdf)
Output: assets/sitemap.svg      (what the app's map overlay loads)

What it does
  1. Bakes group transforms into path coordinates and rounds them (6.8 MB -> about 1.5 MB).
  2. Drops the page-sized clip and invisible paths; keeps the clips that shape gradient fills.
  3. Sorts every shape into a layer by colour, size and position, so the app can hide
     streets, stage zones, icons, labels, the legend or the logo independently:
       background . zones . streets . features . labels . logo . legend
  4. Writes one <g class="layer" id="layer-..."> per layer, in that draw order.

Usage:  python build_sitemap.py            (python3 on Mac/Linux). Standard library only.
The rules in LAYER_RULES are tuned for the 2026 map. For a new map, re-run tools/pdf2svg.html,
run this, open tools/svgview.html and adjust the rules until each layer looks right.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets", "sitemap-raw.svg")
OUT = os.path.join(HERE, "assets", "sitemap.svg")
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)

PAGE_W, PAGE_H = 774.0, 603.0
PREC = 1                      # decimals kept in coordinates (0.1 pt is well under a pixel on any phone)
EPS = 0.15                    # curves that deviate less than this from a straight line become lines

# ----------------------------------------------------------------- layer rules (2026 map)
# Boxes are fractions of the page: (x0, y0, x1, y1).
LEGEND_BOX = (0.575, 0.00, 1.00, 0.395)
LEGEND_COL1_MAX_Y = 0.235      # the first legend column has five rows; below that, shapes are map icons
LOGO_BOX = (0.03, 0.30, 0.19, 0.58)
# Legend entries, by column (x centre) and row (y centre), as fractions of the page. Each map icon is
# matched to one of these by comparing its glyph shapes, and tagged data-kind="…".
LEGEND_COLS = [0.588, 0.704, 0.843]
LEGEND_ROWS = [0.060, 0.099, 0.138, 0.177, 0.215, 0.254, 0.292, 0.330, 0.369]
LEGEND_KINDS = [
    ["food", "cocktails", "beer", "nonalcoholic", "thc"],
    ["medical", "restrooms", "accessible", "nursing", "lostfound", "boutique", "pinbooth", "wifi", "cash"],
    ["special", "selfie", "volunteers", "raintent", "shuttle", "frenchhelp", "media", "bikes", "opportunity"],
]
BADGE_SIZE = (13.0, 32.0)      # width/height range (pt) of an icon's disc or oval
# Map icons whose drawing differs from the legend's sample (a different number of shapes), decided by
# badge fill + glyph fills instead: (badge fill, glyph fill, min glyphs, max glyphs, wide oval?) -> kind
ICON_OVERRIDES = [
    ("#ffffff", "#162061", 3, 3, False, "pinbooth"),     # "PIN": three letters; the legend sample has two shapes
    ("#ffffff", "#162061", 2, 6, True, "restrooms"),     # wide white oval with the two figures
]
BACKGROUND_FILLS = {"#162061", "#1b2863", "#1a2262", "#1a2563", "#1b2463", "#142c6e", "#133280", "#1c2764"}
STREET_FILLS = {"#4fcfe6", "#4ecfe6", "#46c3ec", "#50d0e7",      # main streets: one compound path
                "#1c68b8", "#1c67b7", "#1d69b9"}                  # thinner side streets
ZONE_FILLS = set()                                               # zones are gradient blocks (handled as 'shaded')
LABEL_FILLS = {"#ffffff", "#f1e3db", "#e5d5d4", "#ceebf3"}
BADGE_MIN = 9.0                # a white shape at least this wide AND tall is an icon disc/tent, not a letter
ZONE_MIN_AREA = 0.012          # fraction of page area; other coloured shapes this big are zones
BACKGROUND_MIN_AREA = 0.25


def parse_transform(t):
    """'translate(a b)' / 'matrix(a b c d e f)' -> 2x3 matrix (a, b, c, d, e, f)."""
    if not t:
        return (1, 0, 0, 1, 0, 0)
    m = re.match(r"\s*(translate|matrix)\(([^)]*)\)", t)
    nums = [float(x) for x in re.split(r"[\s,]+", m.group(2).strip()) if x]
    if m.group(1) == "translate":
        return (1, 0, 0, 1, nums[0], nums[1] if len(nums) > 1 else 0)
    return tuple(nums)


def mul(p, c):
    """Compose: apply c then p (p * c)."""
    a, b, c_, d, e, f = p
    a2, b2, c2, d2, e2, f2 = c
    return (a * a2 + c_ * b2, b * a2 + d * b2, a * c2 + c_ * d2, b * c2 + d * d2,
            a * e2 + c_ * f2 + e, b * e2 + d * f2 + f)


def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


NUM = r"-?\d*\.?\d+(?:e-?\d+)?"
TOKEN = re.compile(r"([MLCZHVmlczhv])|(" + NUM + ")")


def num(v):
    s = ("%%.%df" % PREC) % v
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return s if s not in ("", "-0") else "0"


def dist_to_line(p, a, b):
    """Distance from p to the segment a-b."""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def bake_path(d, m):
    """Absolute M/L/C/Z path (what pdf.js emits) -> transformed, rounded, lightly simplified path + bbox.

    Simplification: a curve whose control points sit within EPS of its chord becomes a line, and a
    line/curve that ends within EPS of where it started is dropped. Rounding happens after that.
    """
    out, pts = [], []
    cmd, buf = None, []
    cur = None          # current point (transformed)

    def emit_pt(x, y):
        return num(x) + " " + num(y)

    def flush():
        nonlocal buf, cur
        if not buf:
            return
        if cmd == "M":
            x, y = apply(m, buf[0], buf[1]); pts.append((x, y)); cur = (x, y)
            out.append("M" + emit_pt(x, y))
        elif cmd == "L":
            x, y = apply(m, buf[0], buf[1]); pts.append((x, y))
            if cur is None or abs(x - cur[0]) > EPS or abs(y - cur[1]) > EPS:
                out.append("L" + emit_pt(x, y)); cur = (x, y)
        elif cmd == "C":
            p = [apply(m, buf[i], buf[i + 1]) for i in range(0, 6, 2)]
            pts.extend(p)
            end = p[2]
            if cur is not None and dist_to_line(p[0], cur, end) < EPS and dist_to_line(p[1], cur, end) < EPS:
                if abs(end[0] - cur[0]) > EPS or abs(end[1] - cur[1]) > EPS:
                    out.append("L" + emit_pt(*end)); cur = end
            else:
                out.append("C" + " ".join(emit_pt(*q) for q in p)); cur = end
        buf = []

    for tok in TOKEN.finditer(d):
        if tok.group(1):
            flush()
            cmd = tok.group(1).upper()
            if cmd == "Z":
                if out and out[-1] != "Z":
                    out.append("Z")
                cmd = None
        else:
            buf.append(float(tok.group(2)))
            need = {"M": 2, "L": 2, "C": 6}.get(cmd, 0)
            if need and len(buf) == need:
                flush()
                if cmd == "M":
                    cmd = "L"   # implicit lineto after moveto
    flush()
    if not pts:
        return "", None
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return "".join(out), (min(xs), min(ys), max(xs), max(ys))


def tag(el):
    return el.tag.split("}")[-1]


def bbox_union(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def area_frac(bb):
    return (bb[2] - bb[0]) * (bb[3] - bb[1]) / (PAGE_W * PAGE_H)


def inside(bb, box):
    cx, cy = (bb[0] + bb[2]) / 2 / PAGE_W, (bb[1] + bb[3]) / 2 / PAGE_H
    return box[0] <= cx <= box[1 + 1] and box[1] <= cy <= box[3]


# ----------------------------------------------------------------- flatten
def main():
    if not os.path.exists(SRC):
        sys.exit("Missing %s. Make it with tools/pdf2svg.html (serve with python serve.py)." % SRC)
    root = ET.parse(SRC).getroot()
    defs = root.find("{%s}defs" % NS)
    clips = {c.get("id"): c for c in defs if tag(c) == "clipPath"}
    gradients = [c for c in defs if tag(c) in ("linearGradient", "radialGradient")]

    # Clip paths whose box is the whole page just reproduce the artboard: drop references to them.
    page_clips = set()
    clip_bbox = {}
    for cid, c in clips.items():
        m = parse_transform(c.get("transform"))
        bb = None
        for p in c:
            if tag(p) == "path":
                _, b = bake_path(p.get("d", ""), m)
                bb = bbox_union(bb, b)
        clip_bbox[cid] = bb
        if bb and area_frac(bb) > 0.95:
            page_clips.add(cid)

    items = []      # (kind, element-or-data, bbox, fill)

    def walk(el, m, clip):
        for ch in el:
            t = tag(ch)
            if t == "defs":
                continue
            m2 = mul(m, parse_transform(ch.get("transform")))
            cp = ch.get("clip-path")
            clip2 = clip
            if cp:
                cid = re.search(r"#([\w-]+)", cp).group(1)
                if cid not in page_clips:
                    clip2 = cid
            if t == "g":
                has_rect = any(tag(x) == "rect" for x in ch.iter())
                if has_rect and clip2:
                    # A gradient fill: a rect clipped to the real shape. Keep it as one unit, with its matrix.
                    bb = clip_bbox.get(clip2)
                    items.append(("shaded", (ch, m2, clip2), bb, "gradient"))
                else:
                    walk(ch, m2, clip2)
            elif t == "path":
                fill = (ch.get("fill") or "none").lower()
                if fill == "none" and not ch.get("stroke"):
                    continue
                d, bb = bake_path(ch.get("d", ""), m2)
                if not d or bb is None:
                    continue
                if clip2 and clip_bbox.get(clip2):
                    bb = (max(bb[0], clip_bbox[clip2][0]), max(bb[1], clip_bbox[clip2][1]),
                          min(bb[2], clip_bbox[clip2][2]), min(bb[3], clip_bbox[clip2][3]))
                items.append(("path", (d, dict(ch.attrib), clip2), bb, fill))
            elif t == "rect":
                # bare shading rect without clip: treat as background wash
                items.append(("shaded", (ch, m2, None), (0, 0, PAGE_W, PAGE_H), "gradient"))

    walk(root, (1, 0, 0, 1, 0, 0), None)

    # ------------------------------------------------------------- classify
    # First pass: find icon "badges" (small coloured discs) so white glyphs inside them count as icons.
    badges = []
    for kind, data, bb, fill in items:
        if kind != "path" or bb is None:
            continue
        af = area_frac(bb)
        if fill not in LABEL_FILLS and fill not in BACKGROUND_FILLS and fill not in STREET_FILLS and 0.00005 < af < 0.0025:
            badges.append(bb)

    def in_badge(bb):
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        for b in badges:
            if b[0] - 1 <= cx <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1:
                return True
        return False

    layers = {k: [] for k in ("background", "zones", "streets", "features", "labels", "logo", "legend")}
    for kind, data, bb, fill in items:
        rec = (kind, data, bb, fill)
        if bb is None:
            layers["features"].append(rec); continue
        af = area_frac(bb)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        cx, cy = (bb[0] + bb[2]) / 2 / PAGE_W, (bb[1] + bb[3]) / 2 / PAGE_H
        in_legend = inside(bb, LEGEND_BOX) and af < 0.2 and not (cx < 0.70 and cy > LEGEND_COL1_MAX_Y)
        if fill in STREET_FILLS and af > 0.0015:
            layers["streets"].append(rec)
        elif in_legend:
            layers["legend"].append(rec)
        elif inside(bb, LOGO_BOX) and af < 0.05:
            layers["logo"].append(rec)
        elif kind == "shaded":
            layers["background" if af > BACKGROUND_MIN_AREA else "zones" if af > 0.004 else "features"].append(rec)
        elif fill in ZONE_FILLS or (fill not in LABEL_FILLS and af > ZONE_MIN_AREA):
            layers["zones"].append(rec)
        elif fill in BACKGROUND_FILLS and af > 0.02:
            layers["background"].append(rec)
        elif fill in LABEL_FILLS:
            is_badge = (w >= BADGE_MIN and h >= BADGE_MIN) or in_badge(bb)
            layers["features" if is_badge else "labels"].append(rec)
        else:
            layers["features"].append(rec)

    # ------------------------------------------------------------- icons -> kinds
    # An icon is a disc/oval ("badge") plus the glyph shapes drawn inside it. The legend shows one icon
    # per entry, so each map icon is matched to the legend icon whose glyphs look the same.
    def is_badge_shape(rec):
        kind, data, bb, fill = rec
        if kind != "path" or bb is None:
            return False
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        return BADGE_SIZE[0] <= w <= BADGE_SIZE[1] and BADGE_SIZE[0] <= h <= BADGE_SIZE[1] and 0.65 <= w / h <= 1.55

    def find_icons(recs):
        """Group a layer's shapes into icons: list of (badge index, [member indexes]) in draw order."""
        badges = [i for i, r in enumerate(recs) if is_badge_shape(r)]
        taken, icons = set(), []
        for bi in badges:
            if bi in taken:
                continue
            bb = recs[bi][2]
            members = [bi]
            for j, r in enumerate(recs):
                if j == bi or j in taken or r[2] is None or r[0] != "path":
                    continue
                b = r[2]
                cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
                if bb[0] - 0.5 <= cx <= bb[2] + 0.5 and bb[1] - 0.5 <= cy <= bb[3] + 0.5 and (b[2] - b[0]) <= (bb[2] - bb[0]) * 1.05:
                    members.append(j)
            taken.update(members)
            icons.append((bi, members))
        return icons

    def signature(recs, badge_i, members):
        """Shape-only description of an icon: badge fill plus each glyph's fill, relative size and point count."""
        bb = recs[badge_i][2]
        bw = max(bb[2] - bb[0], 0.1)
        glyphs = []
        for j in members:
            if j == badge_i:
                continue
            kind, data, b, fill = recs[j]
            d = data[0]
            glyphs.append((fill, round((b[2] - b[0]) / bw, 1), round((b[3] - b[1]) / bw, 1), min(len(re.findall(r"[MLC]", d)) // 3, 40)))
        return (recs[badge_i][3], tuple(sorted(glyphs)))

    def sig_distance(a, b):
        if a[0] != b[0]:
            return 99
        ga, gb = list(a[1]), list(b[1])
        if len(ga) != len(gb):
            return 10 + abs(len(ga) - len(gb))
        score = 0
        for x, y in zip(ga, gb):
            if x[0] != y[0]:
                score += 5
            score += abs(x[1] - y[1]) * 4 + abs(x[2] - y[2]) * 4 + abs(x[3] - y[3]) * 0.3
        return score

    legend_recs = layers["legend"]
    legend_sigs = []
    for bi, members in find_icons(legend_recs):
        bb = legend_recs[bi][2]
        cx, cy = (bb[0] + bb[2]) / 2 / PAGE_W, (bb[1] + bb[3]) / 2 / PAGE_H
        col = min(range(3), key=lambda c: abs(LEGEND_COLS[c] - cx))
        row = min(range(len(LEGEND_ROWS)), key=lambda r: abs(LEGEND_ROWS[r] - cy))
        if abs(LEGEND_COLS[col] - cx) > 0.02 or abs(LEGEND_ROWS[row] - cy) > 0.015 or row >= len(LEGEND_KINDS[col]):
            continue
        legend_sigs.append((LEGEND_KINDS[col][row], signature(legend_recs, bi, members)))
        if os.environ.get("SITEMAP_DEBUG"):
            print("    legend %-12s badge %s %.0fx%.0f glyphs=%s" % (LEGEND_KINDS[col][row], legend_sigs[-1][1][0],
                  bb[2] - bb[0], bb[3] - bb[1], legend_sigs[-1][1][1]))

    feature_recs = layers["features"]
    icon_of = {}            # member index -> (icon id, kind)
    icon_counts = {}
    unmatched = 0
    for n, (bi, members) in enumerate(find_icons(feature_recs)):
        sig = signature(feature_recs, bi, members)
        best = min(legend_sigs, key=lambda ls: sig_distance(sig, ls[1])) if legend_sigs else None
        kind = best[0] if best and sig_distance(sig, best[1]) < 3 else "other"
        if kind == "other":
            bb = feature_recs[bi][2]
            wide = (bb[2] - bb[0]) / max(bb[3] - bb[1], 0.1) > 1.15
            glyph_fills = [g[0] for g in sig[1]]
            for badge_fill, glyph_fill, lo, hi, needs_wide, okind in ICON_OVERRIDES:
                if sig[0] == badge_fill and lo <= len(glyph_fills) <= hi and all(f == glyph_fill for f in glyph_fills) and (wide or not needs_wide):
                    kind = okind
                    break
        if kind != "other" and os.environ.get("SITEMAP_DEBUG") == "2":
            bb = feature_recs[bi][2]
            print("    icon (%.3f, %.3f) -> %-12s d=%.1f badge %s %.0fx%.0f" % ((bb[0] + bb[2]) / 2 / PAGE_W, (bb[1] + bb[3]) / 2 / PAGE_H,
                  kind, sig_distance(sig, best[1]), sig[0], bb[2] - bb[0], bb[3] - bb[1]))
        if kind == "other":
            unmatched += 1
            if os.environ.get("SITEMAP_DEBUG"):
                bb = feature_recs[bi][2]
                print("    unmatched icon at (%.3f, %.3f) badge %s %.0fx%.0f glyphs=%s nearest=%s d=%.1f" % (
                    (bb[0] + bb[2]) / 2 / PAGE_W, (bb[1] + bb[3]) / 2 / PAGE_H, sig[0], bb[2] - bb[0], bb[3] - bb[1],
                    sig[1], best[0] if best else None, sig_distance(sig, best[1]) if best else -1))
        icon_counts[kind] = icon_counts.get(kind, 0) + 1
        for j in members:
            icon_of[j] = (n, kind)
    print("  legend icons recognised: %d of %d; map icons by kind: %s; unmatched: %d" % (
        len(legend_sigs), sum(len(c) for c in LEGEND_KINDS),
        ", ".join("%s %d" % kv for kv in sorted(icon_counts.items())), unmatched))

    # ------------------------------------------------------------- write
    svg = ET.Element("{%s}svg" % NS, {"viewBox": "0 0 %d %d" % (PAGE_W, PAGE_H), "width": "%d" % PAGE_W, "height": "%d" % PAGE_H})
    odefs = ET.SubElement(svg, "{%s}defs" % NS)
    used_clips = set()
    for name, lst in layers.items():
        for kind, data, _bb, _fill in lst:
            c = data[2]
            if c:
                used_clips.add(c)
    for g in gradients:
        odefs.append(g)
    for cid in sorted(used_clips):
        c = clips[cid]
        m = parse_transform(c.get("transform"))
        nc = ET.SubElement(odefs, "{%s}clipPath" % NS, {"id": cid})
        for p in c:
            if tag(p) == "path":
                d, _ = bake_path(p.get("d", ""), m)
                ET.SubElement(nc, "{%s}path" % NS, {"d": d})

    fmt = "%%.%df" % PREC

    def emit(parent, kind, data):
        if kind == "path":
            d, attrs, clip = data
            a = {"d": d, "fill": attrs.get("fill", "#000")}
            for k in ("fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "opacity"):
                if attrs.get(k) and not (k == "fill-opacity" and attrs[k] == "1"):
                    a[k] = attrs[k]
            if clip:
                a["clip-path"] = "url(#%s)" % clip
            ET.SubElement(parent, "{%s}path" % NS, a)
        else:
            el, m, clip = data
            a = {"transform": "matrix(%s)" % " ".join(fmt % v for v in m)}
            if clip:
                a["clip-path"] = "url(#%s)" % clip
            wrap = ET.SubElement(parent, "{%s}g" % NS, a)
            for x in el.iter():
                if tag(x) == "rect":
                    wrap.append(x)

    for name, lst in layers.items():
        g = ET.SubElement(svg, "{%s}g" % NS, {"id": "layer-" + name, "class": "layer"})
        groups = {}
        for i, (kind, data, _bb, _fill) in enumerate(lst):
            if name == "features" and i in icon_of:
                icon_id, icon_kind = icon_of[i]
                if icon_id not in groups:
                    groups[icon_id] = ET.SubElement(g, "{%s}g" % NS, {"class": "icon", "data-kind": icon_kind})
                emit(groups[icon_id], kind, data)
            else:
                emit(g, kind, data)

    data = ET.tostring(svg, encoding="unicode")
    data = re.sub(r'\s(clip-rule|version)="[^"]*"', "", data)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n' + data)
    print("Wrote assets/sitemap.svg: %d KB" % (len(data.encode("utf-8")) // 1024))
    for name, lst in layers.items():
        print("  %-11s %5d shapes" % (name, len(lst)))
    print("  clips kept: %d of %d, gradients: %d" % (len(used_clips), len(clips), len(gradients)))


if __name__ == "__main__":
    main()
