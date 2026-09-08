import { test } from "node:test";
import assert from "node:assert/strict";
import { startRoastPolling } from "../lib/roast-polling.ts";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a roast still generating after three minutes can complete without a false error", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let status = "generating";
  const seen: string[] = [];
  const stop = startRoastPolling(async () => ({ status }), (r) => seen.push(r.status), () => true);
  t.mock.timers.tick(182_000);
  await flush();
  assert.deepEqual(seen, ["generating"]);
  status = "ready";
  t.mock.timers.tick(2000);
  await flush();
  assert.deepEqual(seen, ["generating", "ready"]);
  stop();
});

test("network errors retry; server errors terminate polling", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let calls = 0;
  const seen: string[] = [];
  const stop = startRoastPolling(async () => {
    if (++calls === 1) throw new Error("offline");
    return { status: "error" };
  }, (r) => seen.push(r.status), () => true);
  t.mock.timers.tick(2000);
  await flush();
  assert.deepEqual(seen, []);
  t.mock.timers.tick(2000);
  await flush();
  t.mock.timers.tick(2000);
  await flush();
  assert.deepEqual(seen, ["error"]);
  assert.equal(calls, 2);
  stop();
});

test("hidden pages pause; overlapping and cancelled reads cannot update the page", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let visible = false;
  let calls = 0;
  let resolve!: (r: {status: string}) => void;
  const seen: string[] = [];
  const stop = startRoastPolling(() => {
    calls++;
    return new Promise<{status: string}>((done) => { resolve = done; });
  }, (r) => seen.push(r.status), () => visible);
  t.mock.timers.tick(2000);
  assert.equal(calls, 0);
  visible = true;
  t.mock.timers.tick(6000);
  assert.equal(calls, 1);
  stop();
  resolve({status: "ready"});
  await flush();
  assert.deepEqual(seen, []);
});
