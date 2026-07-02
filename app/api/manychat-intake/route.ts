import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { users, roasts } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";
import { normalizeBirthLocation } from "@/lib/location";

/**
 * Intake for the Instagram DM funnel (ManyChat External Request node).
 *
 * ManyChat collects name / birth date / birthplace / birth time into custom
 * fields via the ROAST keyword flow, then POSTs them here with the
 * subscriber_id. We create the roast (source=instagram_dm) and fire the same
 * pipeline the website uses; the pipeline DMs the teaser + link back via the
 * ManyChat API when generation finishes (~90s), well past ManyChat's ~10s
 * webhook timeout — hence fire-and-return-202 rather than respond-in-flow.
 *
 * Birth date/time/place arrive as free text — the roast runner prompt
 * already resolves messy input, so no strict parsing here.
 */

export const maxDuration = 60;
const MAX_BODY_BYTES = 10_000;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MANYCHAT_INTAKE_SECRET;
    const auth = req.headers.get("authorization") || "";
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const body = await req.json();
    const subscriberId = String(body.subscriber_id || "").trim();
    const name = String(body.name || "").trim();
    const gender = String(body.gender || "person").trim();
    const date = String(body.date || "").trim();
    const time = body.time ? String(body.time).trim() : null;
    const birthPlace = String(body.birthplace || body.city || "").trim();

    if (!subscriberId || !name || !date || !birthPlace) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }
    if (
      subscriberId.length > 40 ||
      name.length > 80 ||
      gender.length > 60 ||
      date.length > 60 ||
      (time && time.length > 40) ||
      birthPlace.length > 160
    ) {
      return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    }

    // One roast per subscriber per funnel pass: if a recent roast for this
    // subscriber is still generating, don't stack another Fable run on it.
    const existing = await db.query.roasts.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.mcSubscriberId, subscriberId), eq(r.status, "generating")),
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, deduped: true });
    }

    const normalizedBirthPlace = normalizeBirthLocation(birthPlace);
    const referralCode = crypto.randomUUID().slice(0, 8);

    const userRows = (await db
      .insert(users)
      .values({
        name,
        gender,
        email: null,
        dob: date,
        birthTime: time,
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
        mcSubscriberId: subscriberId,
      })
      .returning()) as (typeof roasts.$inferSelect)[];
    const roast = roastRows[0];

    await inngest.send({
      name: "roast/generate",
      data: {
        roastId: roast.id,
        userId: user.id,
        name,
        gender,
        email: null,
        date,
        time,
        city: normalizedBirthPlace,
        mcSubscriberId: subscriberId,
      },
    });

    return NextResponse.json({ id: roast.id }, { status: 202 });
  } catch (error) {
    console.error("ManyChat intake error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/manychat-intake");
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
