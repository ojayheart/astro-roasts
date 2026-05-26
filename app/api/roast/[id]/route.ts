import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildRoastPayload } from "@/lib/roast-response";

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

  if (roast.status === "generating") {
    return NextResponse.json(buildRoastPayload(roast));
  }

  if (roast.status === "error") {
    return NextResponse.json({ status: "error" });
  }

  return NextResponse.json(buildRoastPayload(roast));
}
