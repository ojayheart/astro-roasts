import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function verifyPaddleSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  // Paddle-Signature format: ts=TIMESTAMP;h1=HASH
  const parts = Object.fromEntries(
    signature.split(";").map((p) => {
      const [key, ...rest] = p.split("=");
      return [key, rest.join("=")];
    }),
  );

  if (!parts.ts || !parts.h1) return false;

  const payload = `${parts.ts}:${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(parts.h1),
    Buffer.from(expectedSignature),
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyPaddleSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;

    // Process completed transactions
    if (eventType === "transaction.completed") {
      const customData = payload.data?.custom_data;
      const roastId = customData?.roastId;

      if (roastId) {
        await db
          .update(roasts)
          .set({ paid: true })
          .where(eq(roasts.id, roastId));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
