import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeRevenue } from "../lib/admin-stripe.ts";

const NOW = 2_000_000_000_000; // fixed "now" in ms
const day = 86_400_000;
const sec = (ms: number) => Math.floor(ms / 1000); // Stripe created is unix seconds

const payments = [
  {
    amount: 500,
    currency: "usd",
    status: "succeeded",
    created: sec(NOW - 5 * day),
    metadata: { roastId: "r1" },
  },
  {
    amount: 700,
    currency: "usd",
    status: "succeeded",
    created: sec(NOW - 40 * day),
    metadata: { roastId: "r2" },
  },
  {
    amount: 900,
    currency: "eur",
    status: "succeeded",
    created: sec(NOW - 1 * day),
    metadata: { roastId: "r3" },
  },
  {
    amount: 999,
    currency: "usd",
    status: "requires_payment_method",
    created: sec(NOW - 1 * day),
    metadata: null,
  },
];

test("totals exclude non-succeeded and group by currency", () => {
  const s = summarizeRevenue(payments, NOW);
  const usd = s.byCurrency.find((c) => c.currency === "usd");
  const eur = s.byCurrency.find((c) => c.currency === "eur");
  assert.equal(usd?.allTime, 1200); // 500 + 700, excludes the failed 999
  assert.equal(usd?.last30d, 500); // only the 5-day-old one
  assert.equal(usd?.count, 2);
  assert.equal(eur?.allTime, 900);
  assert.equal(eur?.last30d, 900);
});

test("recent is succeeded-only, newest first, with roastId", () => {
  const s = summarizeRevenue(payments, NOW);
  assert.equal(s.recent.length, 3);
  assert.equal(s.recent[0].roastId, "r3"); // newest succeeded
  assert.equal(s.recent[0].currency, "eur");
  assert.ok(s.recent.every((p) => p.status === "succeeded"));
});
