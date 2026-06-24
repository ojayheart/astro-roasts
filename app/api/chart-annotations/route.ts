import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import type { NatalChart } from "@/lib/types";
import {
  enumerateElements,
  generateChartAnnotations,
  type ChartAnnotations,
} from "@/lib/chart-annotations";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-element copy for the interactive natal wheel.
 *
 * - `facts` (deterministic) is always returned, computed from the cached chart.
 * - `line` (witty, roast-tied) is generated once via one Opus call and cached
 *   on roasts.chart_annotations — only for PAID roasts, since the lines echo the
 *   full roast text. Unpaid roasts get facts-only (no model call, no leak).
 *
 * Every failure path still returns facts-only so the wheel stays interactive.
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
        chartAnnotations: true,
        fullText: true,
        paid: true,
      },
    });
    if (!roast?.chartJson) {
      return NextResponse.json({ annotations: null });
    }
    const chart = roast.chartJson as NatalChart;

    // Cache hit — the witty version is already generated.
    if (roast.chartAnnotations) {
      return NextResponse.json({
        annotations: roast.chartAnnotations as ChartAnnotations,
      });
    }

    // Unpaid, or no roast text yet → facts only, no model call.
    if (!roast.paid || !roast.fullText) {
      return NextResponse.json({ annotations: factsOnly(chart) });
    }

    // Generate the witty lines once and cache them.
    try {
      const annotations = await generateChartAnnotations(chart, roast.fullText);
      await db
        .update(roasts)
        .set({ chartAnnotations: annotations })
        .where(eq(roasts.id, roastId));
      return NextResponse.json({ annotations });
    } catch (genErr) {
      Sentry.withScope((scope) => {
        scope.setTag("route", "/api/chart-annotations");
        scope.setTag("subsystem", "chart-annotations");
        scope.setContext("chart_annotations", { roastId });
        Sentry.captureException(genErr);
      });
      // Non-fatal — return facts so the wheel is still interactive.
      return NextResponse.json({ annotations: factsOnly(chart) });
    }
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/chart-annotations");
      Sentry.captureException(err);
    });
    return NextResponse.json({ annotations: null });
  }
}
