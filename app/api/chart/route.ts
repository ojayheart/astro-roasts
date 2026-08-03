import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { computeChart, type ChartSubject } from "@/lib/compute-chart";
import type { ChartResponse, NatalChart } from "@/lib/types";

export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fast chart call for the loading screen and the roast page's wheel. Resolves
 * each subject's birth data to coordinates and asks the runner to compute the
 * chart deterministically (natal_chart.py --json, no LLM, ~1s each).
 *
 * Solo roasts cache one chart on roasts.chart_json. Group roasts additionally
 * cache every subject's chart on roasts.subject_charts, which is what the
 * synastry bi-wheel reads — before this, person 2's chart was never computed at
 * all and only their sun/moon/rising survived in extra_placements.
 *
 * Every failure path returns 200 {chart:null} — callers fall back to the
 * chart-less layout and the roast pipeline is never affected.
 */
export async function POST(req: NextRequest) {
  const nullResponse = NextResponse.json({ chart: null } as ChartResponse);

  try {
    const body = (await req.json().catch(() => ({}))) as { roastId?: unknown };
    const roastId = typeof body.roastId === "string" ? body.roastId : "";
    if (!UUID_RE.test(roastId)) return nullResponse;

    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, roastId),
      with: { user: true, subjects: { with: { user: true } } },
    });
    if (!roast || !roast.user) return nullResponse;

    // Subjects in position order. Solo roasts have no rows here, so fall back
    // to the owner — every roast has at least one chart to cast.
    const people: ChartSubject[] = roast.subjects?.length
      ? [...roast.subjects]
          .sort((a, b) => a.position - b.position)
          .map((s) => s.user)
      : [roast.user];
    const isGroup = people.length > 1;

    const cachedSubjectCharts = roast.subjectCharts as NatalChart[] | null;
    const subjectCacheComplete =
      Array.isArray(cachedSubjectCharts) &&
      cachedSubjectCharts.length === people.length;

    // Fully cached — nothing to compute.
    if (roast.chartJson && (!isGroup || subjectCacheComplete)) {
      return NextResponse.json({
        chart: roast.chartJson as NatalChart,
        charts: isGroup ? cachedSubjectCharts! : undefined,
      } as ChartResponse);
    }

    // Person 1 may already be cached from an earlier call even when the rest
    // aren't; don't pay for it twice.
    const cachedFirst = roast.chartJson as NatalChart | null;
    const charts = await Promise.all(
      people.map((person, i) =>
        i === 0 && cachedFirst
          ? Promise.resolve(cachedFirst)
          : computeChart(person),
      ),
    );

    const first = charts[0];
    if (!first) return nullResponse;

    // Persist whatever resolved. A group whose second chart failed still gets
    // its first cached, and the next call retries only the missing one.
    const allResolved = charts.every((c): c is NatalChart => c !== null);
    await db
      .update(roasts)
      .set({
        chartJson: first,
        ...(isGroup && allResolved ? { subjectCharts: charts } : {}),
      })
      .where(eq(roasts.id, roastId));

    if (isGroup && !allResolved) {
      Sentry.withScope((scope) => {
        scope.setTag("route", "/api/chart");
        scope.setTag("subsystem", "synastry");
        scope.setContext("chart", {
          roastId,
          people: people.length,
          resolved: charts.filter(Boolean).length,
        });
        Sentry.captureMessage("Group roast missing a subject chart", "warning");
      });
    }

    return NextResponse.json({
      chart: first,
      charts: isGroup && allResolved ? (charts as NatalChart[]) : undefined,
    } as ChartResponse);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/chart");
      Sentry.captureException(error);
    });
    return nullResponse;
  }
}
