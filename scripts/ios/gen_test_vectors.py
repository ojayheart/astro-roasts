#!/usr/bin/env python3
"""Reference vectors for the Swift astro engine (ios/AstroKitTests). Run: python3 scripts/ios/gen_test_vectors.py"""
import json, random, swisseph as swe
random.seed(11)
F = swe.FLG_MOSEPH | swe.FLG_SPEED
B = [swe.SUN, swe.MOON, swe.MERCURY, swe.VENUS, swe.MARS, swe.JUPITER, swe.SATURN, swe.URANUS, swe.NEPTUNE, swe.PLUTO, swe.TRUE_NODE]
out = {"positions": [], "angles": [], "phases": []}
for _ in range(60):
    jd = random.uniform(swe.julday(1925, 1, 1, 0), swe.julday(2075, 1, 1, 0))
    out["positions"].append({"jd": jd, "lon": [swe.calc_ut(jd, b, F)[0][0] for b in B]})
places = [(53.80, -1.55), (-36.85, 174.76), (40.71, -74.0), (35.68, 139.69), (-33.92, 18.42), (64.15, -21.94), (51.5, -0.13), (19.43, -99.13)]
for lat, lon in places:
    for _ in range(4):
        jd = random.uniform(swe.julday(1950, 1, 1, 0), swe.julday(2030, 1, 1, 0))
        cusps, asc = swe.houses(jd, lat, lon, b'P')
        out["angles"].append({"jd": jd, "lat": lat, "lon": lon, "asc": asc[0], "mc": asc[1]})
def elong(jd): return (swe.calc_ut(jd, swe.MOON, F)[0][0] - swe.calc_ut(jd, swe.SUN, F)[0][0]) % 360
for target in (0, 90, 180, 270):
    jd = swe.julday(2026, 10, 1, 0)
    prev = ((elong(jd) - target + 180) % 360) - 180
    for _ in range(4 * 90):
        jd2 = jd + 0.25
        v = ((elong(jd2) - target + 180) % 360) - 180
        if prev < 0 <= v and abs(v - prev) < 90:
            a, b = jd, jd2
            for _ in range(40):
                m = (a + b) / 2
                if ((elong(m) - target + 180) % 360 - 180) < 0: a = m
                else: b = m
            out["phases"].append({"target": target, "jd": (a + b) / 2}); break
        prev = v; jd = jd2
json.dump(out, open('ios/AstroKitTests/Resources/vectors.json', 'w'))
print(len(out["positions"]), len(out["angles"]), out["phases"])
