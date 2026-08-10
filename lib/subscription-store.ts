/**
 * The db half of the subscription surface. The routes and the scheduled jobs
 * share it so a daily written by the cron and one written by /api/daily are
 * the same row, upserted on the same unique key.
 */

import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyRoasts,
  devices,
  forecasts,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { SUBSCRIBED_STATUSES } from "@/lib/entitlement-rule";
import type { DeviceRow } from "@/lib/daily-schedule";
import type { CohortUser } from "@/lib/forecast-jobs";
import type {
  DailyRow,
  ForecastRow,
  Period,
  Subject,
} from "@/lib/subscription-api";
import type { DailyRoast, Forecast } from "@/lib/subscription-roast";
import type { DailyTransits } from "@/lib/transits";

const DAILY_COLUMNS = {
  forDate: dailyRoasts.forDate,
  title: dailyRoasts.title,
  goldLine: dailyRoasts.goldLine,
  body: dailyRoasts.body,
  status: dailyRoasts.status,
};

const FORECAST_COLUMNS = {
  kind: forecasts.kind,
  periodStart: forecasts.periodStart,
  periodEnd: forecasts.periodEnd,
  title: forecasts.title,
  body: forecasts.body,
  highlights: forecasts.highlights,
  avoid: forecasts.avoid,
  status: forecasts.status,
};

export async function subjectFor(userId: string): Promise<Subject | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      name: true,
      dob: true,
      birthTime: true,
      birthCity: true,
      tz: true,
    },
  });
  return row ?? null;
}

export async function findDaily(
  userId: string,
  date: string,
): Promise<DailyRow | null> {
  const [row] = await db
    .select(DAILY_COLUMNS)
    .from(dailyRoasts)
    .where(and(eq(dailyRoasts.userId, userId), eq(dailyRoasts.forDate, date)))
    .limit(1);
  return row ?? null;
}

export async function saveDaily(
  userId: string,
  date: string,
  roast: DailyRoast,
  transits: DailyTransits,
): Promise<DailyRow> {
  const values = {
    title: roast.title,
    goldLine: roast.goldLine,
    body: roast.body,
    transits,
    status: "ready",
  };
  const [row] = await db
    .insert(dailyRoasts)
    .values({ userId, forDate: date, ...values })
    .onConflictDoUpdate({
      target: [dailyRoasts.userId, dailyRoasts.forDate],
      set: values,
    })
    .returning(DAILY_COLUMNS);
  return row;
}

export async function findForecast(
  userId: string,
  period: Period,
): Promise<ForecastRow | null> {
  const [row] = await db
    .select(FORECAST_COLUMNS)
    .from(forecasts)
    .where(
      and(
        eq(forecasts.userId, userId),
        eq(forecasts.kind, period.kind),
        eq(forecasts.periodStart, period.start),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function saveForecast(
  userId: string,
  period: Period,
  forecast: Forecast,
): Promise<ForecastRow> {
  const values = {
    periodEnd: period.end,
    title: forecast.title,
    body: forecast.body,
    highlights: forecast.highlights,
    avoid: forecast.avoid,
    status: "ready",
  };
  const [row] = await db
    .insert(forecasts)
    .values({ userId, kind: period.kind, periodStart: period.start, ...values })
    .onConflictDoUpdate({
      target: [forecasts.userId, forecasts.kind, forecasts.periodStart],
      set: values,
    })
    .returning(FORECAST_COLUMNS);
  return row;
}

/** Every registered handset — the local hour is arithmetic, not a query. */
export async function notifyDevices(): Promise<DeviceRow[]> {
  return db
    .select({
      userId: devices.userId,
      tz: devices.tz,
      notifyHour: devices.notifyHour,
    })
    .from(devices);
}

export async function activeSubscribers(
  now: Date = new Date(),
): Promise<CohortUser[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      dob: users.dob,
      birthTime: users.birthTime,
      birthCity: users.birthCity,
      tz: users.tz,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        inArray(subscriptions.status, [...SUBSCRIBED_STATUSES]),
        gt(subscriptions.expiresAt, now),
      ),
    );

  const seen = new Set<string>();
  const cohort: CohortUser[] = [];
  for (const { userId, ...subject } of rows) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    cohort.push({ userId, subject });
  }
  return cohort;
}
