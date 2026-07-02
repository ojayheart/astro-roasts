import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts, users, roastSubjects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { pickCurrencyForCountry, readCountryFromHeaders } from "@/lib/currency";
import { groupAmountMinorUnits } from "@/lib/group";

export const runtime = "nodejs";

interface PaymentIntentBody {
  roastId?: unknown;
}

// Currency-specific amounts in minor units (cents). Match what's set on the
// Price object's currency_options so the user sees the same number ($5) in
// their local currency regardless of FX rates.
const AMOUNT_BY_CURRENCY: Record<string, number> = {
  usd: 500,
  aud: 500,
  nzd: 500,
  eur: 500,
  gbp: 500,
  cad: 500,
};

export async function POST(req: NextRequest) {
  let body: PaymentIntentBody;
  try {
    body = (await req.json()) as PaymentIntentBody;
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
      kind: roasts.kind,
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

  const country = readCountryFromHeaders(req.headers);
  const currency = pickCurrencyForCountry(country);
  let amount = AMOUNT_BY_CURRENCY[currency] ?? 500;
  if (roast.kind === "couple" || roast.kind === "family") {
    const subjectRows = await db
      .select({ id: roastSubjects.id })
      .from(roastSubjects)
      .where(eq(roastSubjects.roastId, roastId));
    amount = groupAmountMinorUnits(Math.max(subjectRows.length, 2));
  }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { roastId, country: country ?? "" },
      description:
        roast.kind === "solo"
          ? "Astroroast — personalized comedic essay (entertainment)"
          : `Astroroast — ${roast.kind} roast (entertainment)`,
      statement_descriptor_suffix: "ASTROROAST",
      ...(customerEmail ? { receipt_email: customerEmail } : {}),
    });

    if (!intent.client_secret) {
      throw new Error("Stripe did not return a client_secret");
    }

    return NextResponse.json({
      clientSecret: intent.client_secret,
      id: intent.id,
      amount,
      currency,
    });
  } catch (err) {
    console.error("Stripe payment intent error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 },
    );
  }
}
