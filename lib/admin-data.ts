import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { and, count, desc, eq, gte, ilike, or, type SQL } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export const ROASTS_PAGE_SIZE = 50;

export interface RoastStats {
  totalRoasts: number;
  totalUsers: number;
  paid: number;
  unpaid: number;
  conversionPct: number; // paid / total, 0-100
  statusCounts: Record<string, number>; // generating | ready | error | ...
  last24h: number;
  last7d: number;
  last30d: number;
  paidLast7d: number;
}

function sinceDate(ms: number): Date {
  return new Date(Date.now() - ms);
}

const DAY = 24 * 60 * 60 * 1000;

export async function getRoastStats(): Promise<RoastStats> {
  const [
    totalRow,
    usersRow,
    paidRow,
    statusRows,
    last24Row,
    last7Row,
    last30Row,
    paid7Row,
  ] = await Promise.all([
    db.select({ c: count() }).from(roasts),
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(roasts).where(eq(roasts.paid, true)),
    db
      .select({ status: roasts.status, c: count() })
      .from(roasts)
      .groupBy(roasts.status),
    db
      .select({ c: count() })
      .from(roasts)
      .where(gte(roasts.createdAt, sinceDate(DAY))),
    db
      .select({ c: count() })
      .from(roasts)
      .where(gte(roasts.createdAt, sinceDate(7 * DAY))),
    db
      .select({ c: count() })
      .from(roasts)
      .where(gte(roasts.createdAt, sinceDate(30 * DAY))),
    db
      .select({ c: count() })
      .from(roasts)
      .where(and(eq(roasts.paid, true), gte(roasts.createdAt, sinceDate(7 * DAY)))),
  ]);

  const totalRoasts = totalRow[0]?.c ?? 0;
  const paid = paidRow[0]?.c ?? 0;
  const statusCounts: Record<string, number> = {};
  for (const row of statusRows) {
    statusCounts[row.status] = row.c;
  }

  return {
    totalRoasts,
    totalUsers: usersRow[0]?.c ?? 0,
    paid,
    unpaid: totalRoasts - paid,
    conversionPct: totalRoasts > 0 ? Math.round((paid / totalRoasts) * 1000) / 10 : 0,
    statusCounts,
    last24h: last24Row[0]?.c ?? 0,
    last7d: last7Row[0]?.c ?? 0,
    last30d: last30Row[0]?.c ?? 0,
    paidLast7d: paid7Row[0]?.c ?? 0,
  };
}

export interface RoastRow {
  id: string;
  status: string;
  paid: boolean;
  createdAt: Date;
  title: string | null;
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  name: string;
  email: string | null;
  dob: string;
  birthCity: string;
}

export interface ListRoastsResult {
  rows: RoastRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listRoasts(opts: {
  q?: string;
  page?: number;
}): Promise<ListRoastsResult> {
  const pageSize = ROASTS_PAGE_SIZE;
  const page = Math.max(0, Math.floor(opts.page ?? 0));
  const q = opts.q?.trim();

  let where: SQL | undefined;
  if (q) {
    const like = `%${q}%`;
    where = or(ilike(users.name, like), ilike(users.email, like));
  }

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: roasts.id,
        status: roasts.status,
        paid: roasts.paid,
        createdAt: roasts.createdAt,
        title: roasts.title,
        sunSign: roasts.sunSign,
        moonSign: roasts.moonSign,
        rising: roasts.rising,
        name: users.name,
        email: users.email,
        dob: users.dob,
        birthCity: users.birthCity,
      })
      .from(roasts)
      .innerJoin(users, eq(roasts.userId, users.id))
      .where(where)
      .orderBy(desc(roasts.createdAt))
      .limit(pageSize)
      .offset(page * pageSize),
    db
      .select({ c: count() })
      .from(roasts)
      .innerJoin(users, eq(roasts.userId, users.id))
      .where(where),
  ]);

  const total = totalRow[0]?.c ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface RevenueSummary {
  ok: boolean;
  error?: string;
  // Net amount (gross minus refunds) in major units, keyed by uppercase currency.
  byCurrency: Record<string, number>;
  chargeCount: number;
  capped: boolean; // true if we hit the scan limit and totals may be partial
}

// Stripe is the source of truth for money — the DB only stores a `paid` flag.
// We scan recent succeeded charges and sum net amounts per currency. Capped to
// keep the page responsive; flagged when the cap is hit.
const MAX_CHARGE_PAGES = 10; // 10 * 100 = up to 1000 charges

export async function getStripeRevenue(): Promise<RevenueSummary> {
  const byCurrency: Record<string, number> = {};
  let chargeCount = 0;
  let capped = false;

  try {
    const stripe = getStripe();
    let startingAfter: string | undefined;

    for (let i = 0; i < MAX_CHARGE_PAGES; i++) {
      const pageData = await stripe.charges.list({
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const ch of pageData.data) {
        if (ch.status !== "succeeded" || !ch.paid) continue;
        const net = (ch.amount - (ch.amount_refunded ?? 0)) / 100;
        if (net <= 0) continue;
        const code = ch.currency.toUpperCase();
        byCurrency[code] = (byCurrency[code] ?? 0) + net;
        chargeCount++;
      }

      if (!pageData.has_more) break;
      startingAfter = pageData.data[pageData.data.length - 1]?.id;
      if (i === MAX_CHARGE_PAGES - 1 && pageData.has_more) capped = true;
    }

    return { ok: true, byCurrency, chargeCount, capped };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Stripe request failed";
    return { ok: false, error, byCurrency, chargeCount, capped };
  }
}
