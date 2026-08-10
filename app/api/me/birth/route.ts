import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, roastSubjects, users } from "@/lib/db/schema";
import { resolveBirthLocation } from "@/lib/location";
import { sessionUserId } from "@/lib/session";
import { parseBirthInput } from "@/lib/me";
import { computeChart } from "@/lib/compute-chart";
import { queueChartAnnotationsIfReady } from "@/lib/queue-chart-annotations";
import {
  birthDetailsChanged,
  refreshChartsAfterBirthChange,
  type CachedRoast,
  type RefreshPorts,
  type SubjectRow,
} from "@/lib/birth-refresh";
import type { NatalChart } from "@/lib/types";

export const runtime = "nodejs";

// The recompute adds one runner round-trip (~1s, 20s timeout) to the request.
export const maxDuration = 60;

/** Reads and writes the chart caches; see lib/birth-refresh.ts for the rules. */
function refreshPorts(): RefreshPorts {
  return {
    cachedCharts: async (userId) => {
      const mine = await db
        .select({ roastId: roastSubjects.roastId })
        .from(roastSubjects)
        .where(eq(roastSubjects.userId, userId));
      const subjectRoastIds = mine.map((r) => r.roastId);

      const rows = await db
        .select({
          id: roasts.id,
          userId: roasts.userId,
          chartJson: roasts.chartJson,
          subjectCharts: roasts.subjectCharts,
          chartAnnotations: roasts.chartAnnotations,
        })
        .from(roasts)
        .where(
          subjectRoastIds.length
            ? or(eq(roasts.userId, userId), inArray(roasts.id, subjectRoastIds))
            : eq(roasts.userId, userId),
        );

      const ids = rows.map((r) => r.id);
      const subjects: SubjectRow[] = ids.length
        ? await db
            .select({
              roastId: roastSubjects.roastId,
              userId: roastSubjects.userId,
              position: roastSubjects.position,
            })
            .from(roastSubjects)
            .where(inArray(roastSubjects.roastId, ids))
        : [];

      return {
        roasts: rows.map((r) => ({
          ...r,
          chartJson: r.chartJson as NatalChart | null,
          subjectCharts: r.subjectCharts as NatalChart[] | null,
        })) satisfies CachedRoast[],
        subjects,
      };
    },
    cast: (subject) => computeChart(subject),
    applyRefresh: async (plan) => {
      await db
        .update(roasts)
        .set({
          ...(plan.chartJson ? { chartJson: plan.chartJson } : {}),
          ...(plan.subjectCharts ? { subjectCharts: plan.subjectCharts } : {}),
          ...(plan.clearAnnotations ? { chartAnnotations: null } : {}),
        })
        .where(eq(roasts.id, plan.roastId));
    },
    queueAnnotations: queueChartAnnotationsIfReady,
  };
}

/**
 * Set or correct birth details. The city resolves to lat/lon/tz through the
 * same table the web flow uses, so an unknown city stores 0/0/UTC rather than
 * failing the correction.
 *
 * A correction that actually moves the chart recasts it and rewrites every
 * cached copy in place, then drops the wheel copy written against the old one
 * so the existing annotation queue rebuilds it. A failed recast changes no
 * chart at all rather than blanking a paid roast's wheel.
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = await sessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const input = parseBirthInput(await req.json().catch(() => ({})));
    if (!input) {
      return NextResponse.json({ error: "invalid_birth" }, { status: 400 });
    }

    const [before] = await db
      .select({
        dob: users.dob,
        birthTime: users.birthTime,
        birthCity: users.birthCity,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const place = resolveBirthLocation(input.birthCity);
    const [row] = await db
      .update(users)
      .set({
        dob: input.dob,
        birthTime: input.birthTime,
        birthCity: place.city,
        lat: place.lat,
        lon: place.lon,
        tz: place.tz,
      })
      .where(eq(users.id, userId))
      .returning({
        name: users.name,
        dob: users.dob,
        birthTime: users.birthTime,
        birthCity: users.birthCity,
        tz: users.tz,
      });

    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { name, ...birth } = row;

    if (birthDetailsChanged(before, birth)) {
      // Never fails the correction — the details are already saved, and a
      // stale wheel is not worth a 500.
      try {
        await refreshChartsAfterBirthChange(
          userId,
          { name, ...birth },
          refreshPorts(),
        );
      } catch (err) {
        Sentry.withScope((scope) => {
          scope.setTag("route", "/api/me/birth");
          scope.setTag("subsystem", "chart-refresh");
          scope.setContext("chart_refresh", { userId });
          Sentry.captureException(err);
        });
      }
    }

    return NextResponse.json({ birth });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/me/birth");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
