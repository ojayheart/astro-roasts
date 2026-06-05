import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyStripeEvent, extractCompletedRoastId } from "@/lib/stripe";

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
      .set({ paid: true })
      .where(eq(roasts.id, extracted.roastId));
  } catch (err) {
    console.error("Webhook DB update failed:", err);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
