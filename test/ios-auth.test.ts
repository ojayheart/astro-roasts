import { test } from "node:test";
import assert from "node:assert";
import { CODE_WINDOW_MS, checkCode, codeFor, currentCode, normalizeEmail, signToken, verifyToken, TOKEN_TTL_MS } from "../lib/ios-auth.ts";

const KEY = "test-secret-test-secret-test-secret";

test("emails are normalised and validated", () => {
  assert.equal(normalizeEmail("  Mara@Example.COM "), "mara@example.com");
  for (const bad of ["", "nope", "a@b", "a b@c.com", 42, null, "x".repeat(260) + "@a.com"]) assert.equal(normalizeEmail(bad), null);
});

test("codes are 6 digits, stable inside a window, different across emails and windows", () => {
  const now = 1_800_000_000_000;
  const a = currentCode("a@x.com", now, KEY);
  assert.match(a, /^\d{6}$/);
  assert.equal(currentCode("a@x.com", now + 1000, KEY), a);
  assert.notEqual(currentCode("b@x.com", now, KEY), a);
  assert.notEqual(codeFor("a@x.com", Math.floor(now / CODE_WINDOW_MS) + 5, KEY), a);
});

test("a code works for the current and previous window only", () => {
  const now = 1_800_000_000_000;
  const code = currentCode("a@x.com", now, KEY);
  assert.equal(checkCode("a@x.com", code, now, KEY), true);
  assert.equal(checkCode("a@x.com", code, now + CODE_WINDOW_MS, KEY), true);            // next window (still the "previous")
  assert.equal(checkCode("a@x.com", code, now + 2 * CODE_WINDOW_MS + 1, KEY), false);   // expired
  assert.equal(checkCode("b@x.com", code, now, KEY), false);                            // wrong email
  assert.equal(checkCode("a@x.com", "000000" === code ? "000001" : "000000", now, KEY), false);
  for (const bad of ["", "12345", "1234567", "abcdef", undefined, 123456]) assert.equal(checkCode("a@x.com", bad, now, KEY), false);
});

test("tokens verify, expire, and reject tampering or another secret", () => {
  const now = 1_800_000_000_000;
  const t = signToken("a@x.com", now, KEY);
  assert.deepEqual(verifyToken(t, now + 1000, KEY), { email: "a@x.com" });
  assert.equal(verifyToken(t, now + TOKEN_TTL_MS + 5000, KEY), null);
  assert.equal(verifyToken(t, now, "another-secret-another-secret-xx"), null);
  const [h, b, s] = t.split(".");
  const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "victim@x.com", exp: 9_999_999_999 })).toString("base64url")}.${s}`;
  assert.equal(verifyToken(forged, now, KEY), null);
  assert.equal(verifyToken("garbage", now, KEY), null);
  assert.equal(verifyToken(`${h}.${b}.`, now, KEY), null);
});
