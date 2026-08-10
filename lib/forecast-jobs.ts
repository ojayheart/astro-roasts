/**
 * Cohort and result handling for the monthly and yearly forecast batches.
 * Both windows go through the Batch API in lib/roast-model.ts — 50% off and
 * neither is latency-bound. Kept free of the db client for the tests.
 */

import { parsePeriod, type Period, type Subject } from "./subscription-api.ts";
import type { Forecast, ForecastJob } from "./subscription-roast.ts";
import type { CalendarTransits } from "./transits.ts";

export type CohortUser = { userId: string; subject: Subject };

export type BatchPorts = {
  subscribers: () => Promise<CohortUser[]>;
  /** Ids that already hold a ready or generating forecast for this period. */
  served: (period: Period) => Promise<string[]>;
  transits: (
    subject: Subject,
    period: Period,
  ) => Promise<CalendarTransits | null>;
};

export type BatchOutcome = { customId: string; forecast?: Forecast };

function windowFor(kind: "month" | "year", raw: string): Period {
  const period = parsePeriod(kind, raw);
  if (!period) throw new Error(`invalid ${kind} window ${raw}`);
  return period;
}

/** The month the cron fired in — the job runs at 02:00 UTC on the 1st. */
export function monthPeriod(now: Date): Period {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return windowFor("month", `${now.getUTCFullYear()}-${month}`);
}

export function yearPeriod(now: Date): Period {
  return windowFor("year", String(now.getUTCFullYear()));
}

/** custom_id is the user id, so results key back without list order. */
export async function buildForecastJobs(
  ports: BatchPorts,
  period: Period,
): Promise<ForecastJob[]> {
  const jobs: ForecastJob[] = [];
  // Read before a single transit is computed and long before submit-batch:
  // a replayed cron must not pay the model again for a served cohort.
  const served = new Set(await ports.served(period));
  for (const { userId, subject } of await ports.subscribers()) {
    if (served.has(userId)) continue;
    const transits = await ports.transits(subject, period);
    if (transits) jobs.push({ customId: userId, transits });
  }
  return jobs;
}

export async function applyForecastResults(
  results: BatchOutcome[],
  period: Period,
  save: (
    userId: string,
    period: Period,
    forecast: Forecast,
  ) => Promise<unknown>,
): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.forecast?.body.trim()) {
      failed += 1;
      continue;
    }
    await save(result.customId, period, result.forecast);
    written += 1;
  }

  return { written, failed };
}
