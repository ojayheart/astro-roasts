import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { SUBSCRIBED_STATUSES } from "@/lib/entitlement-rule";

/**
 * The single authorisation source — every gated route calls this. A null
 * expires_at never satisfies `gt`, so an unbounded row is not entitlement.
 */
export async function isSubscribed(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...SUBSCRIBED_STATUSES]),
        gt(subscriptions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return Boolean(row);
}
