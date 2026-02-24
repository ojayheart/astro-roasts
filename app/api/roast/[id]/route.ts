import { NextRequest, NextResponse } from "next/server";
import { getRoast } from "@/lib/kv";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const roast = await getRoast(id);

  if (!roast) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }

  if (roast.status === "generating") {
    return NextResponse.json({ status: "generating" });
  }

  if (roast.status === "error") {
    return NextResponse.json(
      { status: "error", error: roast.error },
      { status: 500 },
    );
  }

  // If not paid, return teaser only — no full content in response
  if (!roast.paid) {
    return NextResponse.json({
      status: "ready",
      paid: false,
      name: roast.name,
      sunSign: roast.sunSign,
      moonSign: roast.moonSign,
      rising: roast.rising,
      teaser: roast.teaser,
      // Send section headers only (for blur placeholders), not content
      sectionHeaders: roast.sections?.map((s) => s.title) || [],
    });
  }

  // Paid — return everything
  return NextResponse.json({
    status: "ready",
    paid: true,
    name: roast.name,
    sunSign: roast.sunSign,
    moonSign: roast.moonSign,
    rising: roast.rising,
    mercury: roast.mercury,
    venus: roast.venus,
    mars: roast.mars,
    jupiter: roast.jupiter,
    saturn: roast.saturn,
    teaser: roast.teaser,
    sections: roast.sections,
  });
}
