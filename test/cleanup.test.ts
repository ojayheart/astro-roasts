import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import Stripe from "stripe";
import { getPublicEnv } from "../lib/env.ts";
import { resolveBirthLocation } from "../lib/location.ts";
import { createMemoryRateLimiter } from "../lib/rate-limit.ts";
import { buildRoastPayload } from "../lib/roast-response.ts";
import {
  buildRoastRunnerPayload,
  extractChartPlacements,
} from "../lib/roast-runner.ts";
import { buildSentryInitOptions } from "../lib/sentry-config.ts";
import {
  pickCurrencyForCountry,
  readCountryFromHeaders,
  isSupportedCurrency,
} from "../lib/currency.ts";

const baseRoast = {
  id: "roast-1",
  status: "ready",
  paid: false,
  user: { name: "Ada" },
  sunSign: "Aries",
  moonSign: "Cancer",
  rising: "Virgo",
  mercurySign: "Taurus",
  venusSign: "Gemini",
  marsSign: "Leo",
  jupiterSign: "Libra",
  saturnSign: "Capricorn",
  teaser: "teaser",
  fullText: "paid full roast",
  callouts: "one|two",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

test("unpaid roast payload excludes paid-only content", () => {
  const payload = buildRoastPayload(baseRoast);

  assert.equal(payload.paid, false);
  assert.equal(payload.teaser, "paid full roast");
  assert.equal("fullText" in payload, false);
  assert.equal("callouts" in payload, false);
  assert.equal("mercurySign" in payload, false);
});

test("paid roast payload includes paid-only content", () => {
  const payload = buildRoastPayload({ ...baseRoast, paid: true });

  assert.equal(payload.paid, true);
  assert.equal(payload.fullText, "paid full roast");
  assert.deepEqual(payload.callouts, ["one", "two"]);
  assert.equal(payload.mercurySign, "Taurus");
});

test("memory rate limiter blocks requests over the window limit", () => {
  const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 1000 });

  assert.equal(limiter.check("198.51.100.4", 1000).allowed, true);
  assert.equal(limiter.check("198.51.100.4", 1100).allowed, true);
  assert.equal(limiter.check("198.51.100.4", 1200).allowed, false);
  assert.equal(limiter.check("198.51.100.4", 2101).allowed, true);
});

// Stripe webhook signature uses the same scheme as Stripe.webhooks.constructEvent.
// Compute it the same way Stripe does so we can exercise the verifier without
// instantiating the SDK against live credentials.
function stripeSignatureHeader({
  rawBody,
  secret,
  timestamp,
}: {
  rawBody: string;
  secret: string;
  timestamp: number;
}) {
  const signedPayload = `${timestamp}.${rawBody}`;
  const v1 = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

test("Stripe webhook rejects invalid signature", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_test_only";
  const { verifyStripeEvent } = await import("../lib/stripe.ts");

  const rawBody = JSON.stringify({ id: "evt_test", type: "ping" });
  const result = verifyStripeEvent({
    rawBody,
    signature: "t=1,v1=deadbeef",
    secret: "whsec_correct",
  });

  assert.equal(result.ok, false);
});

test("Stripe webhook verifies valid signature and extracts roastId", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_test_only";
  const { verifyStripeEvent, extractCompletedRoastId } =
    await import("../lib/stripe.ts");

  const secret = "whsec_test_local";
  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status: "paid",
        metadata: { roastId: "roast-1" },
      },
    },
  });

  const signature = stripeSignatureHeader({ rawBody, secret, timestamp });
  const verified = verifyStripeEvent({ rawBody, signature, secret });

  assert.equal(verified.ok, true);
  if (!verified.ok) return;

  const extracted = extractCompletedRoastId({ event: verified.event });
  assert.deepEqual(extracted, { ok: true, roastId: "roast-1" });
});

test("Stripe webhook ignores non-checkout-completed events", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_test_only";
  const { extractCompletedRoastId } = await import("../lib/stripe.ts");

  const event = {
    id: "evt_test_2",
    type: "payment_intent.succeeded",
    data: { object: { metadata: { roastId: "roast-1" } } },
  } as unknown as Stripe.Event;

  const result = extractCompletedRoastId({ event });
  assert.equal(result.ok, false);
});

test("Stripe webhook rejects checkout.session.completed without paid status", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_test_only";
  const { extractCompletedRoastId } = await import("../lib/stripe.ts");

  const event = {
    id: "evt_test_3",
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "unpaid",
        metadata: { roastId: "roast-1" },
      },
    },
  } as unknown as Stripe.Event;

  const result = extractCompletedRoastId({ event });
  assert.equal(result.ok, false);
});

test("Stripe webhook rejects checkout.session.completed missing roastId metadata", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_test_only";
  const { extractCompletedRoastId } = await import("../lib/stripe.ts");

  const event = {
    id: "evt_test_4",
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "paid",
        metadata: {},
      },
    },
  } as unknown as Stripe.Event;

  const result = extractCompletedRoastId({ event });
  assert.equal(result.ok, false);
});

test("currency picks AUD for AU, NZD for NZ, GBP for GB, CAD for CA", () => {
  assert.equal(pickCurrencyForCountry("AU"), "aud");
  assert.equal(pickCurrencyForCountry("NZ"), "nzd");
  assert.equal(pickCurrencyForCountry("GB"), "gbp");
  assert.equal(pickCurrencyForCountry("CA"), "cad");
});

test("currency picks EUR for Eurozone members", () => {
  for (const c of [
    "DE",
    "FR",
    "ES",
    "IT",
    "NL",
    "IE",
    "FI",
    "AT",
    "PT",
    "HR",
  ]) {
    assert.equal(pickCurrencyForCountry(c), "eur", `${c} should map to EUR`);
  }
});

test("currency falls back to USD for non-Eurozone EU outliers and rest of world", () => {
  // SE/DK/NO/PL/CH not in Eurozone — should fall back to USD (we don't price in their local currency)
  for (const c of [
    "SE",
    "DK",
    "NO",
    "PL",
    "CH",
    "US",
    "JP",
    "IN",
    "BR",
    "ZA",
  ]) {
    assert.equal(
      pickCurrencyForCountry(c),
      "usd",
      `${c} should fall back to USD`,
    );
  }
});

test("currency normalises case and trims whitespace", () => {
  assert.equal(pickCurrencyForCountry("au"), "aud");
  assert.equal(pickCurrencyForCountry(" NZ "), "nzd");
  assert.equal(pickCurrencyForCountry(""), "usd");
  assert.equal(pickCurrencyForCountry(undefined), "usd");
  assert.equal(pickCurrencyForCountry(null), "usd");
});

test("country is read from x-vercel-ip-country header", () => {
  const headers = new Headers({ "x-vercel-ip-country": "NZ" });
  assert.equal(readCountryFromHeaders(headers), "NZ");

  const empty = new Headers();
  assert.equal(readCountryFromHeaders(empty), undefined);

  const whitespace = new Headers({ "x-vercel-ip-country": "   " });
  assert.equal(readCountryFromHeaders(whitespace), undefined);
});

test("isSupportedCurrency matches Price object currency_options", () => {
  for (const c of ["usd", "aud", "nzd", "eur", "gbp", "cad"]) {
    assert.equal(isSupportedCurrency(c), true);
    assert.equal(isSupportedCurrency(c.toUpperCase()), true);
  }
  for (const c of ["sek", "dkk", "jpy", "inr"]) {
    assert.equal(isSupportedCurrency(c), false);
  }
});

test("public env values are trimmed before client-side script injection", () => {
  const env = getPublicEnv({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_123\n",
    NEXT_PUBLIC_APP_URL: "https://astroroast.com\n",
  });

  assert.equal(env.stripePublishableKey, "pk_live_123");
  assert.equal(env.appUrl, "https://astroroast.com");
});

test("Sentry init options trim DSN and keep production sampling conservative", () => {
  const options = buildSentryInitOptions({
    dsn: " https://public@example.ingest.sentry.io/123 \n",
    environment: " production ",
    release: " astro-roasts@1.0.0 ",
    nodeEnv: "production",
  });

  assert.equal(options.dsn, "https://public@example.ingest.sentry.io/123");
  assert.equal(options.environment, "production");
  assert.equal(options.release, "astro-roasts@1.0.0");
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.tracesSampleRate, 0.1);
});

test("Sentry init options sample development traces fully", () => {
  const options = buildSentryInitOptions({
    dsn: "https://public@example.ingest.sentry.io/123",
    nodeEnv: "development",
  });

  assert.equal(options.tracesSampleRate, 1);
});

test("birth location resolution accepts free-form place and country", () => {
  const location = resolveBirthLocation("Some tiny town, Somewhere");

  assert.equal(location.city, "Some tiny town, Somewhere");
  assert.equal(location.knownCoordinates, false);
  assert.equal(location.lat, 0);
  assert.equal(location.lon, 0);
  assert.equal(location.tz, "UTC");
});

test("birth location resolution keeps exact data for known cities", () => {
  const location = resolveBirthLocation("Wellington, New Zealand");

  assert.equal(location.knownCoordinates, true);
  assert.equal(location.tz, "Pacific/Auckland");
});

test("roast runner payload sends raw birth data instead of calculated chart text", () => {
  const payload = buildRoastRunnerPayload({
    name: "Charlotte",
    date: "1992-08-29",
    time: "04:10",
    birthPlace: "Munich, Germany",
  });

  assert.deepEqual(payload, {
    name: "Charlotte",
    date: "1992-08-29",
    time: "04:10",
    birthPlace: "Munich, Germany",
    hasBirthTime: true,
  });
  assert.equal("chartData" in payload, false);
});

test("chart placements are extracted from natal_chart.py formatted output", () => {
  const placements = extractChartPlacements(`
PLANET POSITIONS
────────────────
  Sun              05°47' Virgo             1st
  Moon             18°51' Virgo             1st
  Mercury          24°11' Leo              12th
  Venus            16°11' Libra             2nd
  Mars             11°05' Gemini           10th
  Jupiter          15°54' Cancer           11th
  Saturn           24°01' Capricorn         5th Rx
  ──────────────── ────────────────────── ─────
  Ascendant        11°14' Virgo             1st
`);

  assert.deepEqual(placements, {
    sunSign: "Virgo",
    moonSign: "Virgo",
    rising: "Virgo",
    mercurySign: "Leo",
    venusSign: "Libra",
    marsSign: "Gemini",
    jupiterSign: "Cancer",
    saturnSign: "Capricorn",
  });
});
