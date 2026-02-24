#!/usr/bin/env python3
"""
Natal Chart Calculator — Swiss Ephemeris (offline)

Computes comprehensive natal chart data formatted for astrological interpretation.
Output is ready to paste into Claude for a full natal reading.

Usage:
  python3 natal_chart.py --name "Oliver" --year 1994 --month 1 --day 21 \
    --hour 13 --minute 0 --city wellington

  python3 natal_chart.py --name "Sarah" --year 1992 --month 3 --day 15 \
    --hour 14 --minute 30 --lat -36.85 --lon 174.76 --tz Pacific/Auckland

  python3 natal_chart.py --list-cities

Cities with built-in coordinates: wellington, auckland, sydney, london, etc.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import datetime
from itertools import combinations
from zoneinfo import ZoneInfo

import swisseph as swe

# ─── Constants ────────────────────────────────────────────────────────────────

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

ELEMENTS = {
    "Fire": {"Aries", "Leo", "Sagittarius"},
    "Earth": {"Taurus", "Virgo", "Capricorn"},
    "Air": {"Gemini", "Libra", "Aquarius"},
    "Water": {"Cancer", "Scorpio", "Pisces"},
}

MODALITIES = {
    "Cardinal": {"Aries", "Cancer", "Libra", "Capricorn"},
    "Fixed": {"Taurus", "Leo", "Scorpio", "Aquarius"},
    "Mutable": {"Gemini", "Virgo", "Sagittarius", "Pisces"},
}

SIGN_RULERS = {
    "Aries": ("Mars", "Mars"),
    "Taurus": ("Venus", "Venus"),
    "Gemini": ("Mercury", "Mercury"),
    "Cancer": ("Moon", "Moon"),
    "Leo": ("Sun", "Sun"),
    "Virgo": ("Mercury", "Mercury"),
    "Libra": ("Venus", "Venus"),
    "Scorpio": ("Pluto", "Mars"),
    "Sagittarius": ("Jupiter", "Jupiter"),
    "Capricorn": ("Saturn", "Saturn"),
    "Aquarius": ("Uranus", "Saturn"),
    "Pisces": ("Neptune", "Jupiter"),
}

PLANET_IDS = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
    "Chiron": swe.CHIRON,
    "N.Node": swe.MEAN_NODE,
    "Lilith": swe.MEAN_APOG,
}

# Points used for aspect calculation
ASPECT_BODIES = [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto", "Chiron", "Ascendant", "MC",
]

ASPECT_DEFS = {
    "conjunction": (0, 8),
    "sextile": (60, 6),
    "square": (90, 7),
    "trine": (120, 7),
    "quincunx": (150, 3),
    "opposition": (180, 8),
}

LUMINARIES = {"Sun", "Moon"}
LUMINARY_BONUS = 2

MOON_PHASES = [
    (0, 45, "New Moon"),
    (45, 90, "Waxing Crescent"),
    (90, 135, "First Quarter"),
    (135, 180, "Waxing Gibbous"),
    (180, 225, "Full Moon"),
    (225, 270, "Waning Gibbous"),
    (270, 315, "Last Quarter"),
    (315, 360, "Waning Crescent"),
]

CITIES = {
    # New Zealand
    "wellington": (-41.2866, 174.7762, "Pacific/Auckland"),
    "auckland": (-36.8485, 174.7633, "Pacific/Auckland"),
    "christchurch": (-43.5321, 172.6362, "Pacific/Auckland"),
    "dunedin": (-45.8788, 170.5028, "Pacific/Auckland"),
    "hamilton": (-37.7870, 175.2793, "Pacific/Auckland"),
    "tauranga": (-37.6878, 176.1651, "Pacific/Auckland"),
    "napier": (-39.4928, 176.9120, "Pacific/Auckland"),
    "nelson": (-41.2706, 173.2840, "Pacific/Auckland"),
    "queenstown": (-45.0312, 168.6626, "Pacific/Auckland"),
    "palmerston north": (-40.3523, 175.6082, "Pacific/Auckland"),
    "rotorua": (-38.1368, 176.2497, "Pacific/Auckland"),
    "whangarei": (-35.7275, 174.3166, "Pacific/Auckland"),
    "new plymouth": (-39.0556, 174.0752, "Pacific/Auckland"),
    "invercargill": (-46.4132, 168.3538, "Pacific/Auckland"),
    "whanganui": (-39.9301, 175.0479, "Pacific/Auckland"),
    "gisborne": (-38.6623, 178.0176, "Pacific/Auckland"),
    # Australia
    "sydney": (-33.8688, 151.2093, "Australia/Sydney"),
    "melbourne": (-37.8136, 144.9631, "Australia/Melbourne"),
    "brisbane": (-27.4698, 153.0251, "Australia/Brisbane"),
    "perth": (-31.9505, 115.8605, "Australia/Perth"),
    "adelaide": (-34.9285, 138.6007, "Australia/Adelaide"),
    "gold coast": (-28.0167, 153.4000, "Australia/Brisbane"),
    "canberra": (-35.2809, 149.1300, "Australia/Sydney"),
    "hobart": (-42.8821, 147.3272, "Australia/Hobart"),
    "darwin": (-12.4634, 130.8456, "Australia/Darwin"),
    # UK & Ireland
    "london": (51.5074, -0.1278, "Europe/London"),
    "edinburgh": (55.9533, -3.1883, "Europe/London"),
    "manchester": (53.4808, -2.2426, "Europe/London"),
    "dublin": (53.3498, -6.2603, "Europe/Dublin"),
    "glasgow": (55.8642, -4.2518, "Europe/London"),
    "birmingham": (52.4862, -1.8904, "Europe/London"),
    # Europe
    "paris": (48.8566, 2.3522, "Europe/Paris"),
    "berlin": (52.5200, 13.4050, "Europe/Berlin"),
    "amsterdam": (52.3676, 4.9041, "Europe/Amsterdam"),
    "rome": (41.9028, 12.4964, "Europe/Rome"),
    "madrid": (40.4168, -3.7038, "Europe/Madrid"),
    "lisbon": (38.7223, -9.1393, "Europe/Lisbon"),
    "barcelona": (41.3874, 2.1686, "Europe/Madrid"),
    "vienna": (48.2082, 16.3738, "Europe/Vienna"),
    "prague": (50.0755, 14.4378, "Europe/Prague"),
    "copenhagen": (55.6761, 12.5683, "Europe/Copenhagen"),
    "stockholm": (59.3293, 18.0686, "Europe/Stockholm"),
    "oslo": (59.9139, 10.7522, "Europe/Oslo"),
    "helsinki": (60.1699, 24.9384, "Europe/Helsinki"),
    "zurich": (47.3769, 8.5417, "Europe/Zurich"),
    "athens": (37.9838, 23.7275, "Europe/Athens"),
    "istanbul": (41.0082, 28.9784, "Europe/Istanbul"),
    # North America
    "new york": (40.7128, -74.0060, "America/New_York"),
    "los angeles": (34.0522, -118.2437, "America/Los_Angeles"),
    "chicago": (41.8781, -87.6298, "America/Chicago"),
    "houston": (29.7604, -95.3698, "America/Chicago"),
    "san francisco": (37.7749, -122.4194, "America/Los_Angeles"),
    "seattle": (47.6062, -122.3321, "America/Los_Angeles"),
    "miami": (25.7617, -80.1918, "America/New_York"),
    "denver": (39.7392, -104.9903, "America/Denver"),
    "austin": (30.2672, -97.7431, "America/Chicago"),
    "boston": (42.3601, -71.0589, "America/New_York"),
    "toronto": (43.6532, -79.3832, "America/Toronto"),
    "vancouver": (49.2827, -123.1207, "America/Vancouver"),
    "montreal": (45.5017, -73.5673, "America/Toronto"),
    "mexico city": (19.4326, -99.1332, "America/Mexico_City"),
    # South America
    "sao paulo": (-23.5505, -46.6333, "America/Sao_Paulo"),
    "buenos aires": (-34.6037, -58.3816, "America/Argentina/Buenos_Aires"),
    "bogota": (4.7110, -74.0721, "America/Bogota"),
    "lima": (-12.0464, -77.0428, "America/Lima"),
    "santiago": (-33.4489, -70.6693, "America/Santiago"),
    # Asia
    "tokyo": (35.6762, 139.6503, "Asia/Tokyo"),
    "beijing": (39.9042, 116.4074, "Asia/Shanghai"),
    "shanghai": (31.2304, 121.4737, "Asia/Shanghai"),
    "hong kong": (22.3193, 114.1694, "Asia/Hong_Kong"),
    "singapore": (1.3521, 103.8198, "Asia/Singapore"),
    "mumbai": (19.0760, 72.8777, "Asia/Kolkata"),
    "delhi": (28.7041, 77.1025, "Asia/Kolkata"),
    "bangkok": (13.7563, 100.5018, "Asia/Bangkok"),
    "seoul": (37.5665, 126.9780, "Asia/Seoul"),
    "dubai": (25.2048, 55.2708, "Asia/Dubai"),
    "taipei": (25.0330, 121.5654, "Asia/Taipei"),
    "kuala lumpur": (3.1390, 101.6869, "Asia/Kuala_Lumpur"),
    "jakarta": (-6.2088, 106.8456, "Asia/Jakarta"),
    "manila": (14.5995, 120.9842, "Asia/Manila"),
    # Africa
    "cape town": (-33.9249, 18.4241, "Africa/Johannesburg"),
    "johannesburg": (-26.2041, 28.0473, "Africa/Johannesburg"),
    "nairobi": (-1.2921, 36.8219, "Africa/Nairobi"),
    "cairo": (30.0444, 31.2357, "Africa/Cairo"),
    "lagos": (6.5244, 3.3792, "Africa/Lagos"),
    # Pacific
    "honolulu": (21.3069, -157.8583, "Pacific/Honolulu"),
    "suva": (-18.1416, 178.4419, "Pacific/Fiji"),
    "noumea": (-22.2558, 166.4505, "Pacific/Noumea"),
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def norm360(x: float) -> float:
    x = x % 360.0
    return x + 360.0 if x < 0 else x


def ang_diff(a: float, b: float) -> float:
    d = (norm360(a) - norm360(b)) % 360.0
    return d - 360.0 if d > 180.0 else d


def abs_ang_diff(a: float, b: float) -> float:
    return abs(ang_diff(a, b))


def deg_to_sign(d: float) -> str:
    d = norm360(d)
    si = int(d / 30)
    deg_in = d - si * 30
    mm = int((deg_in - int(deg_in)) * 60)
    return f"{int(deg_in):02d}\u00b0{mm:02d}' {SIGNS[si]}"


def sign_of(d: float) -> str:
    return SIGNS[int(norm360(d) / 30)]


def element_of(sign: str) -> str:
    for elem, signs in ELEMENTS.items():
        if sign in signs:
            return elem
    return "?"


def modality_of(sign: str) -> str:
    for mod, signs in MODALITIES.items():
        if sign in signs:
            return mod
    return "?"


def moon_phase_name(sun_lon: float, moon_lon: float) -> str:
    angle = norm360(moon_lon - sun_lon)
    for lo, hi, name in MOON_PHASES:
        if lo <= angle < hi:
            return name
    return "New Moon"


def orb_strength(orb: float) -> str:
    if orb < 1.0:
        return "\u25cf\u25cf\u25cf\u25cf\u25cf"
    elif orb < 2.0:
        return "\u25cf\u25cf\u25cf\u25cf\u25cb"
    elif orb < 4.0:
        return "\u25cf\u25cf\u25cf\u25cb\u25cb"
    elif orb < 6.0:
        return "\u25cf\u25cf\u25cb\u25cb\u25cb"
    else:
        return "\u25cf\u25cb\u25cb\u25cb\u25cb"


def julday_ut(dt_utc: datetime) -> float:
    hh = dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hh, swe.GREG_CAL)


def ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    return f"{n}{['th','st','nd','rd','th','th','th','th','th','th'][n%10]}"


# ─── Chart Computation ────────────────────────────────────────────────────────

def compute_chart(
    year: int, month: int, day: int, hour: int, minute: int,
    lat: float, lon: float, tz_str: str, hsys: str = "P",
    time_known: bool = True,
) -> dict:
    swe.set_ephe_path(os.getenv("SWEPHE_PATH", ""))

    tz = ZoneInfo(tz_str)
    dt_local = datetime(year, month, day, hour, minute, tzinfo=tz)
    dt_utc = dt_local.astimezone(ZoneInfo("UTC"))
    jd = julday_ut(dt_utc)

    # Houses/angles
    cusps, ascmc = swe.houses(jd, lat, lon, hsys.encode("ascii"))
    asc = norm360(float(ascmc[0]))
    mc = norm360(float(ascmc[1]))

    # Obliquity for house_pos
    eclnut, _ = swe.calc_ut(jd, swe.ECL_NUT, swe.FLG_MOSEPH)
    eps = float(eclnut[0])
    armc = float(ascmc[2])

    def house_for(lon_deg: float) -> int | None:
        if not time_known:
            return None
        try:
            hp = swe.house_pos(armc, lat, eps, (norm360(lon_deg), 0.0), hsys.encode("ascii"))
            return int(hp)
        except Exception:
            return None

    # Planet positions
    points: dict = {}
    for name, pid in PLANET_IDS.items():
        try:
            xx, _ = swe.calc_ut(jd, pid, swe.FLG_SPEED)
            plon = norm360(xx[0])
            points[name] = {
                "lon": plon,
                "sign": sign_of(plon),
                "deg_str": deg_to_sign(plon),
                "house": house_for(plon),
                "speed": xx[3],
                "retrograde": xx[3] < 0,
            }
        except Exception as e:
            points[name] = {"lon": None, "error": str(e)}

    # Angles as points
    if time_known:
        points["Ascendant"] = {
            "lon": asc, "sign": sign_of(asc), "deg_str": deg_to_sign(asc),
            "house": 1, "speed": 0, "retrograde": False,
        }
        points["MC"] = {
            "lon": mc, "sign": sign_of(mc), "deg_str": deg_to_sign(mc),
            "house": 10, "speed": 0, "retrograde": False,
        }

    # South Node
    if "N.Node" in points and points["N.Node"].get("lon") is not None:
        sn_lon = norm360(points["N.Node"]["lon"] + 180)
        points["S.Node"] = {
            "lon": sn_lon, "sign": sign_of(sn_lon), "deg_str": deg_to_sign(sn_lon),
            "house": house_for(sn_lon), "speed": 0, "retrograde": False,
        }

    # Part of Fortune
    if time_known and points["Sun"].get("lon") and points["Moon"].get("lon"):
        sun_h = points["Sun"]["house"]
        is_day = sun_h is not None and sun_h >= 7
        if is_day:
            pof = norm360(asc + points["Moon"]["lon"] - points["Sun"]["lon"])
        else:
            pof = norm360(asc + points["Sun"]["lon"] - points["Moon"]["lon"])
        points["Part of Fortune"] = {
            "lon": pof, "sign": sign_of(pof), "deg_str": deg_to_sign(pof),
            "house": house_for(pof), "speed": 0, "retrograde": False,
        }
        is_day_chart = is_day
    else:
        is_day_chart = None

    # Day of week, moon phase
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_of_week = days[dt_local.weekday()]
    phase = moon_phase_name(points["Sun"]["lon"], points["Moon"]["lon"])

    # Chart ruler
    asc_sign = sign_of(asc) if time_known else None
    if asc_sign:
        modern_ruler, trad_ruler = SIGN_RULERS[asc_sign]
    else:
        modern_ruler = trad_ruler = None

    return {
        "dt_local": dt_local,
        "dt_utc": dt_utc,
        "jd": jd,
        "lat": lat,
        "lon": lon,
        "tz_str": tz_str,
        "time_known": time_known,
        "points": points,
        "house_cusps": [norm360(float(c)) for c in cusps[:12]],
        "asc": asc,
        "mc": mc,
        "day_of_week": day_of_week,
        "moon_phase": phase,
        "is_day_chart": is_day_chart,
        "chart_ruler_modern": modern_ruler,
        "chart_ruler_trad": trad_ruler,
        "asc_sign": asc_sign,
    }


# ─── Aspects ──────────────────────────────────────────────────────────────────

def compute_aspects(points: dict) -> list[dict]:
    available = [p for p in ASPECT_BODIES if p in points and points[p].get("lon") is not None]
    aspects = []

    for i, p1 in enumerate(available):
        for p2 in available[i + 1:]:
            lon1 = points[p1]["lon"]
            lon2 = points[p2]["lon"]

            for asp_name, (asp_angle, base_orb) in ASPECT_DEFS.items():
                orb = base_orb
                if p1 in LUMINARIES or p2 in LUMINARIES:
                    orb += LUMINARY_BONUS

                diff = abs_ang_diff(lon1, lon2)
                actual_orb = abs(diff - asp_angle)

                if actual_orb <= orb:
                    aspects.append({
                        "p1": p1, "p2": p2,
                        "aspect": asp_name,
                        "orb": round(actual_orb, 2),
                    })

    aspects.sort(key=lambda a: a["orb"])
    return aspects


# ─── Configurations ───────────────────────────────────────────────────────────

def detect_configurations(aspects: list[dict], points: dict) -> list[dict]:
    # Build lookup
    asp_pairs: dict[str, set[tuple]] = {}
    for a in aspects:
        asp_pairs.setdefault(a["aspect"], set()).add((a["p1"], a["p2"]))
        asp_pairs.setdefault(a["aspect"], set()).add((a["p2"], a["p1"]))

    def has(p1, p2, asp):
        return (p1, p2) in asp_pairs.get(asp, set())

    available = [p for p in ASPECT_BODIES if p in points and points[p].get("lon") is not None]
    configs = []
    seen = set()

    # T-Squares
    for a in aspects:
        if a["aspect"] == "opposition":
            for p3 in available:
                if p3 not in (a["p1"], a["p2"]):
                    if has(a["p1"], p3, "square") and has(a["p2"], p3, "square"):
                        key = ("T-Square", tuple(sorted([a["p1"], a["p2"], p3])))
                        if key not in seen:
                            seen.add(key)
                            configs.append({
                                "type": "T-Square",
                                "planets": key[1],
                                "detail": f"{a['p1']}-{a['p2']} opposition, {p3} at apex (square both)",
                            })

    # Grand Trines
    for combo in combinations(available, 3):
        if has(combo[0], combo[1], "trine") and has(combo[1], combo[2], "trine") and has(combo[0], combo[2], "trine"):
            key = ("Grand Trine", tuple(sorted(combo)))
            if key not in seen:
                seen.add(key)
                configs.append({
                    "type": "Grand Trine",
                    "planets": key[1],
                    "detail": f"{combo[0]}, {combo[1]}, {combo[2]} in mutual trine",
                })

    # Grand Crosses
    for combo in combinations(available, 4):
        for a, b, c, d in [(combo[0], combo[1], combo[2], combo[3]),
                           (combo[0], combo[2], combo[1], combo[3]),
                           (combo[0], combo[3], combo[1], combo[2])]:
            if (has(a, b, "opposition") and has(c, d, "opposition") and
                has(a, c, "square") and has(a, d, "square") and
                has(b, c, "square") and has(b, d, "square")):
                key = ("Grand Cross", tuple(sorted(combo)))
                if key not in seen:
                    seen.add(key)
                    configs.append({
                        "type": "Grand Cross",
                        "planets": key[1],
                        "detail": f"{a}-{b} and {c}-{d} oppositions with four squares",
                    })
                break

    # Yods
    for a in aspects:
        if a["aspect"] == "sextile":
            for p3 in available:
                if p3 not in (a["p1"], a["p2"]):
                    if has(a["p1"], p3, "quincunx") and has(a["p2"], p3, "quincunx"):
                        key = ("Yod", tuple(sorted([a["p1"], a["p2"], p3])))
                        if key not in seen:
                            seen.add(key)
                            configs.append({
                                "type": "Yod (Finger of God)",
                                "planets": key[1],
                                "detail": f"{a['p1']}-{a['p2']} sextile, both quincunx {p3} (apex)",
                            })

    return configs


# ─── Analysis ─────────────────────────────────────────────────────────────────

def analyze_chart(chart: dict) -> dict:
    points = chart["points"]
    count_points = ["Sun", "Moon", "Mercury", "Venus", "Mars",
                    "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]

    elements = {"Fire": [], "Earth": [], "Air": [], "Water": []}
    modalities = {"Cardinal": [], "Fixed": [], "Mutable": []}

    for p in count_points:
        if p in points and points[p].get("sign"):
            sign = points[p]["sign"]
            e = element_of(sign)
            m = modality_of(sign)
            if e in elements:
                elements[e].append(p)
            if m in modalities:
                modalities[m].append(p)

    # Stelliums by sign
    sign_groups: dict[str, list] = {}
    for p in count_points:
        if p in points and points[p].get("sign"):
            sign_groups.setdefault(points[p]["sign"], []).append(p)
    stelliums_sign = {s: ps for s, ps in sign_groups.items() if len(ps) >= 3}

    # Stelliums by house
    house_groups: dict[int, list] = {}
    for p in count_points:
        if p in points and points[p].get("house"):
            house_groups.setdefault(points[p]["house"], []).append(p)
    stelliums_house = {h: ps for h, ps in house_groups.items() if len(ps) >= 3}

    return {
        "elements": elements,
        "modalities": modalities,
        "stelliums_sign": stelliums_sign,
        "stelliums_house": stelliums_house,
    }


# ─── Output ───────────────────────────────────────────────────────────────────

def format_output(name: str, chart: dict, analysis: dict,
                  aspects: list[dict], configs: list[dict]) -> str:
    lines: list[str] = []
    w = lines.append
    sep = "\u2500" * 72

    w(f"\u2550" * 72)
    w(f"  NATAL CHART: {name.upper()}")
    w(f"\u2550" * 72)
    w("")

    # ── Birth Data ──
    dt = chart["dt_local"]
    w("BIRTH DATA")
    w(sep)
    w(f"  Date:        {chart['day_of_week']}, {dt.day} {dt.strftime('%B %Y')}")
    if chart["time_known"]:
        w(f"  Time:        {dt.strftime('%I:%M %p')} {dt.tzname()} (UTC{dt.strftime('%z')})")
    else:
        w(f"  Time:        UNKNOWN (using noon — houses/angles approximate)")
    lat = chart["lat"]
    lon = chart["lon"]
    lat_str = f"{abs(lat):.4f}\u00b0{'S' if lat < 0 else 'N'}"
    lon_str = f"{abs(lon):.4f}\u00b0{'W' if lon < 0 else 'E'}"
    w(f"  Location:    {lat_str}, {lon_str} ({chart['tz_str']})")
    w(f"  Moon Phase:  {chart['moon_phase']}")
    if chart["is_day_chart"] is not None:
        w(f"  Sect:        {'Day' if chart['is_day_chart'] else 'Night'} Chart")
    if chart["asc_sign"]:
        mr = chart["chart_ruler_modern"]
        tr = chart["chart_ruler_trad"]
        ruler_str = mr if mr == tr else f"{mr} (modern) / {tr} (traditional)"
        w(f"  Chart Ruler: {ruler_str} ({chart['asc_sign']} Ascendant)")
    w("")

    # ── Planet Positions ──
    w("PLANET POSITIONS")
    w(sep)

    display_order = [
        "Sun", "Moon", "Mercury", "Venus", "Mars",
        "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
        "Chiron", "N.Node", "S.Node", "Lilith",
    ]
    angle_order = ["Ascendant", "MC", "Part of Fortune"]

    for pname in display_order:
        if pname not in chart["points"]:
            continue
        p = chart["points"][pname]
        if p.get("lon") is None:
            continue
        rx = " Rx" if p.get("retrograde") else "   "
        house_str = f"{ordinal(p['house']):>5s}" if p.get("house") else "  ?  "
        w(f"  {pname:<16s} {p['deg_str']:<22s} {house_str}{rx}")

    if chart["time_known"]:
        w(f"  {'':─<16s} {'':─<22s} {'':─<5s}")
        for pname in angle_order:
            if pname not in chart["points"]:
                continue
            p = chart["points"][pname]
            if p.get("lon") is None:
                continue
            house_str = f"{ordinal(p['house']):>5s}" if p.get("house") else "     "
            w(f"  {pname:<16s} {p['deg_str']:<22s} {house_str}")
    w("")

    # ── Chart Overview ──
    w("CHART OVERVIEW")
    w(sep)

    # Elements
    w("  Elements:")
    for elem in ["Fire", "Earth", "Air", "Water"]:
        ps = analysis["elements"][elem]
        n = len(ps)
        bar = "\u2588" * n + "\u2591" * (10 - n)
        names = ", ".join(ps) if ps else "—"
        w(f"    {elem:<10s} {n:>2d}  {bar}  {names}")

    w("")
    w("  Modalities:")
    for mod in ["Cardinal", "Fixed", "Mutable"]:
        ps = analysis["modalities"][mod]
        n = len(ps)
        bar = "\u2588" * n + "\u2591" * (10 - n)
        names = ", ".join(ps) if ps else "—"
        w(f"    {mod:<10s} {n:>2d}  {bar}  {names}")

    # Stelliums
    if analysis["stelliums_sign"]:
        w("")
        w("  Stelliums by sign:")
        for sign, ps in analysis["stelliums_sign"].items():
            w(f"    {sign}: {', '.join(ps)} ({len(ps)} planets)")

    if analysis["stelliums_house"]:
        w("")
        w("  Stelliums by house:")
        for house, ps in analysis["stelliums_house"].items():
            w(f"    {ordinal(house)} House: {', '.join(ps)} ({len(ps)} planets)")

    w("")

    # ── Aspects ──
    w("ASPECTS (sorted by tightness)")
    w(sep)
    for a in aspects:
        if a["aspect"] == "quincunx":
            continue  # show separately
        strength = orb_strength(a["orb"])
        orb_str = f"{a['orb']:.2f}\u00b0"
        w(f"  {a['p1']:<12s} {a['aspect']:<14s} {a['p2']:<12s} {orb_str:>7s}  {strength}")

    quincunxes = [a for a in aspects if a["aspect"] == "quincunx"]
    if quincunxes:
        w("")
        w("  Quincunxes (minor):")
        for a in quincunxes:
            strength = orb_strength(a["orb"])
            w(f"    {a['p1']:<12s} quincunx     {a['p2']:<12s} {a['orb']:.2f}\u00b0  {strength}")

    w("")

    # ── Configurations ──
    if configs:
        w("NOTABLE CONFIGURATIONS")
        w(sep)
        for c in configs:
            w(f"  {c['type']}: {c['detail']}")
        w("")

    # ── House Cusps ──
    if chart["time_known"]:
        w("HOUSE CUSPS")
        w(sep)
        for i, cusp_lon in enumerate(chart["house_cusps"]):
            w(f"  House {i+1:>2d}:  {deg_to_sign(cusp_lon)}")
        w("")

    # ── Reading Prompt ──
    w("\u2550" * 72)
    w("  READING PROMPT")
    w("  Copy everything above + below into Claude for a full reading.")
    w("\u2550" * 72)
    w("")
    w(f"Write a comprehensive natal chart reading for {name} based on the")
    w("chart data above.")
    w("")
    w("Style: Psychologically penetrating, specific, literary. Not generic")
    w("sun-sign astrology. Speak directly about this person using the exact")
    w("degrees and aspects from the data. The tightest aspects (under 2°)")
    w("are the backbone of the reading.")
    w("")
    w("Structure:")
    w("1. Opening overview — the chart's dominant signature, what makes it")
    w("   unusual, the central tension or question the chart poses")
    w("2. Core Identity — Sun (sign, house, degree, aspects), Moon (sign,")
    w("   house, aspects), Ascendant (sign, conjunctions)")
    w("3. Stellium(s) — what the concentration of energy means, how the")
    w("   planets within it interact")
    w("4. Mind & communication — Mercury's sign, house, and aspects")
    w("5. Values & love — Venus's sign, house, and aspects")
    w("6. Drive & assertion — Mars's sign, house, and aspects")
    w("7. Growth — Jupiter's sign, house, and aspects")
    w("8. Structure & discipline — Saturn's sign, house, and aspects")
    w("9. Generational/outer planets — how Uranus, Neptune, Pluto")
    w("   personally aspect the inner planets and angles")
    w("10. The wound — Chiron's sign, house, and aspects")
    w("11. Soul direction — North/South Node axis")
    w("12. Integration — the central life question, how the chart's")
    w("    tensions can resolve, what the whole pattern points toward")
    w("")
    w("Tone: Warm but honest. Name difficult patterns as clearly as gifts.")
    w("Don't soften or flatter. This should read like a skilled astrologer")
    w("who studied this chart carefully — not a horoscope column.")

    return "\n".join(lines)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Natal Chart Calculator — offline Swiss Ephemeris",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--name", required=True, help="Person's name")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--month", type=int, required=True)
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--hour", type=int, default=None, help="Birth hour (24h). Omit if unknown.")
    ap.add_argument("--minute", type=int, default=0)
    ap.add_argument("--city", default=None, help="City name (built-in lookup)")
    ap.add_argument("--lat", type=float, default=None)
    ap.add_argument("--lon", type=float, default=None)
    ap.add_argument("--tz", default=None, help="Timezone (e.g. Pacific/Auckland)")
    ap.add_argument("--hsys", default="P", help="House system (P=Placidus, W=Whole Sign, E=Equal)")
    ap.add_argument("--list-cities", action="store_true", help="List all built-in cities")

    args = ap.parse_args()

    if args.list_cities:
        print("Available cities:")
        by_region: dict[str, list] = {}
        for city, (lat, lon, tz) in sorted(CITIES.items()):
            region = tz.split("/")[0] if "/" in tz else tz
            by_region.setdefault(region, []).append(city)
        for region in sorted(by_region):
            print(f"\n  {region}:")
            for city in sorted(by_region[region]):
                print(f"    {city}")
        return 0

    # Resolve location
    if args.city:
        key = args.city.lower().strip()
        if key not in CITIES:
            print(f"Error: City '{args.city}' not found. Use --list-cities to see options.", file=sys.stderr)
            print(f"  Or provide --lat, --lon, --tz manually.", file=sys.stderr)
            return 1
        lat, lon, tz_str = CITIES[key]
    elif args.lat is not None and args.lon is not None and args.tz:
        lat, lon, tz_str = args.lat, args.lon, args.tz
    else:
        print("Error: Provide --city or (--lat, --lon, --tz)", file=sys.stderr)
        return 1

    # Handle unknown birth time
    time_known = args.hour is not None
    hour = args.hour if time_known else 12
    minute = args.minute if time_known else 0

    chart = compute_chart(
        args.year, args.month, args.day, hour, minute,
        lat, lon, tz_str, args.hsys, time_known,
    )
    aspects = compute_aspects(chart["points"])
    configs = detect_configurations(aspects, chart["points"])
    analysis = analyze_chart(chart)

    print(format_output(args.name, chart, analysis, aspects, configs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
