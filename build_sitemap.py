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
LEGEND_BOX = (0.68, 0.00, 1.00, 0.39)
LOGO_BOX = (0.03, 0.30, 0.19, 0.58)
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
        if bb is None:
            layers["features"].append((kind, data)); continue
        af = area_frac(bb)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        if fill in STREET_FILLS and af > 0.0015:
            layers["streets"].append((kind, data))
        elif inside(bb, LEGEND_BOX) and af < 0.2:
            layers["legend"].append((kind, data))
        elif inside(bb, LOGO_BOX) and af < 0.05:
            layers["logo"].append((kind, data))
        elif kind == "shaded":
            layers["background" if af > BACKGROUND_MIN_AREA else "zones" if af > 0.004 else "features"].append((kind, data))
        elif fill in ZONE_FILLS or (fill not in LABEL_FILLS and af > ZONE_MIN_AREA):
            layers["zones"].append((kind, data))
        elif fill in BACKGROUND_FILLS and af > 0.02:
            layers["background"].append((kind, data))
        elif fill in LABEL_FILLS:
            is_badge = (w >= BADGE_MIN and h >= BADGE_MIN) or in_badge(bb)
            layers["features" if is_badge else "labels"].append((kind, data))
        else:
            layers["features"].append((kind, data))

    # ------------------------------------------------------------- write
    svg = ET.Element("{%s}svg" % NS, {"viewBox": "0 0 %d %d" % (PAGE_W, PAGE_H), "width": "%d" % PAGE_W, "height": "%d" % PAGE_H})
    odefs = ET.SubElement(svg, "{%s}defs" % NS)
    used_clips = set()
    for name, lst in layers.items():
        for kind, data in lst:
            c = data[2] if kind == "path" else data[2]
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
    for name, lst in layers.items():
        g = ET.SubElement(svg, "{%s}g" % NS, {"id": "layer-" + name, "class": "layer"})
        for kind, data in lst:
            if kind == "path":
                d, attrs, clip = data
                a = {"d": d, "fill": attrs.get("fill", "#000")}
                for k in ("fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "opacity"):
                    if attrs.get(k) and not (k == "fill-opacity" and attrs[k] == "1"):
                        a[k] = attrs[k]
                if clip:
                    a["clip-path"] = "url(#%s)" % clip
                ET.SubElement(g, "{%s}path" % NS, a)
            else:
                el, m, clip = data
                a = {"transform": "matrix(%s)" % " ".join(fmt % v for v in m)}
                if clip:
                    a["clip-path"] = "url(#%s)" % clip
                wrap = ET.SubElement(g, "{%s}g" % NS, a)
                for x in el.iter():
                    if tag(x) == "rect":
                        wrap.append(x)

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
