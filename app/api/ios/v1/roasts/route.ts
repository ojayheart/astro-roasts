import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { accountFromRequest } from "@/lib/ios-auth";
import { buildRoastPayload } from "@/lib/roast-response";

export const runtime = "nodejs";

/** Every roast owned by the signed-in email, newest first, with the owner's birth details so the app can restore a profile. */
export async function GET(req: NextRequest) {
  try {
    const email = accountFromRequest(req.headers);
    if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const owners = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
    if (owners.length === 0) return NextResponse.json({ roasts: [] });

    const rows = await db.query.roasts.findMany({
      where: inArray(roasts.userId, owners.map((o) => o.id)),
      with: { user: true, subjects: { with: { user: true } } },
      orderBy: desc(roasts.createdAt),
      limit: 200,
    });
    return NextResponse.json({
      roasts: rows.map((r) => ({
        roast: buildRoastPayload(r),
        birth: {
          name: r.user.name,
          gender: r.user.gender,
          date: r.user.dob,
          time: r.user.birthTime,
          place: r.user.birthCity,
        },
      })),
    });
  } catch (error) {
    console.error("iOS roasts list error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/roasts");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
