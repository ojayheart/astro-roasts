/**
 * Query parsing, gating and cache-or-generate flow for /api/daily and
 * /api/forecast, kept free of the db client so the tests can exercise every
 * branch without Neon.
 */

import type { ChartSubject } from "./compute-chart.ts";
import type { DailyRoast, Forecast } from "./subscription-roast.ts";
import type { CalendarTransits, DailyTransits } from "./transits.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^(\d{4})$/;

export type Reply = { status: number; body: Record<string, unknown> };

export type Subject = ChartSubject & { tz: string };

export type DailyRow = {
  forDate: string;
  title: string | null;
  goldLine: string | null;
  body: string | null;
  status: string;
};

export type ForecastRow = {
  kind: string;
  periodStart: string;
  periodEnd: string;
  title: string | null;
  body: string | null;
  highlights: unknown;
  avoid: unknown;
  status: string;
};

/** The calendar date it is right now where the user lives. */
export function localDate(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function parseDailyDate(raw: string | null): string | null | false {
  if (raw === null || raw === "") return null;
  const date = raw.trim();
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return false;
  return date;
}

export type Period = { kind: "month" | "year"; start: string; end: string };

function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `?kind=month|year&period=YYYY-MM`; a year may also be given as `YYYY`. */
export function parsePeriod(
  kind: string | null,
  period: string | null,
): Period | null {
  const k = (kind ?? "month").trim();
  if (k !== "month" && k !== "year") return null;

  const raw = (period ?? "").trim();
  const month = MONTH_RE.exec(raw);
  const yearOnly = k === "year" ? YEAR_RE.exec(raw) : null;
  if (!month && !yearOnly) return null;

  const year = Number(month ? month[1] : yearOnly![1]);
  const start = month ? Number(month[2]) : 1;

  if (k === "month") {
    return {
      kind: "month",
      start: iso(year, start, 1),
      end: iso(year, start, lastDay(year, start)),
    };
  }
  const endYear = start === 1 ? year : year + 1;
  const endMonth = start === 1 ? 12 : start - 1;
  return {
    kind: "year",
    start: iso(year, start, 1),
    end: iso(endYear, endMonth, lastDay(endYear, endMonth)),
  };
}

function dailyBody(row: DailyRow) {
  return {
    daily: {
      forDate: row.forDate,
      title: row.title,
      goldLine: row.goldLine,
      body: row.body,
      status: row.status,
    },
  };
}

function forecastBody(row: ForecastRow) {
  return {
    forecast: {
      kind: row.kind,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      title: row.title,
      body: row.body,
      highlights: Array.isArray(row.highlights) ? row.highlights : [],
      avoid: Array.isArray(row.avoid) ? row.avoid : [],
      status: row.status,
    },
  };
}

export type Auth = {
  userId: () => Promise<string | null>;
  subscribed: (userId: string) => Promise<boolean>;
};

type Gate = Auth & {
  subject: (userId: string) => Promise<Subject | null>;
};

export type DailyPorts = Gate & {
  find: (userId: string, date: string) => Promise<DailyRow | null>;
  generate: (
    subject: Subject,
    date: string,
  ) => Promise<{ roast: DailyRoast; transits: DailyTransits } | null>;
  save: (
    userId: string,
    date: string,
    roast: DailyRoast,
    transits: DailyTransits,
  ) => Promise<DailyRow>;
};

export type ForecastPorts = Gate & {
  find: (userId: string, period: Period) => Promise<ForecastRow | null>;
  generate: (
    subject: Subject,
    period: Period,
  ) => Promise<{ forecast: Forecast; transits: CalendarTransits } | null>;
  save: (
    userId: string,
    period: Period,
    forecast: Forecast,
  ) => Promise<ForecastRow>;
};

export async function pass(ports: Auth): Promise<Reply | { userId: string }> {
  const userId = await ports.userId();
  if (!userId) return { status: 401, body: { error: "unauthorized" } };
  if (!(await ports.subscribed(userId))) {
    return { status: 402, body: { error: "subscription_required" } };
  }
  return { userId };
}

export async function serveDaily(
  ports: DailyPorts,
  params: URLSearchParams,
): Promise<Reply> {
  const gate = await pass(ports);
  if (!("userId" in gate)) return gate;

  const requested = parseDailyDate(params.get("date"));
  if (requested === false) {
    return { status: 400, body: { error: "invalid_date" } };
  }

  const subject = await ports.subject(gate.userId);
  if (!subject) return { status: 404, body: { error: "not_found" } };

  const date = requested ?? localDate(subject.tz);
  const cached = await ports.find(gate.userId, date);
  if (cached) return { status: 200, body: dailyBody(cached) };

  const made = await ports.generate(subject, date);
  if (!made) return { status: 503, body: { error: "unavailable" } };

  const row = await ports.save(gate.userId, date, made.roast, made.transits);
  return { status: 200, body: dailyBody(row) };
}

export async function serveForecast(
  ports: ForecastPorts,
  params: URLSearchParams,
): Promise<Reply> {
  const gate = await pass(ports);
  if (!("userId" in gate)) return gate;

  const subject = await ports.subject(gate.userId);
  if (!subject) return { status: 404, body: { error: "not_found" } };

  const kind = params.get("kind");
  const period =
    parsePeriod(kind, params.get("period")) ??
    parsePeriod(kind, localDate(subject.tz).slice(0, 7));
  if (!period) return { status: 400, body: { error: "invalid_period" } };

  const cached = await ports.find(gate.userId, period);
  if (cached) return { status: 200, body: forecastBody(cached) };

  const made = await ports.generate(subject, period);
  if (!made) return { status: 503, body: { error: "unavailable" } };

  const row = await ports.save(gate.userId, period, made.forecast);
  return { status: 200, body: forecastBody(row) };
}
