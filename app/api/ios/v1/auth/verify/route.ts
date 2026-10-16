import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createMemoryRateLimiter, getClientIp } from "@/lib/rate-limit";
import { checkCode, normalizeEmail, signToken } from "@/lib/ios-auth";

export const runtime = "nodejs";

// Guessing a 6-digit code must stay impractical: few tries per email and per IP.
const byIp = createMemoryRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });
const byEmail = createMemoryRateLimiter({ limit: 8, windowMs: 15 * 60 * 1000 });

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    if (!byIp.check(getClientIp(req.headers)).allowed || !byEmail.check(email).allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (!checkCode(email, body.code)) return NextResponse.json({ error: "wrong_code" }, { status: 401 });
    return NextResponse.json({ token: signToken(email), email });
  } catch (error) {
    console.error("iOS auth verify error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/auth/verify");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
