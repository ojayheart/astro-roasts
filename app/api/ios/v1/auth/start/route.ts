import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { magicLinks } from "@/lib/db/schema";
import { createMemoryRateLimiter, getClientIp } from "@/lib/rate-limit";
import { currentCode, normalizeEmail } from "@/lib/ios-auth";
import { sendLoginCodeEmail } from "@/lib/email";

export const runtime = "nodejs";

const byIp = createMemoryRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });
const byEmail = createMemoryRateLimiter({ limit: 6, windowMs: 60 * 60 * 1000 });
const MAX_PER_EMAIL_PER_HOUR = 6;

/**
 * iOS: email me a sign-in code. Always answers {ok:true} for a well-formed address, so it can't be used to learn who has roasts.
 * The durable per-email issue cap uses the existing magic_links table as an issue log (no schema change).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    if (!byIp.check(getClientIp(req.headers)).allowed || !byEmail.check(email).allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    try {
      const [{ n }] = await db
        .select({ n: count() })
        .from(magicLinks)
        .where(and(eq(magicLinks.email, email), gt(magicLinks.createdAt, hourAgo)));
      if (Number(n) >= MAX_PER_EMAIL_PER_HOUR) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      await db.insert(magicLinks).values({
        email,
        token: `ios:${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    } catch (err) {
      // The cap is best-effort; the in-memory limiters above still apply.
      Sentry.captureException(err);
    }

    const code = currentCode(email);
    const sent = await sendLoginCodeEmail(email, code);
    if (!sent) {
      // Never expose the code over the API in production. Dev servers can opt in to make local testing possible.
      if (process.env.IOS_AUTH_DEBUG_CODE === "1") return NextResponse.json({ ok: true, debugCode: code });
      return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("iOS auth start error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/auth/start");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
