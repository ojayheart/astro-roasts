import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIBED_STATUSES,
  hasActiveSubscription,
  isSubscribedRow,
} from "../lib/entitlement-rule.ts";

const NOW = new Date("2026-08-10T12:00:00Z");
const FUTURE = new Date("2026-09-10T12:00:00Z");
const PAST = new Date("2026-07-10T12:00:00Z");

test("trial, active and grace all count as subscribed", () => {
  assert.deepEqual([...SUBSCRIBED_STATUSES], ["trial", "active", "grace"]);
  for (const status of SUBSCRIBED_STATUSES) {
    assert.equal(isSubscribedRow({ status, expiresAt: FUTURE }, NOW), true);
  }
});

test("no other status counts, however fresh the expiry", () => {
  for (const status of ["expired", "refunded", "cancelled", ""]) {
    assert.equal(isSubscribedRow({ status, expiresAt: FUTURE }, NOW), false);
  }
});

test("a lapsed expiry is not entitlement", () => {
  assert.equal(
    isSubscribedRow({ status: "active", expiresAt: PAST }, NOW),
    false,
  );
  assert.equal(
    isSubscribedRow({ status: "active", expiresAt: NOW }, NOW),
    false,
  );
});

test("a null expiry is not entitlement", () => {
  assert.equal(
    isSubscribedRow({ status: "active", expiresAt: null }, NOW),
    false,
  );
});

test("no row means not subscribed", () => {
  assert.equal(isSubscribedRow(undefined, NOW), false);
  assert.equal(hasActiveSubscription([], NOW), false);
});

test("one live row among dead ones is enough", () => {
  assert.equal(
    hasActiveSubscription(
      [
        { status: "expired", expiresAt: PAST },
        { status: "grace", expiresAt: FUTURE },
      ],
      NOW,
    ),
    true,
  );
});

test("timestamps arriving as strings are compared as dates", () => {
  assert.equal(
    isSubscribedRow({ status: "active", expiresAt: FUTURE.toISOString() }, NOW),
    true,
  );
});
