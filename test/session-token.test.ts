import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerToken, isSessionLive } from "../lib/session-token.ts";

const NOW = new Date("2026-08-10T12:00:00Z");

test("bearer token is pulled out of the header, scheme case-insensitively", () => {
  assert.equal(bearerToken("Bearer abc123"), "abc123");
  assert.equal(bearerToken("bearer abc123"), "abc123");
  assert.equal(bearerToken("  Bearer   abc123  "), "abc123");
});

test("anything that is not a lone bearer token is no token at all", () => {
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken(""), null);
  assert.equal(bearerToken("abc123"), null);
  assert.equal(bearerToken("Basic abc123"), null);
  assert.equal(bearerToken("Bearer "), null);
  assert.equal(bearerToken("Bearer a b"), null);
});

test("a session is live only while its expiry is ahead of now", () => {
  const userId = "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
  assert.equal(
    isSessionLive({ userId, expiresAt: "2026-08-11T00:00:00Z" }, NOW),
    true,
  );
  assert.equal(
    isSessionLive({ userId, expiresAt: new Date("2026-08-09T00:00:00Z") }, NOW),
    false,
  );
  assert.equal(isSessionLive({ userId, expiresAt: NOW }, NOW), false);
  assert.equal(isSessionLive({ userId, expiresAt: null }, NOW), false);
  assert.equal(isSessionLive(undefined, NOW), false);
});
