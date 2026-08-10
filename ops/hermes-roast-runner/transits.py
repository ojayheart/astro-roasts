#!/usr/bin/env python3
"""
Offline transit engine — daily hits, month calendar, year calendar.

Ported from ~/transits_offline_meaningful.py (tightest-orb scan, applying flag)
and ~/transits_offline_calendar.py (orb-threshold intervals with peak).

Natal input arrives per invocation. Swiss Ephemeris only — no network.

Usage:
  python3 transits.py --mode daily --json --name Friend \\
    --year 1994 --month 1 --day 21 --hour 13 --minute 0 \\
    --lat -41.2866 --lon 174.7762 --tz Pacific/Auckland --date 2026-08-10
  python3 transits.py --mode month  ... --target-year 2026 --target-month 9
  python3 transits.py --mode year   ... --start 2026-01-01
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import swisseph as swe


UTC = ZoneInfo("UTC")

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
}

ASPECT_ANGLES = {
    "conjunction": 0.0,
    "sextile": 60.0,
    "square": 90.0,
    "trine": 120.0,
    "opposition": 180.0,
}

ANGLES = ("Ascendant", "Medium_Coeli")

DAILY_TRANSITERS = [
    "Moon",
    "Sun",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
]
SLOW_TRANSITERS = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
TARGETS = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Ascendant",
    "Medium_Coeli",
]
ASPECTS = ["conjunction", "opposition", "square", "trine", "sextile"]

DAILY_ORBS = {"base": 3.0, "jupiter": 3.0, "soft": 3.0, "moon": 6.0}
CALENDAR_ORBS = {"base": 1.5, "jupiter": 2.0, "soft": 1.5, "moon": 6.0}


def norm360(x: float) -> float:
    x = x % 360.0
    return x + 360.0 if x < 0 else x


def angle_sep(a: float, b: float) -> float:
    d = abs(norm360(a) - norm360(b)) % 360.0
    return 360.0 - d if d > 180.0 else d


def julday_ut(dtu: dt.datetime) -> float:
    hh = dtu.hour + dtu.minute / 60 + dtu.second / 3600
    return swe.julday(dtu.year, dtu.month, dtu.day, hh, swe.GREG_CAL)


def jd_to_utc(jd_ut: float) -> dt.datetime:
    y, m, d, hour = swe.revjul(jd_ut, swe.GREG_CAL)
    hh = int(hour)
    rem = (hour - hh) * 60.0
    mm = int(rem)
    ss = int(round((rem - mm) * 60.0))
    if ss == 60:
        ss, mm = 0, mm + 1
    if mm == 60:
        mm, hh = 0, hh + 1
    base = dt.datetime(int(y), int(m), int(d), tzinfo=UTC)
    return base + dt.timedelta(hours=hh, minutes=mm, seconds=ss)


def calc_lon(jd_ut: float, body_id: int) -> float:
    try:
        (xx, _rf) = swe.calc_ut(jd_ut, body_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
    except Exception:
        (xx, _rf) = swe.calc_ut(jd_ut, body_id, swe.FLG_MOSEPH | swe.FLG_SPEED)
    return norm360(xx[0])


def max_orb_for(transiter: str, aspect: str, orbs: Dict[str, float]) -> float:
    orb = orbs["base"]
    if transiter == "Moon":
        orb = max(orb, orbs["moon"])
    if transiter == "Jupiter":
        orb = max(orb, orbs["jupiter"])
    if aspect in ("trine", "sextile"):
        orb = min(orb, orbs["soft"])
    return orb


def normalize_chart(chart: Dict[str, Any]) -> Dict[str, Any]:
    hour = chart.get("hour")
    return {
        "name": chart.get("name") or "Friend",
        "year": int(chart["year"]),
        "month": int(chart["month"]),
        "day": int(chart["day"]),
        "hour": None if hour is None else int(hour),
        "minute": int(chart.get("minute") or 0),
        "lat": float(chart["lat"]),
        "lon": float(chart["lon"]),
        "tz": str(chart["tz"]),
        "hsys": str(chart.get("hsys") or "P"),
    }


def natal_points(chart: Dict[str, Any]) -> Dict[str, float]:
    """Natal ecliptic longitudes. Angles only when a birth time is known."""
    c = normalize_chart(chart)
    local = dt.datetime(
        c["year"],
        c["month"],
        c["day"],
        c["hour"] or 12,
        c["minute"],
        tzinfo=ZoneInfo(c["tz"]),
    )
    jd = julday_ut(local.astimezone(UTC))

    pts: Dict[str, float] = {}
    for name, pid in PLANET_IDS.items():
        try:
            pts[name] = calc_lon(jd, pid)
        except Exception:
            continue

    if c["hour"] is not None:
        _cusps, ascmc = swe.houses(jd, c["lat"], c["lon"], c["hsys"].encode("ascii"))
        pts["Ascendant"] = norm360(float(ascmc[0]))
        pts["Medium_Coeli"] = norm360(float(ascmc[1]))

    return pts


def usable_targets(nat: Dict[str, float], targets: List[str]) -> List[str]:
    return [t for t in targets if t in nat]


def usable_transiters(names: List[str]) -> List[str]:
    out = []
    for n in names:
        if n not in PLANET_IDS:
            continue
        try:
            calc_lon(julday_ut(dt.datetime(2026, 1, 1, tzinfo=UTC)), PLANET_IDS[n])
        except Exception:
            continue
        out.append(n)
    return out


def sample_times(start_utc: dt.datetime, end_utc: dt.datetime, step: dt.timedelta):
    cur = start_utc
    while cur <= end_utc:
        yield cur
        cur += step


def longitude_series(
    transiters: List[str], start_utc: dt.datetime, end_utc: dt.datetime, step: dt.timedelta
) -> Tuple[List[float], Dict[str, List[float]]]:
    jds = [julday_ut(t) for t in sample_times(start_utc, end_utc, step)]
    return jds, {t: [calc_lon(jd, PLANET_IDS[t]) for jd in jds] for t in transiters}


def orb_at(jd_ut: float, transiter_id: int, natal_lon: float, aspect_angle: float) -> float:
    return abs(angle_sep(calc_lon(jd_ut, transiter_id), natal_lon) - aspect_angle)


def bisect_crossing(
    transiter_id: int,
    natal_lon: float,
    aspect_angle: float,
    threshold: float,
    jd_a: float,
    jd_b: float,
    max_iter: int = 60,
) -> float:
    fa = orb_at(jd_a, transiter_id, natal_lon, aspect_angle) - threshold
    fb = orb_at(jd_b, transiter_id, natal_lon, aspect_angle) - threshold
    if fa == 0:
        return jd_a
    if fb == 0:
        return jd_b
    if fa * fb > 0:
        raise ValueError("crossing_not_bracketed")
    lo, hi, flo = jd_a, jd_b, fa
    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        fm = orb_at(mid, transiter_id, natal_lon, aspect_angle) - threshold
        if fm == 0:
            return mid
        if flo * fm <= 0:
            hi = mid
        else:
            lo, flo = mid, fm
        if (hi - lo) * 86400.0 < 60.0:
            break
    return (lo + hi) / 2.0


def refine_peak(
    transiter_id: int,
    natal_lon: float,
    aspect_angle: float,
    jd_lo: float,
    jd_hi: float,
    step_minutes: int,
) -> Tuple[float, float]:
    step = step_minutes / (24.0 * 60.0)
    best_jd, best_orb = jd_lo, 999.0
    jd = jd_lo
    while jd <= jd_hi + 1e-12:
        o = orb_at(jd, transiter_id, natal_lon, aspect_angle)
        if o < best_orb:
            best_jd, best_orb = jd, o
        jd += step
    return best_jd, best_orb


def applying_at(transiter_id: int, natal_lon: float, aspect_angle: float, jd_ut: float) -> bool:
    o0 = orb_at(jd_ut, transiter_id, natal_lon, aspect_angle)
    o1 = orb_at(jd_ut + 1.0 / 24.0, transiter_id, natal_lon, aspect_angle)
    return o1 < o0


def natal_summary(nat: Dict[str, float]) -> Dict[str, float]:
    return {k: round(v, 6) for k, v in nat.items()}


def daily(
    chart: Dict[str, Any],
    date: str,
    transiters: Optional[List[str]] = None,
    targets: Optional[List[str]] = None,
    aspects: Optional[List[str]] = None,
    orbs: Optional[Dict[str, float]] = None,
    step_minutes: int = 60,
) -> Dict[str, Any]:
    c = normalize_chart(chart)
    orbs = orbs or DAILY_ORBS
    tz = ZoneInfo(c["tz"])
    day = dt.date.fromisoformat(date)
    start_utc = dt.datetime(day.year, day.month, day.day, 0, 0, tzinfo=tz).astimezone(UTC)
    end_utc = dt.datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=tz).astimezone(UTC)

    nat = natal_points(c)
    trans = usable_transiters(transiters or DAILY_TRANSITERS)
    tgts = usable_targets(nat, targets or TARGETS)
    asps = [a for a in (aspects or ASPECTS) if a in ASPECT_ANGLES]

    jds, lons = longitude_series(trans, start_utc, end_utc, dt.timedelta(minutes=step_minutes))

    hits: List[Dict[str, Any]] = []
    for t in trans:
        tid = PLANET_IDS[t]
        for target in tgts:
            n_lon = nat[target]
            for asp in asps:
                ang = ASPECT_ANGLES[asp]
                thr = max_orb_for(t, asp, orbs)
                best_i, best_orb = 0, 999.0
                for i, lon in enumerate(lons[t]):
                    o = abs(angle_sep(lon, n_lon) - ang)
                    if o < best_orb:
                        best_i, best_orb = i, o
                if best_orb > thr:
                    continue
                lo = jds[max(0, best_i - 1)]
                hi = jds[min(len(jds) - 1, best_i + 1)]
                peak_jd, peak_orb = refine_peak(tid, n_lon, ang, lo, hi, 5)
                if peak_orb > thr:
                    continue
                peak_utc = jd_to_utc(peak_jd)
                hits.append(
                    {
                        "summary": f"{t} {asp} natal {target}",
                        "transiter": t,
                        "aspect": asp,
                        "target": target,
                        "peak_local": peak_utc.astimezone(tz).isoformat(),
                        "peak_utc": peak_utc.isoformat(),
                        "orb_deg": round(peak_orb, 6),
                        "applying": applying_at(tid, n_lon, ang, peak_jd),
                    }
                )

    hits.sort(key=lambda h: h["orb_deg"])
    return {
        "mode": "daily",
        "name": c["name"],
        "date": day.isoformat(),
        "tz": c["tz"],
        "has_birth_time": c["hour"] is not None,
        "natal": natal_summary(nat),
        "transits": hits,
    }


def calendar(
    chart: Dict[str, Any],
    start: dt.date,
    end: dt.date,
    mode: str,
    transiters: Optional[List[str]] = None,
    targets: Optional[List[str]] = None,
    aspects: Optional[List[str]] = None,
    orbs: Optional[Dict[str, float]] = None,
    step_hours: int = 6,
    refine_minutes: int = 30,
) -> Dict[str, Any]:
    c = normalize_chart(chart)
    orbs = orbs or CALENDAR_ORBS
    tz = ZoneInfo(c["tz"])
    start_utc = dt.datetime(start.year, start.month, start.day, 0, 0, tzinfo=tz).astimezone(UTC)
    end_utc = dt.datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=tz).astimezone(UTC)

    nat = natal_points(c)
    trans = usable_transiters(transiters or SLOW_TRANSITERS)
    tgts = usable_targets(nat, targets or TARGETS)
    asps = [a for a in (aspects or ASPECTS) if a in ASPECT_ANGLES]

    jds, lons = longitude_series(trans, start_utc, end_utc, dt.timedelta(hours=step_hours))
    last_jd = jds[-1]

    events: List[Dict[str, Any]] = []
    for t in trans:
        tid = PLANET_IDS[t]
        for target in tgts:
            n_lon = nat[target]
            for asp in asps:
                ang = ASPECT_ANGLES[asp]
                thr = max_orb_for(t, asp, orbs)
                series = [abs(angle_sep(lon, n_lon) - ang) for lon in lons[t]]

                open_jd: Optional[float] = None
                for i, o in enumerate(series):
                    if open_jd is None and o <= thr:
                        if i > 0 and series[i - 1] > thr:
                            try:
                                open_jd = bisect_crossing(tid, n_lon, ang, thr, jds[i - 1], jds[i])
                            except ValueError:
                                open_jd = jds[i]
                        else:
                            open_jd = jds[i]
                    elif open_jd is not None and o > thr:
                        try:
                            close_jd = bisect_crossing(tid, n_lon, ang, thr, jds[i - 1], jds[i])
                        except ValueError:
                            close_jd = jds[i]
                        if close_jd >= open_jd:
                            events.append(
                                build_event(t, asp, target, tid, n_lon, ang, open_jd, close_jd, tz, refine_minutes)
                            )
                        open_jd = None

                if open_jd is not None:
                    events.append(
                        build_event(t, asp, target, tid, n_lon, ang, open_jd, last_jd, tz, refine_minutes)
                    )

    events.sort(key=lambda e: e["start_utc"])
    return {
        "mode": mode,
        "name": c["name"],
        "start": start.isoformat(),
        "end": end.isoformat(),
        "tz": c["tz"],
        "has_birth_time": c["hour"] is not None,
        "natal": natal_summary(nat),
        "events": events,
    }


def build_event(
    transiter: str,
    aspect: str,
    target: str,
    tid: int,
    natal_lon: float,
    aspect_angle: float,
    start_jd: float,
    end_jd: float,
    tz: ZoneInfo,
    refine_minutes: int,
) -> Dict[str, Any]:
    peak_jd, peak_orb = refine_peak(tid, natal_lon, aspect_angle, start_jd, end_jd, refine_minutes)
    s, e, p = jd_to_utc(start_jd), jd_to_utc(end_jd), jd_to_utc(peak_jd)
    return {
        "summary": f"{transiter} {aspect} natal {target}",
        "transiter": transiter,
        "aspect": aspect,
        "target": target,
        "start_local": s.astimezone(tz).isoformat(),
        "end_local": e.astimezone(tz).isoformat(),
        "peak_local": p.astimezone(tz).isoformat(),
        "start_utc": s.isoformat(),
        "end_utc": e.isoformat(),
        "peak_utc": p.isoformat(),
        "peak_orb_deg": round(peak_orb, 6),
    }


def add_months(d: dt.date, months: int) -> dt.date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last = (dt.date(y, m, 28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
    return dt.date(y, m, min(d.day, last.day))


def month(chart: Dict[str, Any], year: int, month: int, **kw: Any) -> Dict[str, Any]:
    start = dt.date(int(year), int(month), 1)
    end = add_months(start, 1) - dt.timedelta(days=1)
    return calendar(chart, start, end, "month", **kw)


def year(chart: Dict[str, Any], start_date: str, **kw: Any) -> Dict[str, Any]:
    start = dt.date.fromisoformat(start_date)
    end = add_months(start, 12) - dt.timedelta(days=1)
    kw.setdefault("step_hours", 12)
    return calendar(chart, start, end, "year", **kw)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", required=True, choices=["daily", "month", "year"])
    ap.add_argument("--json", action="store_true", dest="json_out", help="Accepted for symmetry; output is always JSON")

    ap.add_argument("--name", default="Friend")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--month", type=int, required=True)
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--hour", type=int, default=None)
    ap.add_argument("--minute", type=int, default=0)
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--tz", required=True)
    ap.add_argument("--hsys", default="P")

    ap.add_argument("--date", default="", help="daily: YYYY-MM-DD")
    ap.add_argument("--target-year", type=int, default=None, help="month: calendar year")
    ap.add_argument("--target-month", type=int, default=None, help="month: 1-12")
    ap.add_argument("--start", default="", help="year: YYYY-MM-DD")

    ap.add_argument("--transiters", nargs="+", default=None)
    ap.add_argument("--targets", nargs="+", default=None)
    ap.add_argument("--aspects", nargs="+", default=None)
    args = ap.parse_args()

    swe.set_ephe_path(os.getenv("SWEPHE_PATH", ""))

    chart = {
        "name": args.name,
        "year": args.year,
        "month": args.month,
        "day": args.day,
        "hour": args.hour,
        "minute": args.minute,
        "lat": args.lat,
        "lon": args.lon,
        "tz": args.tz,
        "hsys": args.hsys,
    }
    picks = {
        k: v
        for k, v in (
            ("transiters", args.transiters),
            ("targets", args.targets),
            ("aspects", args.aspects),
        )
        if v
    }

    try:
        if args.mode == "daily":
            if not args.date:
                raise ValueError("--date is required for --mode daily")
            out = daily(chart, args.date, **picks)
        elif args.mode == "month":
            if args.target_year is None or args.target_month is None:
                raise ValueError("--target-year and --target-month are required for --mode month")
            out = month(chart, args.target_year, args.target_month, **picks)
        else:
            if not args.start:
                raise ValueError("--start is required for --mode year")
            out = year(chart, args.start, **picks)
    except Exception as err:
        print(json.dumps({"error": "transits_failed", "detail": str(err)}, ensure_ascii=False))
        print(str(err), file=sys.stderr)
        return 1

    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
