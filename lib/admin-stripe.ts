import { getStripe } from "./stripe.ts";

export type PaymentLike = {
  amount: number;
  currency: string;
  status: string;
  created: number; // unix seconds (Stripe convention)
  metadata: { roastId?: string } | null;
};

export type CurrencyTotal = {
  currency: string;
  last30d: number;
  allTime: number;
  count: number;
};

export type RecentPayment = {
  amount: number;
  currency: string;
  created: number;
  roastId: string | null;
  status: string;
};

export type RevenueSummary = {
  byCurrency: CurrencyTotal[];
  recent: RecentPayment[];
};

const THIRTY_DAYS_MS = 2_592_000_000;

export function summarizeRevenue(
  payments: PaymentLike[],
  nowMs: number,
): RevenueSummary {
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const cutoff = nowMs - THIRTY_DAYS_MS;

  const totals = new Map<string, CurrencyTotal>();
  for (const p of succeeded) {
    const t = totals.get(p.currency) ?? {
      currency: p.currency,
      last30d: 0,
      allTime: 0,
      count: 0,
    };
    t.allTime += p.amount;
    t.count += 1;
    if (p.created * 1000 >= cutoff) t.last30d += p.amount;
    totals.set(p.currency, t);
  }

  const recent = succeeded
    .slice()
    .sort((a, b) => b.created - a.created)
    .slice(0, 20)
    .map((p) => ({
      amount: p.amount,
      currency: p.currency,
      created: p.created,
      roastId: p.metadata?.roastId ?? null,
      status: p.status,
    }));

  return {
    byCurrency: Array.from(totals.values()).sort(
      (a, b) => b.allTime - a.allTime,
    ),
    recent,
  };
}

async function listSucceededPayments(): Promise<PaymentLike[]> {
  const stripe = getStripe();
  const res = await stripe.paymentIntents.list({ limit: 100 });
  return res.data.map((pi) => ({
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status,
    created: pi.created,
    metadata: (pi.metadata as { roastId?: string } | null) ?? null,
  }));
}

export async function fetchRevenueSummary(): Promise<RevenueSummary> {
  const payments = await listSucceededPayments();
  return summarizeRevenue(payments, Date.now());
}

export async function fetchPaidAmountsByRoastId(): Promise<
  Map<string, { amount: number; currency: string }>
> {
  const payments = await listSucceededPayments();
  const map = new Map<string, { amount: number; currency: string }>();
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const roastId = p.metadata?.roastId;
    if (roastId && !map.has(roastId)) {
      map.set(roastId, { amount: p.amount, currency: p.currency });
    }
  }
  return map;
}
