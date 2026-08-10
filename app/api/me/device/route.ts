import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { sessionUserId } from "@/lib/session";
import { parseDeviceInput } from "@/lib/me";

export const runtime = "nodejs";

/**
 * Register the handset. Keyed on the APNs token, so a reinstall that reuses the
 * token updates in place and a device handed to another account reassigns.
 * devices.tz is the handset's, which is not users.tz once someone travels.
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = await sessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const input = parseDeviceInput(await req.json().catch(() => ({})));
    if (!input) {
      return NextResponse.json({ error: "invalid_device" }, { status: 400 });
    }

    const seenAt = new Date();
    const [row] = await db
      .insert(devices)
      .values({
        userId,
        apnsToken: input.apnsToken,
        tz: input.tz,
        notifyHour: input.notifyHour,
        build: input.build,
        lastSeenAt: seenAt,
      })
      .onConflictDoUpdate({
        target: devices.apnsToken,
        set: {
          userId,
          tz: input.tz,
          notifyHour: input.notifyHour,
          build: input.build,
          lastSeenAt: seenAt,
        },
      })
      .returning({
        id: devices.id,
        tz: devices.tz,
        notifyHour: devices.notifyHour,
      });

    return NextResponse.json({ device: row });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/me/device");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
