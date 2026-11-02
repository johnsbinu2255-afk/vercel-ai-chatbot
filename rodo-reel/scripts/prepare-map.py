"""Build src/map-data.js from DataMeet GeoJSON files.

Usage:
  python3 scripts/prepare-map.py INDIA_COMPOSITE STATES DISTRICTS > src/map-data.js

Sources (download from github.com/datameet/maps):
  Country/india-composite.geojson              India boundary (Survey of India composite), CC BY 4.0
  website/docs/data/geojson/states.geojson     State boundaries
  website/docs/data/geojson/dists11.geojson    Census 2011 district boundaries, CC BY 2.5 IN

Everything is projected to Web Mercator (radians) and simplified so the
renderer only has to apply a linear camera transform.
"""
import json
import math
import sys

import numpy as np

PLACES = {
    # Approximate town centres (degrees)
    "piravom": (76.4833, 9.8667),
    "mulanthuruthy": (76.3833, 9.9000),
}


def merc(lon, lat):
    return lon * math.pi / 180.0, math.log(math.tan(math.pi / 4 + lat * math.pi / 360.0))


def project(ring):
    a = np.asarray(ring, dtype=np.float64)[:, :2]
    x = np.radians(a[:, 0])
    y = np.log(np.tan(np.pi / 4 + np.radians(a[:, 1]) / 2))
    return np.stack([x, y], axis=1)


def dp(points, tol):
    """Iterative Douglas-Peucker on an (n, 2) array. Keeps first and last point."""
    n = len(points)
    if n < 3:
        return points
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        p, q = points[i], points[j]
        seg = points[i + 1 : j]
        d = q - p
        L = math.hypot(d[0], d[1])
        if L == 0:
            dist = np.hypot(seg[:, 0] - p[0], seg[:, 1] - p[1])
        else:
            dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        k = int(np.argmax(dist))
        if dist[k] > tol:
            m = i + 1 + k
            keep[m] = True
            stack.append((i, m))
            stack.append((m, j))
    return points[keep]


def ring_area(r):
    x, y = r[:, 0], r[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def outer_rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"]]
    raise ValueError(geom["type"])


def simplify_rings(rings, tol, min_area):
    out = []
    for ring in rings:
        pr = project(ring)
        if ring_area(pr) < min_area:
            continue
        # Small islands would collapse at the full tolerance, so scale it to the ring size.
        span = float(np.hypot(*(pr.max(axis=0) - pr.min(axis=0))))
        s = dp(pr, min(tol, span / 8))
        if len(s) >= 4:
            out.append(s)
    return out


def pack(rings):
    # 6 decimals in radians is ~6 m on the ground, plenty for video.
    return [[round(float(v), 6) for xy in r for v in xy] for r in rings]


def bbox(rings):
    allp = np.concatenate(rings)
    return [round(float(v), 6) for v in (allp[:, 0].min(), allp[:, 1].min(), allp[:, 0].max(), allp[:, 1].max())]


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xi > x:
                inside = not inside
    return inside


def main():
    india_path, states_path, dists_path = sys.argv[1:4]
    with open(india_path) as f:
        india = json.load(f)
    with open(states_path) as f:
        states = json.load(f)
    with open(dists_path) as f:
        dists = json.load(f)

    india_rings = []
    for ft in india["features"]:
        india_rings += outer_rings(ft["geometry"])
    # ~0.02 deg tolerance. Keep islands down to ~1 km^2 so Lakshadweep and the
    # Andaman & Nicobar groups show up, as on the official map.
    india_s = simplify_rings(india_rings, 0.00035, 2.5e-8)

    by_state = {ft["properties"]["ST_NM"]: ft for ft in states["features"]}
    kerala = simplify_rings(outer_rings(by_state["Kerala"]["geometry"]), 0.00004, 1e-7)
    neighbours = []
    for name in ("Karnataka", "Tamil Nadu"):
        neighbours += simplify_rings(outer_rings(by_state[name]["geometry"]), 0.00008, 1e-6)

    kdists = {}
    for ft in dists["features"]:
        p = ft["properties"]
        if p.get("ST_NM") == "Kerala":
            kdists[p["DISTRICT"]] = outer_rings(ft["geometry"])
    district_rings = []
    for name, rings in sorted(kdists.items()):
        district_rings += simplify_rings(rings, 0.00003, 1e-7)
    ernakulam_raw = kdists["Ernakulam"]
    ernakulam = simplify_rings(ernakulam_raw, 0.000012, 1e-8)

    places = {}
    for key, (lon, lat) in PLACES.items():
        mx, my = merc(lon, lat)
        inside = any(point_in_ring((mx, my), project(r)) for r in ernakulam_raw)
        if not inside:
            raise SystemExit(f"{key} is not inside Ernakulam district")
        places[key] = [round(mx, 6), round(my, 6)]

    data = {
        "india": pack(india_s),
        "kerala": pack(kerala),
        "neighbours": pack(neighbours),
        "districts": pack(district_rings),
        "ernakulam": pack(ernakulam),
        "bbox": {
            "india": bbox(india_s),
            "kerala": bbox(kerala),
            "ernakulam": bbox(ernakulam),
        },
        "places": places,
    }
    counts = {k: sum(len(r) // 2 for r in v) for k, v in data.items() if isinstance(v, list)}
    sys.stderr.write(f"points per layer: {counts}\n")
    sys.stdout.write("// Generated by scripts/prepare-map.py from DataMeet India maps (CC BY 4.0 / CC BY 2.5 IN).\n")
    sys.stdout.write("// Coordinates are Web Mercator in radians: [x0, y0, x1, y1, ...] per ring.\n")
    sys.stdout.write("window.MAP_DATA = ")
    json.dump(data, sys.stdout, separators=(",", ":"))
    sys.stdout.write(";\n")


if __name__ == "__main__":
    main()
