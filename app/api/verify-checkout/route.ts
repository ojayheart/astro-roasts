import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyRoastPayment } from "@/lib/stripe";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";

export const runtime = "nodejs";

// Synchronous payment confirmation for the post-checkout landing. The buyer
// arrives at /roast/[id]?paid=1 with a Stripe `session_id` (hosted) or
// `payment_intent` (embedded). We verify it against Stripe and flip `paid`
// here — no email required and no dependence on the webhook firing. The Stripe
// webhook remains as a secondary, idempotent path.
export async function POST(req: NextRequest) {
  let body: {
    roastId?: unknown;
    sessionId?: unknown;
    paymentIntentId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : null;
  const paymentIntentId =
    typeof body.paymentIntentId === "string"
      ? body.paymentIntentId.trim()
      : null;

  if (!roastId) {
    return NextResponse.json({ error: "roastId required" }, { status: 400 });
  }
  if (!sessionId && !paymentIntentId) {
    return NextResponse.json(
      { error: "session_id or payment_intent required" },
      { status: 400 },
    );
  }

  const rows = await db
    .select({ id: roasts.id, paid: roasts.paid })
    .from(roasts)
    .where(eq(roasts.id, roastId))
    .limit(1);
  const roast = rows[0];
  if (!roast) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }
  // Already unlocked (e.g. webhook beat us here) — nothing to do.
  if (roast.paid) {
    return NextResponse.json({ paid: true });
  }

  const result = await verifyRoastPayment({
    roastId,
    sessionId,
    paymentIntentId,
  });
  if (!result.paid) {
    return NextResponse.json(
      { paid: false, error: result.error },
      { status: 402 },
    );
  }

  try {
    await db.update(roasts).set({ paid: true }).where(eq(roasts.id, roastId));
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/verify-checkout");
      scope.setContext("verify_checkout", { roastId });
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  // Best-effort email. No-op when Resend isn't configured or no email on file;
  // never blocks the unlock.
  try {
    await sendRoastEmailIfReady(roastId);
  } catch (emailErr) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/verify-checkout");
      scope.setTag("subsystem", "email");
      scope.setContext("email", { roastId });
      Sentry.captureException(emailErr);
    });
  }

  return NextResponse.json({ paid: true });
}
