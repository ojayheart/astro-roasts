import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";

export const runtime = "nodejs";

interface ProgressBody {
  roastId?: unknown;
  pct?: unknown;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ROAST_RUNNER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ProgressBody;
  try {
    body = (await req.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const roastId = typeof body.roastId === "string" ? body.roastId : "";
  const rawPct = Number(body.pct);
  if (!roastId || !Number.isFinite(rawPct)) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  // Clamp to 0–99 so we never claim 100% before status flips to "ready".
  const pct = Math.max(0, Math.min(99, Math.round(rawPct)));

  // GREATEST guards against a late callback dragging the bar backwards.
  try {
    await db
      .update(roasts)
      .set({ stagePct: sql`GREATEST(${roasts.stagePct}, ${pct})` })
      .where(eq(roasts.id, roastId));
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/roast-progress");
      scope.setContext("progress", { roastId, pct });
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "db_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pct });
}
