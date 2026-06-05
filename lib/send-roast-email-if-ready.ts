import { eq } from "drizzle-orm";
import { db } from "./db";
import { roasts, users } from "./db/schema";
import { sendRoastEmail } from "./email";

/**
 * Send the full-roast email to the buyer if and only if:
 * - The roast exists.
 * - status is "ready" (pipeline finished).
 * - paid is true (Stripe webhook flipped it).
 * - emailSent is false (no prior send).
 * - The user has an email on file.
 * - fullText is non-empty.
 *
 * Called from BOTH the inngest pipeline (when generation completes) and the
 * Stripe webhook (when payment completes). Either order is valid; whichever
 * fires last actually sends. The emailSent flag dedupes.
 *
 * Returns true if an email was sent.
 */
export async function sendRoastEmailIfReady(roastId: string): Promise<boolean> {
  const [row] = await db
    .select({
      status: roasts.status,
      paid: roasts.paid,
      emailSent: roasts.emailSent,
      fullText: roasts.fullText,
      userName: users.name,
      userEmail: users.email,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.id, roastId))
    .limit(1);

  if (!row) return false;
  if (!row.paid) return false;
  if (row.status !== "ready") return false;
  if (row.emailSent) return false;
  if (!row.userEmail) return false;
  if (!row.fullText) return false;

  await sendRoastEmail(row.userEmail, row.userName, row.fullText, roastId);
  await db
    .update(roasts)
    .set({ emailSent: true })
    .where(eq(roasts.id, roastId));
  return true;
}
