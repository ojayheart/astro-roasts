import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { accountFromRequest } from "@/lib/ios-auth";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attach a roast the app made before sign-in to the signed-in email. The roast id is an unguessable capability, and a roast that
 * already belongs to a different email is never taken over.
 */
export async function POST(req: NextRequest) {
  try {
    const email = accountFromRequest(req.headers);
    if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { roastId?: unknown };
    const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
    if (!UUID_RE.test(roastId)) return NextResponse.json({ error: "invalid_roast" }, { status: 400 });

    const roast = await db.query.roasts.findFirst({ where: eq(roasts.id, roastId), with: { user: true } });
    if (!roast) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const current = roast.user.email?.trim().toLowerCase();
    if (current === email) return NextResponse.json({ claimed: true, already: true });
    if (current) return NextResponse.json({ error: "belongs_to_another_account" }, { status: 409 });

    await db.update(users).set({ email }).where(eq(users.id, roast.userId));
    return NextResponse.json({ claimed: true });
  } catch (error) {
    console.error("iOS claim error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/roasts/claim");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
