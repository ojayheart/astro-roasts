import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { generateChartAnnotations } from "@/lib/chart-annotations";
import type { NatalChart } from "@/lib/types";

/**
 * Write the witty per-element lines for the interactive natal wheel.
 *
 * This runs out of band because the runner needs ~100s for a full 59-element
 * chart — it never fit in the /api/chart-annotations request, which is why the
 * synchronous version timed out on every paid roast from 14 Jul onward. The
 * route now only reads the cache, so the wheel shows deterministic facts until
 * this lands and then upgrades on the next load.
 *
 * Triggered by queueChartAnnotationsIfReady() from every path that can make a
 * roast both paid and ready.
 */
export const generateAnnotations = inngest.createFunction(
  {
    id: "generate-chart-annotations",
    retries: 2,
    triggers: [{ event: "roast/annotate" }],
    onFailure: async ({ event, error }) => {
      const roastId = (
        event.data as { event?: { data?: { roastId?: string } } }
      )?.event?.data?.roastId;

      Sentry.withScope((scope) => {
        scope.setTag("subsystem", "chart-annotations");
        scope.setTag("inngest.event", "roast/annotate");
        scope.setContext("roast", { roastId });
        Sentry.captureException(error);
      });
    },
  },
  async ({ event, step }) => {
    const { roastId } = event.data;

    return await step.run("generate-chart-annotations", async () => {
      const roast = await db.query.roasts.findFirst({
        where: eq(roasts.id, roastId),
        columns: {
          chartJson: true,
          chartAnnotations: true,
          fullText: true,
          paid: true,
        },
      });

      // Every gate is re-checked here, not just at queue time — the event may
      // have been sent twice (payment and generation both fire it) and the
      // first run may already have filled the cache.
      if (!roast?.chartJson) return { roastId, skipped: "no_chart" };
      if (!roast.paid) return { roastId, skipped: "unpaid" };
      if (!roast.fullText) return { roastId, skipped: "no_text" };
      if (roast.chartAnnotations) return { roastId, skipped: "cached" };

      const annotations = await generateChartAnnotations(
        roast.chartJson as NatalChart,
        roast.fullText,
      );

      await db
        .update(roasts)
        .set({ chartAnnotations: annotations })
        .where(eq(roasts.id, roastId));

      const written = Object.values(annotations).filter((a) => a.line).length;
      return { roastId, elements: Object.keys(annotations).length, written };
    });
  },
);
