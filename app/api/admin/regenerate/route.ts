import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  let body: { roastId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.roastId) {
    return NextResponse.json({ error: "Missing roastId" }, { status: 400 });
  }

  const [row] = await db
    .select({
      roastId: roasts.id,
      userId: users.id,
      name: users.name,
      gender: users.gender,
      email: users.email,
      dob: users.dob,
      birthTime: users.birthTime,
      birthCity: users.birthCity,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.id, body.roastId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }

  await db
    .update(roasts)
    .set({ status: "generating", stagePct: 0 })
    .where(eq(roasts.id, row.roastId));

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: row.roastId,
      userId: row.userId,
      name: row.name,
      gender: row.gender ?? "",
      email: row.email,
      date: row.dob,
      time: row.birthTime,
      city: row.birthCity,
    },
  });

  return NextResponse.json({ ok: true, roastId: row.roastId });
}
