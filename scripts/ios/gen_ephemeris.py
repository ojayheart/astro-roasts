#!/usr/bin/env python3
"""Generate the on-device ephemeris table (ios/Shared/Resources/ephemeris.bin)
and map data (land.json) with Swiss Ephemeris (Moshier). Run: python3 scripts/ios/gen_ephemeris.py <land-110m.json>

Binary layout (little endian):
  magic 'AREP' (4) | startJD0 Int32 (JD at 00:00 UT of first day, as integer) | days UInt32 | bodies UInt32
  then for each body b in order: days x Int32 ecliptic longitude in [0,360) (1e-4 deg); unwrap neighbours when interpolating
  then for each body b: days x Int16 ecliptic latitude (1e-3 deg)
Bodies: Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto TrueNode
"""
import sys, struct, json, math
import swisseph as swe

BODIES = [swe.SUN, swe.MOON, swe.MERCURY, swe.VENUS, swe.MARS, swe.JUPITER, swe.SATURN, swe.URANUS, swe.NEPTUNE, swe.PLUTO, swe.TRUE_NODE]
START = (1900, 1, 1); END = (2100, 12, 31)
FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

jd0 = int(swe.julday(*START, 0.0) + 0.5)  # integer JD at 00:00 UT (JD ends in .5)
jd_start = swe.julday(*START, 0.0)
days = int(swe.julday(*END, 0.0) - jd_start) + 1
lons = [[] for _ in BODIES]; lats = [[] for _ in BODIES]
for d in range(days):
    jd = jd_start + d
    for i, b in enumerate(BODIES):
        xx, _ = swe.calc_ut(jd, b, FLAGS)
        lon, lat = xx[0], xx[1]
        lons[i].append(round((lon % 360.0) * 1e4) % 3600000); lats[i].append(round(lat * 1e3))

out = bytearray(b'AREP')
out += struct.pack('<iII', int(jd_start + 0.5), days, len(BODIES))
for i in range(len(BODIES)): out += struct.pack('<%di' % days, *lons[i])
for i in range(len(BODIES)): out += struct.pack('<%dh' % days, *lats[i])
open('ios/Shared/Resources/ephemeris.bin', 'wb').write(out)
print('ephemeris.bin', len(out), 'bytes', days, 'days')

# --- interpolation error check: 4-point Lagrange from daily samples vs Swiss at random times
import random
random.seed(7)
worst = {}
for _ in range(4000):
    t = random.uniform(5, days - 5); k = int(t); f = t - k
    jd = jd_start + t
    for i, b in enumerate(BODIES):
        v = [lons[i][k + j] / 1e4 for j in (-1, 0, 1, 2)]
        base = v[1]
        v = [base + ((a - base + 180) % 360 - 180) for a in v]
        x = f
        w = [-x*(x-1)*(x-2)/6, (x+1)*(x-1)*(x-2)/2, -(x+1)*x*(x-2)/2, (x+1)*x*(x-1)/6]
        est = sum(a * c for a, c in zip(v, w))
        ref, _ = swe.calc_ut(jd, b, FLAGS); r = ref[0]
        diff = abs(((est - r) + 180) % 360 - 180)
        worst[i] = max(worst.get(i, 0), diff)
print('max interpolation error (deg):', {swe.get_planet_name(BODIES[i]): round(v, 5) for i, v in worst.items()})

if len(sys.argv) > 1:
    t = json.load(open(sys.argv[1])); sc, tr = t['transform']['scale'], t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    def arc(i): return arcs[i] if i >= 0 else arcs[~i][::-1]
    polys = []
    for g in t['objects']['land']['geometries']:
        for poly in (g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]):
            ring = poly[0]; pts = []
            for i in ring: pts += arc(i)
            last = None; s = []
            for lon, lat in pts:
                p = (round(lon, 1), round(lat, 1))
                if last and abs(p[0]-last[0]) + abs(p[1]-last[1]) < 0.6: continue
                s.append(p); last = p
            if len(s) >= 4: polys.append(s)
    json.dump(polys, open('ios/Shared/Resources/land.json', 'w'), separators=(',', ':'))
    print('land.json polygons', len(polys), 'points', sum(len(p) for p in polys))
