import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";
import { getClientIp, shareUnlockRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Share-to-unlock: lift the paywall on a SOLO roast in exchange for a story
 * share. Honor-system — the client calls this after the share sheet resolves
 * (or after the user confirms they posted the downloaded card). A cheated
 * unlock is a marketing cost, not a loss; group roasts stay paid-only.
 */
export async function POST(req: NextRequest) {
  try {
    const limit = shareUnlockRateLimiter.check(getClientIp(req.headers));
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as { roastId?: unknown };
    const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
    if (!UUID_RE.test(roastId)) {
      return NextResponse.json({ error: "invalid_roast" }, { status: 400 });
    }

    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, roastId),
      columns: { paid: true, kind: true, status: true },
    });
    if (!roast) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (roast.paid) {
      return NextResponse.json({ unlocked: true });
    }
    if (roast.kind !== "solo") {
      return NextResponse.json(
        { error: "group_not_eligible" },
        { status: 403 },
      );
    }
    if (roast.status !== "ready") {
      return NextResponse.json({ error: "not_ready" }, { status: 409 });
    }

    await db
      .update(roasts)
      .set({ paid: true, unlockedVia: "share" })
      .where(eq(roasts.id, roastId));

    // Same delivery path as paid checkout — best-effort, page is the source
    // of truth.
    try {
      await sendRoastEmailIfReady(roastId);
    } catch (emailErr) {
      Sentry.withScope((scope) => {
        scope.setTag("route", "/api/share-unlock");
        scope.setContext("share_unlock", { roastId, stage: "email" });
        Sentry.captureException(emailErr);
      });
    }

    return NextResponse.json({ unlocked: true });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/share-unlock");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
