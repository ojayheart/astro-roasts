import test from "node:test";
import assert from "node:assert/strict";
import { formatPrice, pickCurrencyForCountry } from "../lib/currency.ts";

test("formatPrice uses the local symbol, not a hardcoded euro", () => {
  assert.equal(formatPrice(500, "usd"), "$5");
  assert.equal(formatPrice(500, "eur"), "€5");
  assert.equal(formatPrice(500, "gbp"), "£5");
  // narrowSymbol keeps NZD/AUD/CAD as a plain dollar sign — same number
  // everywhere, local symbol.
  assert.equal(formatPrice(500, "nzd"), "$5");
  assert.equal(formatPrice(500, "aud"), "$5");
  assert.equal(formatPrice(400, "eur"), "€4");
  assert.equal(formatPrice(800, "nzd"), "$8");
});

test("formatPrice keeps cents only when the amount has them", () => {
  assert.equal(formatPrice(550, "usd"), "$5.50");
  assert.equal(formatPrice(500, "usd"), "$5");
});

test("formatPrice falls back to USD for unsupported codes", () => {
  assert.equal(formatPrice(500, "jpy"), "$5");
  assert.equal(formatPrice(500, ""), "$5");
});

test("country → currency mapping matches the payment routes", () => {
  assert.equal(pickCurrencyForCountry("NZ"), "nzd");
  assert.equal(pickCurrencyForCountry("de"), "eur");
  assert.equal(pickCurrencyForCountry("US"), "usd");
  assert.equal(pickCurrencyForCountry(undefined), "usd");
});
