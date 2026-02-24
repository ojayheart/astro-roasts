import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getCityData } from "@/lib/cities";
import { setRoast } from "@/lib/kv";
import type { GenerateRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { name, date, time, city } = body;

    if (!name || !date || !time || !city) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    // Lookup city data
    const cityData = getCityData(city);
    if (!cityData) {
      return NextResponse.json({ error: "City not found" }, { status: 400 });
    }

    // Parse date and time
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);

    // Generate roast ID
    const roastId = crypto.randomUUID();

    // Store initial status
    await setRoast(roastId, {
      status: "generating",
      name,
      paid: false,
      createdAt: Date.now(),
    });

    // Fire Inngest event
    await inngest.send({
      name: "roast/generate",
      data: {
        roastId,
        name,
        year,
        month,
        day,
        hour,
        minute,
        lat: cityData.lat,
        lon: cityData.lon,
        tz: cityData.tz,
      },
    });

    return NextResponse.json({ id: roastId });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
