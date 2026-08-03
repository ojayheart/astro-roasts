import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, roastSubjects } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";
import { queueChartAnnotationsIfReady } from "@/lib/queue-chart-annotations";
import { getClientIp, promoCodeRateLimiter } from "@/lib/rate-limit";
import { isFreeAfterDiscount, lookupPromo } from "@/lib/promo";
import { groupAmountMinorUnits } from "@/lib/group";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Redeem a 100%-off promo code. Partial discounts never come here — those are
 * applied to the PaymentIntent amount in /api/payment-intent and still go
 * through Stripe. This endpoint only handles the case where there is nothing
 * left to charge, so it flips the roast to paid directly.
 *
 * The code is the secret. It's validated against ROAST_PROMO_CODES on the
 * server and never sent to the client.
 */
export async function POST(req: NextRequest) {
  try {
    const limit = promoCodeRateLimiter.check(getClientIp(req.headers));
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      roastId?: unknown;
      code?: unknown;
    };
    const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
    if (!UUID_RE.test(roastId)) {
      return NextResponse.json({ error: "invalid_roast" }, { status: 400 });
    }

    const promo = lookupPromo(body.code);
    if (!promo) {
      return NextResponse.json({ error: "invalid_code" }, { status: 404 });
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
    if (roast.status !== "ready") {
      return NextResponse.json({ error: "not_ready" }, { status: 409 });
    }

    // Work out what this roast actually costs before deciding the code covers
    // it — a 50%-off code must not unlock a group roast for nothing.
    let amount = 500;
    if (roast.kind === "couple" || roast.kind === "family") {
      const subjectRows = await db
        .select({ id: roastSubjects.id })
        .from(roastSubjects)
        .where(eq(roastSubjects.roastId, roastId));
      amount = groupAmountMinorUnits(Math.max(subjectRows.length, 2));
    }

    if (!isFreeAfterDiscount(amount, promo.percentOff)) {
      // Valid code, but there's still something to pay. Tell the client to
      // run the normal card flow with the code applied.
      return NextResponse.json(
        {
          unlocked: false,
          requiresPayment: true,
          percentOff: promo.percentOff,
        },
        { status: 200 },
      );
    }

    await db
      .update(roasts)
      .set({ paid: true, unlockedVia: `code:${promo.code}` })
      .where(eq(roasts.id, roastId));

    try {
      await sendRoastEmailIfReady(roastId);
    } catch (emailErr) {
      Sentry.withScope((scope) => {
        scope.setTag("route", "/api/redeem-code");
        scope.setContext("redeem_code", { roastId, stage: "email" });
        Sentry.captureException(emailErr);
      });
    }

    await queueChartAnnotationsIfReady(roastId);

    return NextResponse.json({ unlocked: true });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/redeem-code");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
