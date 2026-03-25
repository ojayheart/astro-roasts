import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const roast = await db.query.roasts.findFirst({
    where: eq(roasts.id, id),
    with: { user: true },
  });

  if (!roast) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }

  // Still generating
  if (roast.status === "generating") {
    return NextResponse.json({ status: "generating" });
  }

  // Error during generation
  if (roast.status === "error") {
    return NextResponse.json({ status: "error" });
  }

  // Extract user from relation
  const user = Array.isArray(roast.user) ? roast.user[0] : roast.user;

  // If not paid, return teaser only
  if (!roast.paid) {
    return NextResponse.json({
      status: "ready",
      paid: false,
      name: user.name,
      sunSign: roast.sunSign,
      moonSign: roast.moonSign,
      rising: roast.rising,
      teaser: roast.teaser,
    });
  }

  // Paid — return everything
  return NextResponse.json({
    status: "ready",
    paid: true,
    name: user.name,
    sunSign: roast.sunSign,
    moonSign: roast.moonSign,
    rising: roast.rising,
    mercurySign: roast.mercurySign,
    venusSign: roast.venusSign,
    marsSign: roast.marsSign,
    jupiterSign: roast.jupiterSign,
    saturnSign: roast.saturnSign,
    teaser: roast.teaser,
    fullText: roast.fullText,
    callouts: roast.callouts ? roast.callouts.split("|") : [],
  });
}
