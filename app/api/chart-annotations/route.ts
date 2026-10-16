import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import type { NatalChart } from "@/lib/types";
import {
  enumerateElements,
  annotationsMatchDuo,
  type ChartAnnotations,
} from "@/lib/chart-annotations";
import { queueChartAnnotationsIfReady } from "@/lib/queue-chart-annotations";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-element copy for the interactive natal wheel.
 *
 * - `facts` (deterministic) is always returned, computed from the cached chart.
 * - `line` (witty, roast-tied) is written out of band by the roast/annotate
 *   Inngest function and cached on roasts.chart_annotations — only for PAID
 *   roasts, since the lines echo the full roast text.
 *
 * This route never calls a model. Generating all ~59 lines takes ~100s, which
 * never fit in the request and timed out on every paid roast from 14 Jul 2026
 * until this was made async. If the cache is cold, the wheel gets facts and
 * this queues the job, so the next load has the lines.
 */
export async function POST(req: NextRequest) {
  const factsOnly = (chart: NatalChart): ChartAnnotations => {
    const map: ChartAnnotations = {};
    for (const e of enumerateElements(chart))
      map[e.id] = { facts: e.facts, line: "" };
    return map;
  };

  try {
    const body = (await req.json().catch(() => ({}))) as { roastId?: unknown };
    const roastId = typeof body.roastId === "string" ? body.roastId : "";
    if (!UUID_RE.test(roastId)) {
      return NextResponse.json({ annotations: null });
    }

    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, roastId),
      columns: {
        chartJson: true,
        subjectCharts: true,
        chartAnnotations: true,
        fullText: true,
        paid: true,
      },
    });
    if (!roast?.chartJson) {
      return NextResponse.json({ annotations: null });
    }
    const chart = roast.chartJson as NatalChart;

    // Cache hit — the witty version is already generated. A duo roast holding
    // solo-keyed annotations is the exception: those match nothing the bi-wheel
    // draws, so serving them would leave every tap blank forever.
    const cached = roast.chartAnnotations as ChartAnnotations | null;
    const isDuo = (roast.subjectCharts as unknown[] | null)?.length === 2;
    if (cached && (!isDuo || annotationsMatchDuo(cached))) {
      return NextResponse.json({ annotations: cached });
    }

    // Cache cold. Facts keep the wheel interactive now; queueing self-heals a
    // roast whose paid/ready transition missed its trigger. No-op when unpaid.
    await queueChartAnnotationsIfReady(roastId);
    return NextResponse.json({ annotations: factsOnly(chart) });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/chart-annotations");
      Sentry.captureException(err);
    });
    return NextResponse.json({ annotations: null });
  }
}
