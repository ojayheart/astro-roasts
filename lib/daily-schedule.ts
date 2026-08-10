/**
 * Cohort selection for the hourly daily fan-out. The notify hour is the
 * handset's — devices.tz, not users.tz — so the push follows the traveller.
 * Kept free of the db client so the tests can exercise the arithmetic without
 * Neon.
 */

import { localDate } from "./subscription-api.ts";

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
