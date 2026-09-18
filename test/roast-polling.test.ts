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

test("a stalled status request is retried without failing the roast or accepting stale errors", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const requests: Array<{ signal: AbortSignal; resolve: (r: { status: string }) => void }> = [];
  const seen: string[] = [];
  const stop = startRoastPolling((signal) => new Promise<{ status: string }>((resolve) => {
    requests.push({ signal, resolve });
  }), (r) => seen.push(r.status), () => true);

  t.mock.timers.tick(2000);
  t.mock.timers.tick(15_000);
  assert.equal(requests[0].signal.aborted, true);
  assert.deepEqual(seen, []);

  t.mock.timers.tick(2000);
  assert.equal(requests.length, 2);
  requests[0].resolve({ status: "error" });
  await flush();
  assert.deepEqual(seen, []);

  // The stale request's cleanup must not unlock an overlapping third read.
  t.mock.timers.tick(2000);
  assert.equal(requests.length, 2);
  requests[1].resolve({ status: "ready" });
  await flush();
  assert.deepEqual(seen, ["ready"]);
  t.mock.timers.tick(20_000);
  assert.equal(requests.length, 2);
  stop();
});

test("repeated request timeouts have no overall generation deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let ready = false;
  let timeouts = 0;
  const seen: string[] = [];
  const stop = startRoastPolling((signal) => {
    if (ready) return Promise.resolve({ status: "ready" });
    return new Promise<{ status: string }>((_, reject) => {
      signal.addEventListener("abort", () => {
        timeouts++;
        reject(new Error("request timed out"));
      }, { once: true });
    });
  }, (r) => seen.push(r.status), () => true);

  for (let i = 0; i < 60; i++) {
    t.mock.timers.tick(2000);
    t.mock.timers.tick(15_000);
    await flush();
  }
  assert.ok(timeouts >= 50);
  assert.deepEqual(seen, []);
  ready = true;
  t.mock.timers.tick(20_000);
  await flush();
  t.mock.timers.tick(2000);
  await flush();
  assert.deepEqual(seen, ["ready"]);
  stop();
});

test("leaving the loader aborts the in-flight request and clears retries", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let signal!: AbortSignal;
  let calls = 0;
  const stop = startRoastPolling((requestSignal) => {
    signal = requestSignal;
    calls++;
    return new Promise<{ status: string }>(() => {});
  }, () => assert.fail("cancelled request must not update the page"), () => true);
  t.mock.timers.tick(2000);
  stop();
  assert.equal(signal.aborted, true);
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(calls, 1);
});
