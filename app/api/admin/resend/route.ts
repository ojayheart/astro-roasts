import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";

export async function POST(req: NextRequest) {
  let body: { roastId?: string; filter?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let ids: string[] = [];
  if (body.roastId) {
    ids = [body.roastId];
  } else if (body.filter === "unsent") {
    const rows = await db
      .select({ id: roasts.id })
      .from(roasts)
      .where(
        and(
          eq(roasts.paid, true),
          eq(roasts.emailSent, false),
          eq(roasts.status, "ready"),
        ),
      );
    ids = rows.map((r) => r.id);
  } else {
    return NextResponse.json(
      { error: "Provide roastId or filter:'unsent'" },
      { status: 400 },
    );
  }

  const results: { roastId: string; sent: boolean }[] = [];
  for (const id of ids) {
    const sent = await sendRoastEmailIfReady(id);
    results.push({ roastId: id, sent });
  }
  return NextResponse.json({ results });
}
