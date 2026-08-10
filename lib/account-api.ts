/**
 * Account deletion for /api/account. The purge order is the FK order —
 * nothing referencing users(id) or roasts(id) survives the row it points at.
 * `referrals` is an update, not a delete: users.referred_by points back at the
 * account being removed, so it is cleared before users go.
 */

import type { Reply } from "./subscription-api.ts";

export const PURGE_ORDER = [
  "referrals",
  "duos",
  "roast_subjects",
  "connections",
  "daily_roasts",
  "forecasts",
  "devices",
  "subscriptions",
  "sessions",
  "magic_links",
  "roasts",
  "users",
] as const;

export type PurgeStep = (typeof PURGE_ORDER)[number];

export type AccountPorts = {
  userId: () => Promise<string | null>;
  /** Placeholder users the owner's duos invented — nobody else's account. */
  subjectIds: (ownerId: string) => Promise<string[]>;
  purge: (step: PurgeStep, ids: string[]) => Promise<number>;
};

export async function serveDeleteAccount(ports: AccountPorts): Promise<Reply> {
  const userId = await ports.userId();
  if (!userId) return { status: 401, body: { error: "unauthorized" } };

  const ids = [userId, ...(await ports.subjectIds(userId))];
  const rows: Record<string, number> = {};
  for (const step of PURGE_ORDER) rows[step] = await ports.purge(step, ids);

  return { status: 200, body: { deleted: true, rows } };
}
