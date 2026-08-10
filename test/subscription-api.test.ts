import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDate,
  parseDailyDate,
  parsePeriod,
  serveDaily,
  serveForecast,
  type DailyPorts,
  type DailyRow,
  type ForecastPorts,
  type ForecastRow,
  type Subject,
} from "../lib/subscription-api.ts";
import type { CalendarTransits, DailyTransits } from "../lib/transits.ts";

const USER_ID = "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";

const SUBJECT: Subject = {
  name: "Oliver",
  dob: "1992-03-14",
  birthTime: "09:15",
  birthCity: "Munich, Germany",
  tz: "Pacific/Auckland",
};

const DAILY_ROW: DailyRow = {
  forDate: "2026-08-10",
  title: "Saturn Files A Complaint",
  goldLine: "Today you meet the deadline you invented.",
  body: "…",
  status: "ready",
};

const FORECAST_ROW: ForecastRow = {
  kind: "month",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  title: "A Month Of Admin",
  body: "…",
  highlights: ["one"],
  avoid: ["two"],
  status: "ready",
};

const DAILY_TRANSITS = { mode: "daily" } as unknown as DailyTransits;
const MONTH_TRANSITS = { mode: "month" } as unknown as CalendarTransits;

function dailyPorts(over: Partial<DailyPorts> = {}): DailyPorts {
  return {
    userId: async () => USER_ID,
    subscribed: async () => true,
    subject: async () => SUBJECT,
    find: async () => DAILY_ROW,
    generate: async () => {
      throw new Error("generate should not run");
    },
    save: async () => {
      throw new Error("save should not run");
    },
    ...over,
  };
}

function forecastPorts(over: Partial<ForecastPorts> = {}): ForecastPorts {
  return {
    userId: async () => USER_ID,
    subscribed: async () => true,
    subject: async () => SUBJECT,
    find: async () => FORECAST_ROW,
    generate: async () => {
      throw new Error("generate should not run");
    },
    save: async () => {
      throw new Error("save should not run");
    },
    ...over,
  };
}

const q = (s = "") => new URLSearchParams(s);

test("no session is 401 on both routes, before anything else runs", async () => {
  const nobody = { userId: async () => null };
  const daily = await serveDaily(
    dailyPorts({
      ...nobody,
      subscribed: async () => {
        throw new Error("gate should not run");
      },
    }),
    q(),
  );
  assert.deepEqual(daily, { status: 401, body: { error: "unauthorized" } });

  const forecast = await serveForecast(forecastPorts(nobody), q("kind=month"));
  assert.equal(forecast.status, 401);
});

test("an unsubscribed user is 402, never a roast", async () => {
  const unsubscribed = { subscribed: async () => false };
  const daily = await serveDaily(
    dailyPorts({
      ...unsubscribed,
      find: async () => {
        throw new Error("must not read daily_roasts");
      },
    }),
    q(),
  );
  assert.deepEqual(daily, {
    status: 402,
    body: { error: "subscription_required" },
  });

  const forecast = await serveForecast(
    forecastPorts(unsubscribed),
    q("kind=year&period=2026-01"),
  );
  assert.equal(forecast.status, 402);
});

test("a cached daily row is served without generating", async () => {
  let generated = false;
  const reply = await serveDaily(
    dailyPorts({
      generate: async () => {
        generated = true;
        return null;
      },
    }),
    q("date=2026-08-10"),
  );
  assert.equal(generated, false);
  assert.deepEqual(reply, { status: 200, body: { daily: DAILY_ROW } });
});

test("a cache miss generates, persists, and returns the saved row", async () => {
  const saved: string[] = [];
  const reply = await serveDaily(
    dailyPorts({
      find: async () => null,
      generate: async (subject, date) => {
        assert.equal(subject.name, "Oliver");
        assert.equal(date, "2026-08-11");
        return {
          roast: {
            title: DAILY_ROW.title!,
            goldLine: DAILY_ROW.goldLine!,
            body: DAILY_ROW.body!,
          },
          transits: DAILY_TRANSITS,
        };
      },
      save: async (userId, date) => {
        saved.push(`${userId}:${date}`);
        return { ...DAILY_ROW, forDate: date };
      },
    }),
    q("date=2026-08-11"),
  );
  assert.deepEqual(saved, [`${USER_ID}:2026-08-11`]);
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body, {
    daily: { ...DAILY_ROW, forDate: "2026-08-11" },
  });
});

test("no date falls back to the user's own calendar day", async () => {
  let asked = "";
  await serveDaily(
    dailyPorts({
      find: async (_userId, date) => {
        asked = date;
        return DAILY_ROW;
      },
    }),
    q(),
  );
  assert.equal(asked, localDate(SUBJECT.tz));
  assert.match(asked, /^\d{4}-\d{2}-\d{2}$/);
});

test("a malformed date is 400, an unknown user is 404", async () => {
  const bad = await serveDaily(dailyPorts(), q("date=10/08/2026"));
  assert.deepEqual(bad, { status: 400, body: { error: "invalid_date" } });

  const missing = await serveDaily(
    dailyPorts({ subject: async () => null }),
    q(),
  );
  assert.deepEqual(missing, { status: 404, body: { error: "not_found" } });
});

test("generation that cannot run is 503, not an empty roast", async () => {
  const reply = await serveDaily(
    dailyPorts({ find: async () => null, generate: async () => null }),
    q("date=2026-08-10"),
  );
  assert.deepEqual(reply, { status: 503, body: { error: "unavailable" } });
});

test("a cached forecast is served without generating", async () => {
  let generated = false;
  const reply = await serveForecast(
    forecastPorts({
      generate: async () => {
        generated = true;
        return null;
      },
    }),
    q("kind=month&period=2026-08"),
  );
  assert.equal(generated, false);
  assert.deepEqual(reply, { status: 200, body: { forecast: FORECAST_ROW } });
});

test("a missing forecast generates for the requested window and persists", async () => {
  let savedPeriod = "";
  const reply = await serveForecast(
    forecastPorts({
      find: async () => null,
      generate: async (_subject, period) => {
        assert.deepEqual(period, {
          kind: "year",
          start: "2026-03-01",
          end: "2027-02-28",
        });
        return {
          forecast: {
            title: "T",
            body: "B",
            highlights: ["h"],
            avoid: ["a"],
          },
          transits: MONTH_TRANSITS,
        };
      },
      save: async (_userId, period) => {
        savedPeriod = `${period.kind} ${period.start}..${period.end}`;
        return {
          ...FORECAST_ROW,
          kind: period.kind,
          periodStart: period.start,
          periodEnd: period.end,
          title: "T",
          body: "B",
          highlights: ["h"],
          avoid: ["a"],
        };
      },
    }),
    q("kind=year&period=2026-03"),
  );
  assert.equal(savedPeriod, "year 2026-03-01..2027-02-28");
  assert.equal(reply.status, 200);
});

test("an unknown kind is 400 whatever the period says", async () => {
  const reply = await serveForecast(
    forecastPorts(),
    q("kind=week&period=2026-08"),
  );
  assert.deepEqual(reply, { status: 400, body: { error: "invalid_period" } });
});

test("periods bracket the calendar window", () => {
  assert.deepEqual(parsePeriod("month", "2026-02"), {
    kind: "month",
    start: "2026-02-01",
    end: "2026-02-28",
  });
  assert.deepEqual(parsePeriod("month", "2024-02"), {
    kind: "month",
    start: "2024-02-01",
    end: "2024-02-29",
  });
  assert.deepEqual(parsePeriod("year", "2026"), {
    kind: "year",
    start: "2026-01-01",
    end: "2026-12-31",
  });
  assert.equal(parsePeriod("month", "2026"), null);
  assert.equal(parsePeriod("month", "2026-13"), null);
  assert.equal(parsePeriod(null, ""), null);
});

test("the date parameter is optional but must be ISO when present", () => {
  assert.equal(parseDailyDate(null), null);
  assert.equal(parseDailyDate(""), null);
  assert.equal(parseDailyDate(" 2026-08-10 "), "2026-08-10");
  assert.equal(parseDailyDate("2026-13-40"), false);
  assert.equal(parseDailyDate("yesterday"), false);
});

test("an unknown timezone still yields a usable date", () => {
  const now = new Date("2026-08-10T22:30:00Z");
  assert.equal(localDate("Pacific/Auckland", now), "2026-08-11");
  assert.equal(localDate("Europe/Berlin", now), "2026-08-11");
  assert.equal(localDate("Not/AZone", now), "2026-08-10");
});
