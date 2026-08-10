/**
 * The single subscription rule, kept free of the db client so both the query
 * in lib/entitlement.ts and the tests can share it.
 */

export const SUBSCRIBED_STATUSES = ["trial", "active", "grace"] as const;

export type SubscriptionRow = {
  status: string;
  expiresAt: Date | string | null;
};

/** Subscribed = status in (trial, active, grace) and expires_at > now. */
export function isSubscribedRow(
  row: SubscriptionRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.expiresAt) return false;
  if (!(SUBSCRIBED_STATUSES as readonly string[]).includes(row.status)) {
    return false;
  }
  return new Date(row.expiresAt).getTime() > now.getTime();
}

export function hasActiveSubscription(
  rows: readonly SubscriptionRow[],
  now: Date = new Date(),
): boolean {
  return rows.some((row) => isSubscribedRow(row, now));
}
