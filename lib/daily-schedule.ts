/**
 * Cohort selection for the hourly daily fan-out. The notify hour is the
 * handset's — devices.tz, not users.tz — so the push follows the traveller.
 * Kept free of the db client so the tests can exercise the arithmetic without
 * Neon.
 */

import { alreadyServed, localDate } from "./subscription-api.ts";
import type { DailyRoast } from "./subscription-roast.ts";
import type { BirthInput, DailyTransits } from "./transits.ts";

export type DeviceRow = { userId: string; tz: string; notifyHour: number };

export type CohortEntry = { userId: string; tz: string; date: string };

export type FanOutPorts = {
  devices: () => Promise<DeviceRow[]>;
  subscribed: (userId: string) => Promise<boolean>;
};

/** 0-23 where the handset is, or null if the tz is not one Intl knows. */
export function localHour(tz: string, now: Date): number | null {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now);
    const parsed = Number(hour);
    return Number.isInteger(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** One entry per user — a second handset on the same hour is not a second push. */
export function dueDevices(devices: DeviceRow[], now: Date): CohortEntry[] {
  const seen = new Set<string>();
  const due: CohortEntry[] = [];

  for (const device of devices) {
    if (seen.has(device.userId)) continue;
    if (localHour(device.tz, now) !== device.notifyHour) continue;
    seen.add(device.userId);
    due.push({
      userId: device.userId,
      tz: device.tz,
      date: localDate(device.tz, now),
    });
  }

  return due;
}

export async function dailyCohort(
  ports: FanOutPorts,
  now: Date = new Date(),
): Promise<CohortEntry[]> {
  const cohort: CohortEntry[] = [];
  for (const entry of dueDevices(await ports.devices(), now)) {
    if (await ports.subscribed(entry.userId)) cohort.push(entry);
  }
  return cohort;
}

export type DailyJobPorts = {
  subscribed: (userId: string) => Promise<boolean>;
  find: (userId: string, date: string) => Promise<{ status: string } | null>;
  birth: (userId: string) => Promise<BirthInput | null>;
  generate: (
    birth: BirthInput,
    date: string,
  ) => Promise<{ roast: DailyRoast; transits: DailyTransits } | null>;
  save: (
    userId: string,
    date: string,
    roast: DailyRoast,
    transits: DailyTransits,
  ) => Promise<unknown>;
};

export type DailyJobResult =
  | {
      userId: string;
      skipped: "not_subscribed" | "cached" | "no_birth" | "no_transits";
    }
  | { userId: string; date: string; status: "ready" };

/**
 * One user's daily roast. Every skip is checked before generate() — the cron
 * can fire twice and the fan-out can queue the same day twice, and a roast that
 * is ready or still generating has already been paid for.
 */
export async function runDailyJob(
  ports: DailyJobPorts,
  userId: string,
  date: string,
): Promise<DailyJobResult> {
  // Re-checked here, not just at fan-out: the subscription can lapse between
  // the selection and this run.
  if (!(await ports.subscribed(userId))) {
    return { userId, skipped: "not_subscribed" };
  }

  const existing = await ports.find(userId, date);
  if (alreadyServed(existing?.status)) return { userId, skipped: "cached" };

  const birth = await ports.birth(userId);
  if (!birth) return { userId, skipped: "no_birth" };

  const made = await ports.generate(birth, date);
  if (!made) return { userId, skipped: "no_transits" };

  await ports.save(userId, date, made.roast, made.transits);
  return { userId, date, status: "ready" };
}
