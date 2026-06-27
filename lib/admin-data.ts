import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { fetchPaidAmountsByRoastId } from "@/lib/admin-stripe";

export type RoastFilter = "all" | "unsent" | "errors" | "unpaid";

export type RoastListItem = {
  id: string;
  name: string;
  email: string | null;
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  status: string;
  paid: boolean;
  emailSent: boolean;
  createdAt: string;
};

const listColumns = {
  id: roasts.id,
  name: users.name,
  email: users.email,
  sunSign: roasts.sunSign,
  moonSign: roasts.moonSign,
  rising: roasts.rising,
  status: roasts.status,
  paid: roasts.paid,
  emailSent: roasts.emailSent,
  createdAt: roasts.createdAt,
};

function filterWhere(filter: RoastFilter) {
  switch (filter) {
    case "unsent":
      return and(eq(roasts.paid, true), eq(roasts.emailSent, false));
    case "errors":
      return eq(roasts.status, "error");
    case "unpaid":
      return eq(roasts.paid, false);
    case "all":
    default:
      return undefined;
  }
}

export async function listRoasts(
  filter: RoastFilter,
): Promise<RoastListItem[]> {
  const rows = await db
    .select(listColumns)
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(filterWhere(filter))
    .orderBy(desc(roasts.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type RoastDetail = RoastListItem & {
  gender: string | null;
  dob: string;
  birthTime: string | null;
  birthCity: string;
  title: string | null;
  teaser: string | null;
  fullText: string | null;
  validationNotes: string | null;
};

export async function getRoastDetail(id: string): Promise<RoastDetail | null> {
  const [row] = await db
    .select({
      ...listColumns,
      gender: users.gender,
      dob: users.dob,
      birthTime: users.birthTime,
      birthCity: users.birthCity,
      title: roasts.title,
      teaser: roasts.teaser,
      fullText: roasts.fullText,
      validationNotes: roasts.validationNotes,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.id, id))
    .limit(1);

  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export type BuyerItem = {
  userId: string;
  name: string;
  email: string | null;
  firstPaidAt: string;
  roastIds: string[];
  amount: number | null;
  currency: string | null;
};

export async function listBuyers(): Promise<BuyerItem[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      roastId: roasts.id,
      createdAt: roasts.createdAt,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.paid, true))
    .orderBy(desc(roasts.createdAt));

  const amounts = await fetchPaidAmountsByRoastId();

  const byUser = new Map<string, BuyerItem>();
  for (const r of rows) {
    const existing = byUser.get(r.userId);
    const matched = amounts.get(r.roastId);
    if (existing) {
      existing.roastIds.push(r.roastId);
      if (existing.amount === null && matched) {
        existing.amount = matched.amount;
        existing.currency = matched.currency;
      }
    } else {
      byUser.set(r.userId, {
        userId: r.userId,
        name: r.name,
        email: r.email,
        firstPaidAt: r.createdAt.toISOString(),
        roastIds: [r.roastId],
        amount: matched?.amount ?? null,
        currency: matched?.currency ?? null,
      });
    }
  }
  return Array.from(byUser.values());
}
