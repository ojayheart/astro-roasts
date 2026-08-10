import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { bearerToken, isSessionLive } from "@/lib/session-token";

/**
 * The one identity source for the app's routes — the sessions table the plan
 * points at. The handset sends `Authorization: Bearer <sessions.token>`.
 * Missing, unknown and expired tokens are all just null.
 */
export async function sessionUserId(req: Request): Promise<string | null> {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return null;

  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  return isSessionLive(row) ? row.userId : null;
}
