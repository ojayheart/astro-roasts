import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { magicLinks, users } from "@/lib/db/schema";
import { accountFromRequest } from "@/lib/ios-auth";

export const runtime = "nodejs";

/**
 * In-app account deletion (App Store guideline 5.1.1(v)). Removes the link between this email and its roasts: the email is cleared from
 * every user record that carried it, so nothing is tied to the person any more, and sign-in codes for it are dropped. Roast pages that
 * someone already holds a private link to keep working; to remove those too, the person can write to support.
 */
export async function DELETE(req: NextRequest) {
  try {
    const email = accountFromRequest(req.headers);
    if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const cleared = await db
      .update(users)
      .set({ email: null })
      .where(sql`lower(${users.email}) = ${email}`)
      .returning({ id: users.id });
    await db.delete(magicLinks).where(eq(magicLinks.email, email)).catch(() => undefined);
    return NextResponse.json({ deleted: true, unlinked: cleared.length });
  } catch (error) {
    console.error("iOS account delete error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/ios/v1/account");
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
