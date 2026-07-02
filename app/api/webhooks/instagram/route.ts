import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";
import { normalizeBirthLocation } from "@/lib/location";
import {
  extractInstagramTextMessages,
  parseInstagramRoastRequest,
  verifyInstagramWebhookChallenge,
} from "@/lib/instagram-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;

export async function GET(req: NextRequest) {
  const verified = verifyInstagramWebhookChallenge(
    req.nextUrl.searchParams,
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  );

  if (!verified.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new NextResponse(verified.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const payload = (await req.json()) as unknown;
    const messages = extractInstagramTextMessages(payload);

    for (const message of messages) {
      const request = parseInstagramRoastRequest(message.text);
      if (!request) continue;

      const existing = await db.query.roasts.findFirst({
        where: (r, { and: dbAnd, eq: dbEq }) =>
          dbAnd(
            dbEq(r.source, "instagram_dm"),
            dbEq(r.mcSubscriberId, message.senderId),
            dbEq(r.status, "generating"),
          ),
      });
      if (existing) continue;

      const normalizedBirthPlace = normalizeBirthLocation(request.birthPlace);
      const referralCode = crypto.randomUUID().slice(0, 8);

      const userRows = (await db
        .insert(users)
        .values({
          name: request.name,
          gender: request.gender,
          email: null,
          dob: request.date,
          birthTime: request.time,
          birthCity: normalizedBirthPlace,
          lat: 0,
          lon: 0,
          tz: "UTC",
          referralCode,
        })
        .returning()) as (typeof users.$inferSelect)[];
      const user = userRows[0];

      const roastRows = (await db
        .insert(roasts)
        .values({
          userId: user.id,
          status: "generating",
          paid: false,
          emailSent: false,
          source: "instagram_dm",
          mcSubscriberId: message.senderId,
        })
        .returning()) as (typeof roasts.$inferSelect)[];
      const roast = roastRows[0];

      await inngest.send({
        name: "roast/generate",
        data: {
          roastId: roast.id,
          userId: user.id,
          name: request.name,
          gender: request.gender,
          email: null,
          date: request.date,
          time: request.time,
          city: normalizedBirthPlace,
          igSenderId: message.senderId,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Instagram webhook error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/instagram");
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
