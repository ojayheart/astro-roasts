import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDiscount,
  isFreeAfterDiscount,
  lookupPromo,
  parsePromoCodes,
  STRIPE_MIN_MINOR_UNITS,
} from "../lib/promo.ts";

test("parses CODE:percent pairs", () => {
  const m = parsePromoCodes("OLIVER:100,FRIENDS:50");
  assert.equal(m.get("OLIVER"), 100);
  assert.equal(m.get("FRIENDS"), 50);
  assert.equal(m.size, 2);
});

test("skips malformed, zero, negative and over-100 entries", () => {
  const m = parsePromoCodes(
    "GOOD:25,NOPCT,BAD:0,NEG:-10,TOOBIG:101,:50,JUNK:abc",
  );
  assert.deepEqual([...m.entries()], [["GOOD", 25]]);
});

test("empty or missing env yields no codes", () => {
  assert.equal(parsePromoCodes(undefined).size, 0);
  assert.equal(parsePromoCodes("").size, 0);
  assert.equal(lookupPromo("ANYTHING", undefined), null);
});

test("lookup is case- and whitespace-insensitive", () => {
  const raw = "OLIVER:100";
  assert.deepEqual(lookupPromo("  oliver ", raw), {
    code: "OLIVER",
    percentOff: 100,
  });
  assert.deepEqual(lookupPromo("OlIvEr", raw), {
    code: "OLIVER",
    percentOff: 100,
  });
  assert.equal(lookupPromo("WRONG", raw), null);
});

test("lookup rejects non-strings and absurd lengths", () => {
  const raw = "OLIVER:100";
  assert.equal(lookupPromo(undefined, raw), null);
  assert.equal(lookupPromo(42, raw), null);
  assert.equal(lookupPromo({ code: "OLIVER" }, raw), null);
  assert.equal(lookupPromo("X".repeat(41), raw), null);
});

test("discount maths round to whole minor units", () => {
  assert.equal(applyDiscount(500, 100), 0);
  assert.equal(applyDiscount(500, 50), 250);
  assert.equal(applyDiscount(500, 25), 375);
  assert.equal(applyDiscount(800, 50), 400);
  assert.equal(applyDiscount(333, 50), 167); // 166.5 rounds up
});

test("free when 100% off, or when the remainder is under the Stripe minimum", () => {
  assert.equal(isFreeAfterDiscount(500, 100), true);
  assert.equal(isFreeAfterDiscount(500, 95), true); // 25 < 50
  assert.equal(isFreeAfterDiscount(500, 91), true); // 45 < 50
  assert.equal(isFreeAfterDiscount(500, 90), false); // exactly 50 is chargeable
  assert.equal(isFreeAfterDiscount(500, 50), false); // 250 is chargeable
  assert.equal(isFreeAfterDiscount(800, 50), false);
});

test("a partial code cannot zero out a bigger group roast", () => {
  // 50% off a 6-person family roast still leaves a real charge.
  const family = 800 + 400 * 4;
  assert.equal(isFreeAfterDiscount(family, 50), false);
  assert.equal(applyDiscount(family, 50), 1200);
  assert.ok(applyDiscount(family, 50) >= STRIPE_MIN_MINOR_UNITS);
});
