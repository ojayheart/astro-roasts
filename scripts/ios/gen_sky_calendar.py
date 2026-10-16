#!/usr/bin/env python3
"""Generates public/calendar/sky.ics: a subscribable calendar of the sky (moons, eclipses, stations, sign changes) in the AstroRoast voice.
No personal data. Subscribe with webcal://astroroast.com/calendar/sky.ics (Apple Calendar) or the https URL in Google Calendar -> Other calendars -> From URL.
Run: python3 scripts/ios/gen_sky_calendar.py [first_year] [last_year]   (needs pyswisseph)"""
import sys, hashlib, datetime as dt, swisseph as swe

Y0 = int(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today().year
Y1 = int(sys.argv[2]) if len(sys.argv) > 2 else Y0 + 3
SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
F = swe.FLG_MOSEPH | swe.FLG_SPEED
def sign(l): return SIGNS[int(l % 360 // 30)]
def lon(b, jd): return swe.calc_ut(jd, b, F)[0][0]
def spd(b, jd): return swe.calc_ut(jd, b, F)[0][3]
def to_dt(jd):
    y, m, d, h = swe.revjul(jd); s = round(h * 3600)
    return dt.datetime(y, m, d) + dt.timedelta(seconds=s)
def bisect(f, a, b, n=40):
    fa = f(a)
    for _ in range(n):
        m = (a + b) / 2; fm = f(m)
        if (fa < 0) == (fm < 0): a, fa = m, fm
        else: b = m
    return (a + b) / 2

start = swe.julday(Y0, 1, 1, 0); end = swe.julday(Y1 + 1, 1, 1, 0)
ev = []  # (datetime_utc, title, note)

# moon phases
def elong(jd): return (lon(swe.MOON, jd) - lon(swe.SUN, jd)) % 360
for target, name, note in [(0, "New Moon", "Plant something. Not a grudge."), (180, "Full Moon", "Something you said in May comes back tonight."), (90, "First quarter moon", "Make one decision. Just one."), (270, "Last quarter moon", "Finish one thing. Pick the small one.")]:
    jd = start; prev = ((elong(jd) - target + 180) % 360) - 180
    while jd < end:
        jd2 = jd + 0.25; v = ((elong(jd2) - target + 180) % 360) - 180
        if prev < 0 <= v and abs(v - prev) < 90:
            r = bisect(lambda x: ((elong(x) - target + 180) % 360) - 180, jd, jd2)
            sg = sign(lon(swe.MOON, r))
            title = f"{name} in {sg}" if target in (0, 180) else name
            ev.append((to_dt(r), "☽ " + title, note))
        prev = v; jd = jd2

# eclipses
jd = start
while True:
    ret, tret = swe.sol_eclipse_when_glob(jd, swe.FLG_MOSEPH)
    t = tret[0]
    if t >= end: break
    kind = "total" if ret & swe.ECL_TOTAL else "annular" if ret & swe.ECL_ANNULAR else "partial"
    ev.append((to_dt(t), f"☀ Solar eclipse ({kind}) in {sign(lon(swe.SUN, t))}", "A new moon with a plot twist. Maybe don't announce anything today.")); jd = t + 20
jd = start
while True:
    ret, tret = swe.lun_eclipse_when(jd, swe.FLG_MOSEPH)
    t = tret[0]
    if t >= end: break
    kind = "total" if ret & swe.ECL_TOTAL else "partial" if ret & swe.ECL_PARTIAL else "penumbral"
    ev.append((to_dt(t), f"☽ Lunar eclipse ({kind}) in {sign(lon(swe.MOON, t))}", "A full moon with feelings. Be nice to people tonight, including yourself.")); jd = t + 20

# stations and sign changes
STN = {swe.MERCURY: ("Mercury", "Back up your phone. Do not back up to your ex.", "Texts make sense again. Mostly."),
       swe.VENUS: ("Venus", "Love life under review. Do not sign anything romantic.", "Your love life gets its licence back."),
       swe.MARS: ("Mars", "Energy goes inward. Rest is a strategy.", "Drive is back. Aim it at something worthwhile.")}
for body, (nm, rx, direct) in STN.items():
    jd = start; prev = spd(body, jd)
    while jd < end:
        jd2 = jd + 0.5; s2 = spd(body, jd2)
        if (prev < 0) != (s2 < 0):
            r = bisect(lambda x: spd(body, x), jd, jd2)
            ev.append((to_dt(r), f"{nm} turns {'retrograde' if s2 < 0 else 'direct'} in {sign(lon(body, r))}", rx if s2 < 0 else direct))
        prev = s2; jd = jd2
SEASON = {"Aries": "Spring equinox season starts. Everyone is suddenly very motivated.", "Cancer": "Solstice. The longest day. Please drink some water.",
          "Libra": "Autumn equinox. Balance is a nice idea.", "Capricorn": "Solstice. The year is doing a quiet reset."}
jd = start; prev = int(lon(swe.SUN, jd) // 30)
while jd < end:
    jd2 = jd + 0.5; s = int(lon(swe.SUN, jd2) // 30)
    if s != prev:
        r = bisect(lambda x: ((lon(swe.SUN, x) - s * 30 + 180) % 360) - 180, jd, jd2)
        ev.append((to_dt(r), f"☉ Sun enters {SIGNS[s]}", SEASON.get(SIGNS[s], f"A new season. {SIGNS[s]} is in charge for a month. Nobody asked, but here we are.")))
        prev = s
    jd = jd2

ev.sort(key=lambda e: e[0])
def esc(s): return s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\;").replace("\n", "\\n")
def fold(line):
    out, b = [], line.encode()
    while len(b) > 74:
        cut = 74
        while (b[cut] & 0xC0) == 0x80: cut -= 1
        out.append(b[:cut].decode()); b = b[cut:]; line = b" " + b
        b = line
    out.append(b.decode()); return "\r\n".join(out)
L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AstroRoast//Sky//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:AstroRoast: the sky",
     "X-WR-CALDESC:Moons, eclipses, retrogrades and sign changes, in the AstroRoast voice.", "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D"]
stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
for t, title, note in ev:
    uid = f"{t:%Y%m%dT%H%M}-{int(hashlib.md5(title.encode()).hexdigest()[:8], 16)}@astroroast.com"
    L += ["BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{stamp}", f"DTSTART:{t:%Y%m%dT%H%M%SZ}", f"DTEND:{(t + dt.timedelta(minutes=30)):%Y%m%dT%H%M%SZ}",
          f"SUMMARY:{esc(title)}", f"DESCRIPTION:{esc(note)}", "TRANSP:TRANSPARENT", "END:VEVENT"]
L.append("END:VCALENDAR")
open("public/calendar/sky.ics", "w", newline="").write("\r\n".join(fold(l) for l in L) + "\r\n")
print(len(ev), "events", ev[0][0].date(), "->", ev[-1][0].date())
