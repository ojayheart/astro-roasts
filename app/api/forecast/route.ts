import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { birthInputFor } from "@/lib/birth-input";
import { generateForecast } from "@/lib/subscription-roast";
import {
  findForecast,
  saveForecast,
  subjectFor,
} from "@/lib/subscription-store";
import { serveForecast, type ForecastPorts } from "@/lib/subscription-api";

export const runtime = "nodejs";

/** `?kind=month|year&period=YYYY-MM`. Subscribers only. */
export async function GET(req: NextRequest) {
  const ports: ForecastPorts = {
    userId: () => sessionUserId(req),
    subscribed: isSubscribed,
    subject: subjectFor,
    find: findForecast,
    save: saveForecast,

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
