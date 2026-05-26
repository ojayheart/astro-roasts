import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaddleTransaction } from "@/lib/paddle";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    const expectedPriceId =
      process.env.PADDLE_PRICE_ID?.trim() ||
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim();

    if (!secret || !signature) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = verifyPaddleTransaction({
      rawBody,
      signature,
      secret,
      expectedPriceId,
    });

    if (!verified.ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await db
      .update(roasts)
      .set({ paid: true })
      .where(eq(roasts.id, verified.roastId));

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
