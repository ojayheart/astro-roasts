import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { users, roasts } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";
import { generateRateLimiter, getClientIp } from "@/lib/rate-limit";
import { normalizeBirthLocation } from "@/lib/location";

export const maxDuration = 60;
const MAX_BODY_BYTES = 10_000;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const rateLimit = generateRateLimiter.check(getClientIp(req.headers));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many roast requests. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1),
            ),
          },
        },
      );
    }

    const body = await req.json();
    const { name, email, date, time } = body;
    const birthPlace =
      body.birthPlace ||
      [body.placeName, body.countryName]
        .filter((value) => typeof value === "string" && value.trim())
        .join(", ") ||
      body.city;

    if (!name || !date || !birthPlace) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      typeof name !== "string" ||
      name.length > 80 ||
      (email && (typeof email !== "string" || email.length > 254)) ||
      typeof date !== "string" ||
      (time && typeof time !== "string") ||
      typeof birthPlace !== "string" ||
      (body.placeName &&
        (typeof body.placeName !== "string" || body.placeName.length > 120)) ||
      (body.countryName &&
        (typeof body.countryName !== "string" ||
          body.countryName.length > 80)) ||
      birthPlace.length > 160
    ) {
      return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    }

    const normalizedBirthPlace = normalizeBirthLocation(birthPlace);

    // Create user
    const referralCode = crypto.randomUUID().slice(0, 8);
    const userRows = (await db
      .insert(users)
      .values({
        name,
        email: email || null,
        dob: date,
        birthTime: time || null,
        birthCity: normalizedBirthPlace,
        lat: 0,
        lon: 0,
        tz: "UTC",
        referralCode,
      })
      .returning()) as (typeof users.$inferSelect)[];
    const user = userRows[0];

    // Create roast row with "generating" status
    const roastRows = (await db
      .insert(roasts)
      .values({
        userId: user.id,
        status: "generating",
        paid: false,
        emailSent: false,
      })
      .returning()) as (typeof roasts.$inferSelect)[];
    const roast = roastRows[0];

    // Fire Inngest pipeline
    await inngest.send({
      name: "roast/generate",
      data: {
        roastId: roast.id,
        userId: user.id,
        name,
        email: email || null,
        date,
        time: time || null,
        city: normalizedBirthPlace,
      },
    });

    return NextResponse.json({ id: roast.id });
  } catch (error) {
    console.error("Generate error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/generate");
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
