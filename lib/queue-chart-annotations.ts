import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { roasts } from "./db/schema";
import { inngest } from "@/inngest/client";

/**
 * Queue the witty natal-wheel lines if and only if:
 * - The roast exists and has a cached chart.
 * - paid is true (the lines echo the full roast, so unpaid stays facts-only).
 * - fullText is non-empty (the lines are written in the roast's voice).
 * - chartAnnotations is still null (already generated → nothing to do).
 *
 * Called from BOTH the inngest pipeline (when generation completes) and every
 * path that flips paid. Either order is valid; whichever fires last wins, and
 * the Inngest function re-checks all of it before spending a model call.
 *
 * Never throws — the wheel degrades to facts-only, which is not worth failing
 * a payment or an unlock over. Returns true if an event was sent.
 */
export async function queueChartAnnotationsIfReady(
  roastId: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        paid: roasts.paid,
        fullText: roasts.fullText,
        chartJson: roasts.chartJson,
        chartAnnotations: roasts.chartAnnotations,
      })
      .from(roasts)
      .where(eq(roasts.id, roastId))
      .limit(1);

    if (!row) return false;
    if (!row.paid) return false;
    if (!row.fullText) return false;
    if (!row.chartJson) return false;
    if (row.chartAnnotations) return false;

    await inngest.send({ name: "roast/annotate", data: { roastId } });
    return true;
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("subsystem", "chart-annotations");
      scope.setContext("chart_annotations", { roastId });
      Sentry.captureException(err);
    });
    return false;
  }
}
