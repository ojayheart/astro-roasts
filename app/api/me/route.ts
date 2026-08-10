import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { buildMePayload, placementsFrom } from "@/lib/me";

export const runtime = "nodejs";

/** User + latest chart placements + entitlement, one call for app launch. */
export async function GET(req: NextRequest) {
  try {
    const userId = await sessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        dob: true,
        birthTime: true,
        birthCity: true,
        tz: true,
        onboardedAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const [latest] = await db
      .select({
        sunSign: roasts.sunSign,
        moonSign: roasts.moonSign,
        rising: roasts.rising,
        mercurySign: roasts.mercurySign,
        venusSign: roasts.venusSign,
        marsSign: roasts.marsSign,
        jupiterSign: roasts.jupiterSign,
        saturnSign: roasts.saturnSign,
      })
      .from(roasts)
      .where(eq(roasts.userId, userId))
      .orderBy(desc(roasts.createdAt))
      .limit(1);

    return NextResponse.json(
      buildMePayload(user, placementsFrom(latest), await isSubscribed(userId)),
    );
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/me");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
