import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { getPublicEnv } from "../lib/env.ts";
import { resolveBirthLocation } from "../lib/location.ts";
import { createMemoryRateLimiter } from "../lib/rate-limit.ts";
import { buildRoastPayload } from "../lib/roast-response.ts";
import { verifyPaddleTransaction } from "../lib/paddle.ts";

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

test("Paddle transaction verification rejects unexpected prices", () => {
  const secret = "secret";
  const rawBody = JSON.stringify({
    event_type: "transaction.completed",
    data: {
      custom_data: { roastId: "roast-1" },
      items: [{ price: { id: "pri_wrong" } }],
    },
  });
  const ts = "1770000000";
  const h1 = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const result = verifyPaddleTransaction({
    rawBody,
    signature: `ts=${ts};h1=${h1}`,
    secret,
    expectedPriceId: "pri_expected",
    nowSeconds: Number(ts),
  });

  assert.equal(result.ok, false);
});

test("Paddle transaction verification returns roast id for valid payment", () => {
  const secret = "secret";
  const rawBody = JSON.stringify({
    event_type: "transaction.completed",
    data: {
      custom_data: { roastId: "roast-1" },
      items: [{ price: { id: "pri_expected" } }],
    },
  });
  const ts = "1770000000";
  const h1 = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const result = verifyPaddleTransaction({
    rawBody,
    signature: `ts=${ts};h1=${h1}`,
    secret,
    expectedPriceId: "pri_expected",
    nowSeconds: Number(ts),
  });

  assert.deepEqual(result, { ok: true, roastId: "roast-1" });
});

test("public env values are trimmed before client-side script injection", () => {
  const env = getPublicEnv({
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_token\n",
    NEXT_PUBLIC_PADDLE_PRICE_ID: "pri_123\n",
    NEXT_PUBLIC_PADDLE_ENVIRONMENT: "production\n",
  });

  assert.equal(env.paddleClientToken, "live_token");
  assert.equal(env.paddlePriceId, "pri_123");
  assert.equal(env.paddleEnvironment, "production");
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
