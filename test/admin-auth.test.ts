import assert from "node:assert/strict";
import { test } from "node:test";
import {
  signAdminToken,
  verifyAdminToken,
  timingSafeEqualStr,
  ADMIN_COOKIE,
  SESSION_TTL_MS,
} from "../lib/admin-auth.ts";

const SECRET = "test-secret-key";

test("signed token verifies with the same secret", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  assert.equal(await verifyAdminToken(token, SECRET, now), true);
});

test("token fails with a different secret", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  assert.equal(await verifyAdminToken(token, "wrong-secret", now), false);
});

test("expired token fails", async () => {
  const exp = 1_000_000;
  const token = await signAdminToken(exp, SECRET);
  assert.equal(await verifyAdminToken(token, SECRET, exp + 1), false);
});

test("tampered payload fails", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  const tampered = `${now + SESSION_TTL_MS + 999}.${token.split(".")[1]}`;
  assert.equal(await verifyAdminToken(tampered, SECRET, now), false);
});

test("undefined / malformed token fails", async () => {
  assert.equal(await verifyAdminToken(undefined, SECRET, 0), false);
  assert.equal(await verifyAdminToken("garbage", SECRET, 0), false);
  assert.equal(await verifyAdminToken("123.", SECRET, 0), false);
});

test("timingSafeEqualStr", () => {
  assert.equal(timingSafeEqualStr("abc", "abc"), true);
  assert.equal(timingSafeEqualStr("abc", "abd"), false);
  assert.equal(timingSafeEqualStr("abc", "abcd"), false);
});

test("constants", () => {
  assert.equal(ADMIN_COOKIE, "admin_session");
  assert.equal(SESSION_TTL_MS, 2_592_000_000);
});
