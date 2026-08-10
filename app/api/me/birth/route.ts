import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveBirthLocation } from "@/lib/location";
import { sessionUserId } from "@/lib/session";
import { parseBirthInput } from "@/lib/me";

export const runtime = "nodejs";

/**
 * Set or correct birth details. The city resolves to lat/lon/tz through the
 * same table the web flow uses, so an unknown city stores 0/0/UTC rather than
 * failing the correction.
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
        dob: users.dob,
        birthTime: users.birthTime,
        birthCity: users.birthCity,
        tz: users.tz,
      });

    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ birth: row });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/me/birth");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
