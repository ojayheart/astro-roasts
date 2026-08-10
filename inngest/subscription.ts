/**
 * The three scheduled subscription jobs.
 *
 * Hourly: fan out to every subscriber whose handset clock has just reached
 * their notify hour. Monthly and yearly: one Batch API submission per cohort,
 * polled until it ends, then written to `forecasts`.
 */

import * as Sentry from "@sentry/nextjs";
import { inngest } from "./client";
import { birthInputFor } from "@/lib/birth-input";
import { dailyCohort } from "@/lib/daily-schedule";
import { isSubscribed } from "@/lib/entitlement";
import {
  applyForecastResults,
  buildForecastJobs,
  monthPeriod,
  yearPeriod,
  type BatchPorts,
} from "@/lib/forecast-jobs";
import { batchStatus } from "@/lib/roast-model";
import type { Period } from "@/lib/subscription-api";
import {
  collectForecastBatch,
  generateDaily,
  submitForecastBatch,
} from "@/lib/subscription-roast";
import {
  activeSubscribers,
  findDaily,
  notifyDevices,
  saveDaily,
  saveForecast,
  subjectFor,
} from "@/lib/subscription-store";
import { monthTransits, yearTransits } from "@/lib/transits";

/** Batches finish inside a day; 24 × 10 minutes is the ceiling, not the wait. */
const BATCH_POLLS = 24;

export const fanOutDailyRoasts = inngest.createFunction(
  {
    id: "daily-roast-fan-out",
    retries: 2,
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const cohort = await step.run("select-cohort", () =>
      dailyCohort({ devices: notifyDevices, subscribed: isSubscribed }),
    );

    if (!cohort.length) return { queued: 0 };

    await step.sendEvent(
      "queue-daily-roasts",
      cohort.map((entry) => ({
        name: "daily/generate",
        data: { userId: entry.userId, date: entry.date },
      })),
    );

    return { queued: cohort.length };
  },
);

export const generateDailyRoast = inngest.createFunction(
  {
    id: "generate-daily-roast",
    retries: 2,
    triggers: [{ event: "daily/generate" }],
    onFailure: async ({ event, error }) => {
      const data = (
        event.data as { event?: { data?: { userId?: string; date?: string } } }
      )?.event?.data;

      Sentry.withScope((scope) => {
        scope.setTag("subsystem", "inngest");
        scope.setTag("inngest.event", "daily/generate");
        scope.setContext("daily", { userId: data?.userId, date: data?.date });
        Sentry.captureException(error);
      });
    },
  },
  async ({ event, step }) => {
    const { userId, date } = event.data as { userId: string; date: string };

    return await step.run("generate-daily-roast", async () => {
      // Re-checked here, not just at fan-out: the cron can fire twice and the
      // subscription can lapse between the selection and this run.
      if (!(await isSubscribed(userId))) {
        return { userId, skipped: "not_subscribed" };
      }

      const existing = await findDaily(userId, date);
      if (existing?.status === "ready") return { userId, skipped: "cached" };

      const subject = await subjectFor(userId);
      const birth = subject ? await birthInputFor(subject) : null;
      if (!birth) return { userId, skipped: "no_birth" };

      const made = await generateDaily({ birth }, date);
      if (!made) return { userId, skipped: "no_transits" };

      await saveDaily(userId, date, made.roast, made.transits);
      return { userId, date, status: "ready" };
    });
  },
);

const ports: BatchPorts = {
  subscribers: activeSubscribers,
  transits: async (subject, period) => {
    const birth = await birthInputFor(subject);
    if (!birth) return null;
    const [year, month] = period.start.split("-").map(Number);
    return period.kind === "month"
      ? monthTransits(birth, year, month)
      : yearTransits(birth, period.start);
  },
};

function forecastBatchJob(
  id: string,
  cron: string,
  periodFor: (now: Date) => Period,
) {
  return inngest.createFunction(
    {
      id,
      retries: 1,
      triggers: [{ cron }],
      onFailure: async ({ error }) => {
        Sentry.withScope((scope) => {
          scope.setTag("subsystem", "inngest");
          scope.setTag("inngest.cron", id);
          Sentry.captureException(error);
        });
      },
    },
    async ({ step }) => {
      const period = periodFor(new Date());

      const jobs = await step.run("build-jobs", () =>
        buildForecastJobs(ports, period),
      );
      if (!jobs.length) return { period, written: 0, failed: 0 };

      const { batchId } = await step.run("submit-batch", () =>
        submitForecastBatch(jobs),
      );

      let status = "in_progress";
      for (let poll = 0; poll < BATCH_POLLS && status !== "ended"; poll += 1) {
        await step.sleep(`await-batch-${poll}`, "10m");
        status = await step.run(`batch-status-${poll}`, () =>
          batchStatus(batchId),
        );
      }
      if (status !== "ended") {
        throw new Error(`batch ${batchId} still ${status}`);
      }

      const results = await step.run("collect-batch", () =>
        collectForecastBatch(batchId),
      );
      const applied = await step.run("save-forecasts", () =>
        applyForecastResults(results, period, saveForecast),
      );

      return { period, batchId, ...applied };
    },
  );
}

export const generateMonthlyForecasts = forecastBatchJob(
  "monthly-forecasts",
  "0 2 1 * *",
  monthPeriod,
);

export const generateYearlyForecasts = forecastBatchJob(
  "yearly-forecasts",
  "0 3 1 1 *",
  yearPeriod,
);
