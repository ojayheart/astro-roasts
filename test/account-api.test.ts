import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PURGE_ORDER,
  serveDeleteAccount,
  type AccountPorts,
  type PurgeStep,
} from "../lib/account-api.ts";

const USER_ID = "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
const SUBJECT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function ports(over: Partial<AccountPorts> = {}): AccountPorts {
  return {
    userId: async () => USER_ID,
    subjectIds: async () => [SUBJECT_ID],
    purge: async () => 1,
    ...over,
  };
}

test("no session is 401 and nothing is deleted", async () => {
  let purged = false;
  const reply = await serveDeleteAccount(
    ports({
      userId: async () => null,
      purge: async () => {
        purged = true;
        return 0;
      },
    }),
  );
  assert.deepEqual(reply, { status: 401, body: { error: "unauthorized" } });
  assert.equal(purged, false);
});

test("deletion covers every table that points at users, in FK order", async () => {
  const seen: PurgeStep[] = [];
  const reply = await serveDeleteAccount(
    ports({
      purge: async (step) => {
        seen.push(step);
        return 2;
      },
    }),
  );

  assert.deepEqual(seen, [...PURGE_ORDER]);
  assert.ok(seen.indexOf("roast_subjects") < seen.indexOf("roasts"));
  assert.ok(seen.indexOf("connections") < seen.indexOf("roasts"));
  assert.ok(seen.indexOf("duos") < seen.indexOf("roasts"));
  assert.ok(seen.indexOf("roasts") < seen.indexOf("users"));
  assert.ok(seen.indexOf("referrals") < seen.indexOf("users"));
  assert.equal(seen[seen.length - 1], "users");
  assert.equal(reply.status, 200);
  assert.equal((reply.body as { deleted: boolean }).deleted, true);
  assert.equal((reply.body as { rows: Record<string, number> }).rows.users, 2);
});

test("the purge takes the owner plus the placeholder users their duos invented", async () => {
  const batches: string[][] = [];
  await serveDeleteAccount(
    ports({
      purge: async (_step, ids) => {
        batches.push(ids);
        return 0;
      },
    }),
  );
  assert.equal(batches.length, PURGE_ORDER.length);
  for (const ids of batches) assert.deepEqual(ids, [USER_ID, SUBJECT_ID]);
});

test("an account with no duos purges only itself", async () => {
  const batches: string[][] = [];
  await serveDeleteAccount(
    ports({
      subjectIds: async () => [],
      purge: async (_step, ids) => {
        batches.push(ids);
        return 0;
      },
    }),
  );
  for (const ids of batches) assert.deepEqual(ids, [USER_ID]);
});

test("credentials go last, so a mid-purge failure leaves a retryable account", async () => {
  const order = [...PURGE_ORDER];
  for (const step of ["duos", "roasts", "daily_roasts", "subscriptions"]) {
    assert.ok(order.indexOf(step as PurgeStep) < order.indexOf("sessions"));
  }
  assert.ok(order.indexOf("magic_links") < order.indexOf("users"));
});
