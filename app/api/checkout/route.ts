import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

interface CheckoutBody {
  roastId?: unknown;
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
  if (!roastId) {
    return NextResponse.json({ error: "roastId required" }, { status: 400 });
  }

  const roastRows = await db
    .select({
      id: roasts.id,
      paid: roasts.paid,
      userId: roasts.userId,
    })
    .from(roasts)
    .where(eq(roasts.id, roastId))
    .limit(1);

  const roast = roastRows[0];
  if (!roast) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }
  if (roast.paid) {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, roast.userId))
    .limit(1);
  const customerEmail = userRows[0]?.email ?? undefined;

  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  if (!priceId) {
    return NextResponse.json(
      { error: "Server misconfigured: STRIPE_PRICE_ID missing" },
      { status: 500 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://astroroast.com";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/roast/${roastId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/roast/${roastId}`,
      payment_intent_data: {
        statement_descriptor_suffix: "ASTROROAST",
        description: "Astroroast — personalized comedic essay (entertainment)",
      },
      metadata: { roastId },
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
