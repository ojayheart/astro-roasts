import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyRoasts, users } from "@/lib/db/schema";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { birthInputFor } from "@/lib/birth-input";
import { generateDaily } from "@/lib/subscription-roast";
import { serveDaily, type DailyPorts } from "@/lib/subscription-api";

export const runtime = "nodejs";

const COLUMNS = {
  forDate: dailyRoasts.forDate,
  title: dailyRoasts.title,
  goldLine: dailyRoasts.goldLine,
  body: dailyRoasts.body,
  status: dailyRoasts.status,
};

/** Today's roast, `?date=YYYY-MM-DD` for history. Subscribers only. */
export async function GET(req: NextRequest) {
  const ports: DailyPorts = {
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

    find: async (userId, date) => {
      const [row] = await db
        .select(COLUMNS)
        .from(dailyRoasts)
        .where(
          and(eq(dailyRoasts.userId, userId), eq(dailyRoasts.forDate, date)),
        )
        .limit(1);
      return row ?? null;
    },

    generate: async (subject, date) => {
      const birth = await birthInputFor(subject);
      return birth ? generateDaily({ birth }, date) : null;
    },

    save: async (userId, date, roast, transits) => {
      const values = {
        title: roast.title,
        goldLine: roast.goldLine,
        body: roast.body,
        transits,
        status: "ready",
      };
      const [row] = await db
        .insert(dailyRoasts)
        .values({ userId, forDate: date, ...values })
        .onConflictDoUpdate({
          target: [dailyRoasts.userId, dailyRoasts.forDate],
          set: values,
        })
        .returning(COLUMNS);
      return row;
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
