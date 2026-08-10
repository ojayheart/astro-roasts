import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { birthInputFor } from "@/lib/birth-input";
import { generateDaily } from "@/lib/subscription-roast";
import { findDaily, saveDaily, subjectFor } from "@/lib/subscription-store";
import { serveDaily, type DailyPorts } from "@/lib/subscription-api";

export const runtime = "nodejs";

/** Today's roast, `?date=YYYY-MM-DD` for history. Subscribers only. */
export async function GET(req: NextRequest) {
  const ports: DailyPorts = {
    userId: () => sessionUserId(req),
    subscribed: isSubscribed,
    subject: subjectFor,
    find: findDaily,
    save: saveDaily,

    generate: async (subject, date) => {
      const birth = await birthInputFor(subject);
      return birth ? generateDaily({ birth }, date) : null;
    },
  };

  try {
    const { status, body } = await serveDaily(
      ports,
      new URL(req.url).searchParams,
    );
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/daily");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
