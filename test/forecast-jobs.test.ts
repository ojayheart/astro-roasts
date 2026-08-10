import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyForecastResults,
  buildForecastJobs,
  monthPeriod,
  yearPeriod,
  type BatchPorts,
  type CohortUser,
} from "../lib/forecast-jobs.ts";
import type { Period, Subject } from "../lib/subscription-api.ts";
import type { Forecast } from "../lib/subscription-roast.ts";
import type { CalendarTransits } from "../lib/transits.ts";

const ONE = "3f1b1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
const TWO = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const SUBJECT: Subject = {
  name: "Oliver",
  dob: "1992-03-14",
  birthTime: "09:15",
  birthCity: "Munich, Germany",
  tz: "Pacific/Auckland",
};

const COHORT: CohortUser[] = [
  { userId: ONE, subject: SUBJECT },
  { userId: TWO, subject: { ...SUBJECT, name: "Mara" } },
];

const TRANSITS = { mode: "month" } as unknown as CalendarTransits;

const FORECAST: Forecast = {
  title: "A Month Of Admin",
  body: "Saturn files the paperwork you did not.",
  highlights: ["one"],
  avoid: ["two"],
};

function ports(over: Partial<BatchPorts> = {}): BatchPorts {
  return {
    subscribers: async () => COHORT,
    transits: async () => TRANSITS,
    ...over,
  };
}

test("the monthly window is the month the cron fired in", () => {
  assert.deepEqual(monthPeriod(new Date("2026-08-01T02:00:00Z")), {
    kind: "month",
    start: "2026-08-01",
    end: "2026-08-31",
  });
});

test("February gets its real last day", () => {
  assert.equal(monthPeriod(new Date("2028-02-01T02:00:00Z")).end, "2028-02-29");
  assert.equal(monthPeriod(new Date("2027-02-01T02:00:00Z")).end, "2027-02-28");
});

test("the yearly window is the calendar year", () => {
  assert.deepEqual(yearPeriod(new Date("2027-01-01T03:00:00Z")), {
    kind: "year",
    start: "2027-01-01",
    end: "2027-12-31",
  });
});

test("every subscriber with transits becomes a batch job keyed by user id", async () => {
  const jobs = await buildForecastJobs(ports(), monthPeriod(new Date()));
  assert.deepEqual(
    jobs.map((job) => job.customId),
    [ONE, TWO],
  );
  assert.equal(jobs[0].transits, TRANSITS);
});

test("a subscriber the transit engine cannot serve is skipped, not failed", async () => {
  const jobs = await buildForecastJobs(
    ports({
      transits: async (subject) => (subject.name === "Mara" ? null : TRANSITS),
    }),
    monthPeriod(new Date()),
  );
  assert.deepEqual(
    jobs.map((job) => job.customId),
    [ONE],
  );
});

test("results are written against the id they came back with", async () => {
  const period: Period = {
    kind: "month",
    start: "2026-08-01",
    end: "2026-08-31",
  };
  const written: string[] = [];
  const counts = await applyForecastResults(
    [
      { customId: TWO, forecast: FORECAST },
      { customId: ONE, forecast: FORECAST },
    ],
    period,
    async (userId, saved) => {
      assert.deepEqual(saved, period);
      written.push(userId);
    },
  );
  assert.deepEqual(written, [TWO, ONE]);
  assert.deepEqual(counts, { written: 2, failed: 0 });
});

test("an errored or empty batch entry is counted, never saved as a blank roast", async () => {
  const written: string[] = [];
  const counts = await applyForecastResults(
    [
      { customId: ONE },
      { customId: TWO, forecast: { ...FORECAST, body: "   " } },
    ],
    { kind: "year", start: "2027-01-01", end: "2027-12-31" },
    async (userId) => {
      written.push(userId);
    },
  );
  assert.deepEqual(written, []);
  assert.deepEqual(counts, { written: 0, failed: 2 });
});
