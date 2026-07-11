import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyStripeEvent, extractCompletedRoastId } from "@/lib/stripe";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verified = verifyStripeEvent({ rawBody, signature, secret });
  if (!verified.ok) {
    console.warn("Stripe webhook rejected:", verified.error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/stripe");
      scope.setTag("stripe.signature_valid", "false");
      scope.setContext("stripe_webhook", { error: verified.error });
      Sentry.captureMessage("Stripe webhook signature invalid", "warning");
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const extracted = extractCompletedRoastId({ event: verified.event });
  if (!extracted.ok) {
    // Acknowledge unrelated events so Stripe stops retrying.
    return NextResponse.json({ received: true, ignored: extracted.error });
  }

  try {
    await db
      .update(roasts)
      .set({ paid: true, unlockedVia: "stripe" })
      .where(eq(roasts.id, extracted.roastId));
  } catch (err) {
    console.error("Webhook DB update failed:", err);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/stripe");
      scope.setContext("stripe_webhook", {
        roastId: extracted.roastId,
        eventType: verified.event.type,
      });
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  // Send the full-roast email now that payment is confirmed. If the pipeline
  // is still generating, status !== "ready" and this is a no-op; the pipeline
  // will send when it finishes. Failures don't fail the webhook — Stripe would
  // retry and re-flip paid harmlessly, but we'd risk duplicate sends.
  try {
    await sendRoastEmailIfReady(extracted.roastId);
  } catch (emailErr) {
    console.error("Email send failed (webhook):", emailErr);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/stripe");
      scope.setTag("subsystem", "email");
      scope.setContext("email", { roastId: extracted.roastId });
      Sentry.captureException(emailErr);
    });
  }

  return NextResponse.json({ received: true });
}
