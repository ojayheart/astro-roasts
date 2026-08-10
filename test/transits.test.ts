import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(
  new URL("../ops/hermes-roast-runner/transits.py", import.meta.url),
);
const PYTHON = process.env.ASTRO_PYTHON || "python3";

// Wellington, 21 Jan 1994 13:00 — the fixture chart every expectation below
// was computed from with Swiss Ephemeris offline.
const NATAL = [
  "--name",
  "Fixture",
  "--year",
  "1994",
  "--month",
  "1",
  "--day",
  "21",
  "--hour",
  "13",
  "--minute",
  "0",
  "--lat",
  "-41.2866",
  "--lon",
  "174.7762",
  "--tz",
  "Pacific/Auckland",
];

const HAVE_SWE =
  spawnSync(PYTHON, ["-c", "import swisseph"], { stdio: "ignore" }).status ===
  0;
const opts = { skip: HAVE_SWE ? false : "swisseph not installed" };

type Json = Record<string, any>;

function run(args: string[]): Json {
  const proc = spawnSync(PYTHON, [SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(proc.status, 0, proc.stderr);
  const parsed = JSON.parse(proc.stdout);
  assert.equal(Array.isArray(parsed), false);
  assert.equal(typeof parsed, "object");
  return parsed;
}

test("daily emits one object with the day's tightest hits", opts, () => {
  const out = run([
    "--mode",
    "daily",
    "--json",
    ...NATAL,
    "--date",
    "2026-08-10",
  ]);

  assert.equal(out.mode, "daily");
  assert.equal(out.date, "2026-08-10");
  assert.equal(out.tz, "Pacific/Auckland");
  assert.equal(out.has_birth_time, true);
  assert.ok(Math.abs(out.natal.Sun - 300.715567) < 1e-4);
  assert.ok(Math.abs(out.natal.Ascendant - 19.62016) < 1e-4);

  const hit = out.transits.find(
    (t: Json) => t.summary === "Mars trine natal Saturn",
  );
  assert.ok(hit, "expected Mars trine natal Saturn on 2026-08-10");
  assert.ok(hit.orb_deg < 0.01);
  assert.ok(hit.peak_utc.startsWith("2026-08-"));
  assert.equal(typeof hit.applying, "boolean");

  const orbs = out.transits.map((t: Json) => t.orb_deg);
  assert.deepEqual(
    orbs,
    [...orbs].sort((a: number, b: number) => a - b),
  );
});

test("month covers the calendar month and brackets every peak", opts, () => {
  const out = run([
    "--mode",
    "month",
    "--json",
    ...NATAL,
    "--target-year",
    "2026",
    "--target-month",
    "9",
  ]);

  assert.equal(out.mode, "month");
  assert.equal(out.start, "2026-09-01");
  assert.equal(out.end, "2026-09-30");
  assert.ok(out.events.length > 0);

  for (const ev of out.events) {
    assert.ok(ev.start_utc <= ev.peak_utc);
    assert.ok(ev.peak_utc <= ev.end_utc);
    assert.equal(ev.summary, `${ev.transiter} ${ev.aspect} natal ${ev.target}`);
    assert.ok(ev.peak_orb_deg >= 0);
  }

  const starts = out.events.map((e: Json) => e.start_utc);
  assert.deepEqual(starts, [...starts].sort());
});

test("year spans twelve months from the start date", opts, () => {
  const out = run([
    "--mode",
    "year",
    "--json",
    ...NATAL,
    "--start",
    "2026-01-01",
  ]);

  assert.equal(out.mode, "year");
  assert.equal(out.start, "2026-01-01");
  assert.equal(out.end, "2026-12-31");
  assert.ok(
    out.events.some((e: Json) => e.summary === "Pluto conjunction natal Venus"),
  );
  assert.ok(
    out.events.every((e: Json) =>
      ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(e.transiter),
    ),
  );
});

test("no birth time means no angles", opts, () => {
  const withoutTime = NATAL.filter(
    (a, i) =>
      !["--hour", "--minute"].includes(a) &&
      !["--hour", "--minute"].includes(NATAL[i - 1]),
  );
  const out = run([
    "--mode",
    "daily",
    "--json",
    ...withoutTime,
    "--date",
    "2026-08-10",
  ]);

  assert.equal(out.has_birth_time, false);
  assert.equal(out.natal.Ascendant, undefined);
  assert.equal(out.natal.Medium_Coeli, undefined);
  assert.equal(
    out.transits.some((t: Json) =>
      ["Ascendant", "Medium_Coeli"].includes(t.target),
    ),
    false,
  );
});

test("a missing period argument still prints one JSON object", opts, () => {
  const proc = spawnSync(PYTHON, [SCRIPT, "--mode", "daily", ...NATAL], {
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(proc.status, 1);
  const parsed = JSON.parse(proc.stdout);
  assert.equal(parsed.error, "transits_failed");
  assert.match(parsed.detail, /--date/);
});
