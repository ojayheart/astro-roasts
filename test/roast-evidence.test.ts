import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareRoastEvidence } from "../lib/roast-evidence.ts";
import { buildRoastRunnerPayload, buildGroupRunnerPayload } from "../lib/roast-runner.ts";
import { roastWritingPolicy } from "../ops/hermes-roast-runner/roast-evidence.js";
import type { NatalChart } from "../lib/types";

const subject = { name: "Test", dob: "1994-01-21", birthTime: "13:00", birthCity: "Wellington, NZ" };
const chart = { schema: 1, birth: { timeKnown: true, utc: "1994-01-21T00:00:00Z", tz: "Pacific/Auckland", lat: -41.3, lon: 174.8 } } as NatalChart;

test("writer receives real HD computed from resolved UTC, not local wall time", async () => {
  const evidence = await prepareRoastEvidence(subject, async () => chart);
  assert.equal(evidence.status, "calculated");
  if (evidence.status !== "calculated") return;
  assert.equal(evidence.humanDesign.birthUTC, "1994-01-21T00:00:00.000Z");
  assert.equal(evidence.humanDesign.type, "Manifesting Generator");
  assert.equal(evidence.humanDesign.profile, "5/1");
  const payload = buildRoastRunnerPayload({ roastId: "test", name: subject.name, gender: "", date: subject.dob, time: subject.birthTime, birthPlace: subject.birthCity, evidence });
  const policy = roastWritingPolicy(payload);
  assert.ok(policy.includes(JSON.stringify(evidence)));
  assert.match(policy, /Default to ZERO/);
  assert.match(policy, /natal chart only is superseded/);
});

test("unknown birth time never calls either calculator", async () => {
  const fail = async () => { throw new Error("must not run"); };
  assert.deepEqual(await prepareRoastEvidence({ ...subject, birthTime: null }, fail, fail), { status: "unknown-time" });
});

test("known-time calculation failures retry instead of silently losing HD", async () => {
  await assert.rejects(prepareRoastEvidence(subject, async () => null), /Could not calculate/);
  await assert.rejects(prepareRoastEvidence({ ...subject, birthTime: "25:15" }), /Invalid birth time/);
  await assert.rejects(prepareRoastEvidence(subject, async () => ({ ...chart, birth: { ...chart.birth, utc: "badZ" } })), /birth instant/);
});

test("same-name group members retain their own evidence, including unknown time", async () => {
  const first = await prepareRoastEvidence(subject, async () => chart);
  const second = await prepareRoastEvidence({ ...subject, birthTime: null });
  const person = { name: "Same", gender: "", date: subject.dob, time: subject.birthTime, birthPlace: subject.birthCity };
  const payload = buildGroupRunnerPayload({ roastId: "test", relationship: "friends", people: [{ ...person, evidence: first }, { ...person, time: null, evidence: second }] });
  const policy = roastWritingPolicy(payload);
  const entries = JSON.parse(policy.split("PRIVATE CALCULATED EVIDENCE (do not reproduce in customer prose):\n")[1]);
  assert.deepEqual(entries.map((entry: {person: number; evidence: {status: string}}) => [entry.person, entry.evidence.status]), [[1, "calculated"], [2, "unknown-time"]]);
});
