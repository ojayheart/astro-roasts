import { NextRequest, NextResponse } from "next/server";
import { getCityData } from "@/lib/cities";
import { db } from "@/lib/db";
import { users, roasts } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { name, email, date, time, city } = await req.json();

    if (!name || !date || !city) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const cityData = getCityData(city);
    if (!cityData) {
      return NextResponse.json({ error: "City not found" }, { status: 400 });
    }

    // Create user
    const referralCode = crypto.randomUUID().slice(0, 8);
    const userRows = (await db
      .insert(users)
      .values({
        name,
        email: email || null,
        dob: date,
        birthTime: time || null,
        birthCity: city,
        lat: cityData.lat,
        lon: cityData.lon,
        tz: cityData.tz,
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
        lat: cityData.lat,
        lon: cityData.lon,
        tz: cityData.tz,
        city,
      },
    });

    return NextResponse.json({ id: roast.id });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
