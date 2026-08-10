/**
 * Session rule, kept free of the db client so both the query in lib/session.ts
 * and the tests can share it.
 */

export type SessionRow = {
  userId: string;
  expiresAt: Date | string | null;
};

export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return match ? match[1] : null;
}

/** Live = the row exists and its expiry is still ahead of now. */
export function isSessionLive(
  row: SessionRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row?.expiresAt) return false;
  return new Date(row.expiresAt).getTime() > now.getTime();
}
