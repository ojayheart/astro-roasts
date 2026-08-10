import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { forecasts, users } from "@/lib/db/schema";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { birthInputFor } from "@/lib/birth-input";
import { generateForecast } from "@/lib/subscription-roast";
import { serveForecast, type ForecastPorts } from "@/lib/subscription-api";

export const runtime = "nodejs";

const COLUMNS = {
  kind: forecasts.kind,
  periodStart: forecasts.periodStart,
  periodEnd: forecasts.periodEnd,
  title: forecasts.title,
  body: forecasts.body,
  highlights: forecasts.highlights,
  avoid: forecasts.avoid,
  status: forecasts.status,
};

/** `?kind=month|year&period=YYYY-MM`. Subscribers only. */
export async function GET(req: NextRequest) {
  const ports: ForecastPorts = {
    userId: () => sessionUserId(req),
    subscribed: isSubscribed,

    subject: async (userId) => {
      const row = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          name: true,
          dob: true,
          birthTime: true,
          birthCity: true,
          tz: true,
        },
      });
      return row ?? null;
    },

    find: async (userId, period) => {
      const [row] = await db
        .select(COLUMNS)
        .from(forecasts)
        .where(
          and(
            eq(forecasts.userId, userId),
            eq(forecasts.kind, period.kind),
            eq(forecasts.periodStart, period.start),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    generate: async (subject, period) => {
      const birth = await birthInputFor(subject);
      if (!birth) return null;
      const [year, month] = period.start.split("-").map(Number);
      return generateForecast(
        { birth },
        period.kind === "month"
          ? { kind: "month", year, month }
          : { kind: "year", start: period.start },
      );
    },

    save: async (userId, period, forecast) => {
      const values = {
        periodEnd: period.end,
        title: forecast.title,
        body: forecast.body,
        highlights: forecast.highlights,
        avoid: forecast.avoid,
        status: "ready",
      };
      const [row] = await db
        .insert(forecasts)
        .values({
          userId,
          kind: period.kind,
          periodStart: period.start,
          ...values,
        })
        .onConflictDoUpdate({
          target: [forecasts.userId, forecasts.kind, forecasts.periodStart],
          set: values,
        })
        .returning(COLUMNS);
      return row;
    },
  };

  try {
    const { status, body } = await serveForecast(
      ports,
      new URL(req.url).searchParams,
    );
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/forecast");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
