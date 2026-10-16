import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";
import { createMemoryRateLimiter, getClientIp } from "@/lib/rate-limit";
import { entitlementFor, verifySignedTransaction } from "@/lib/apple-iap";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limiter = createMemoryRateLimiter({ limit: 40, windowMs: 60 * 60 * 1000 });

/**
 * iOS app: unlock a roast after an App Store purchase.
 *
 * The app sends the StoreKit 2 signed transaction (JWS). We verify Apple's signature chain offline, check the bundle,
 * product, environment and that a per-roast purchase is bound to this roast (appAccountToken = roast id), or that an
 * active Roast+ subscription is attached, then flip `paid` exactly like the Stripe webhook does.
 */
export async function POST(req: NextRequest) {
  try {
    if (!limiter.check(getClientIp(req.headers)).allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      roastId?: unknown;
      signedTransaction?: unknown;
    };
    const roastId = typeof body.roastId === "string" ? body.roastId.trim() : "";
    const jws = typeof body.signedTransaction === "string" ? body.signedTransaction : "";
    if (!UUID_RE.test(roastId) || !jws || jws.length > 20_000) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const verified = verifySignedTransaction(jws, {
      // Local StoreKit testing in Xcode signs with its own root; only accept that when explicitly enabled on a dev server.
      roots:
        process.env.APPLE_IAP_ALLOW_XCODE === "1" && process.env.APPLE_IAP_TEST_ROOT_PEM
          ? [process.env.APPLE_IAP_TEST_ROOT_PEM]
          : undefined,
      requireAppleOids: process.env.APPLE_IAP_ALLOW_XCODE === "1" ? false : true,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 403 });
    }

    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, roastId),
      columns: { id: true, paid: true, kind: true, status: true },
    });
    if (!roast) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (roast.paid) return NextResponse.json({ unlocked: true });

    const ent = entitlementFor(verified.tx, roast);
    if (!ent.ok) return NextResponse.json({ error: ent.error }, { status: 403 });

    await db.update(roasts).set({ paid: true, unlockedVia: ent.via }).where(eq(roasts.id, roastId));
    // If the roast is already written this sends the buyer's email; otherwise the pipeline sends it when it finishes.
    await sendRoastEmailIfReady(roastId).catch((err) =>
      Sentry.captureException(err),
    );
    return NextResponse.json({ unlocked: true, via: ent.via });
  } catch (error) {
    console.error("iOS unlock error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/unlock");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
