import { test } from "node:test";
import assert from "node:assert";
import {
  buildGroupRunnerPayload,
  extractGroupCharts,
} from "../lib/roast-runner.ts";

const people = [
  {
    name: "A",
    gender: "man",
    date: "1994-01-21",
    time: "13:00",
    birthPlace: "Wellington, NZ",
  },
  {
    name: "B",
    gender: "woman",
    date: "1992-08-29",
    time: null,
    birthPlace: "Munich, Germany",
  },
];

test("group payload shape", () => {
  const p = buildGroupRunnerPayload({
    roastId: "r1",
    relationship: "couple",
    people,
  });
  assert.equal(p.mode, "group");
  assert.equal(p.relationship, "couple");
  assert.equal(p.people.length, 2);
  assert.equal(p.people[0].hasBirthTime, true);
  assert.equal(p.people[1].hasBirthTime, false);
});

test("extractGroupCharts pulls numbered sections in order", () => {
  const raw = [
    "---CHART_1_START---",
    "chart one",
    "---CHART_1_END---",
    "---CHART_2_START---",
    "chart two",
    "---CHART_2_END---",
    "---ROAST_START---",
    "the roast",
    "---ROAST_END---",
  ].join("\n");
  assert.deepEqual(extractGroupCharts(raw, 2), ["chart one", "chart two"]);
});

test("missing chart section yields empty string, not throw", () => {
  const raw = "---CHART_1_START---\nonly one\n---CHART_1_END---";
  assert.deepEqual(extractGroupCharts(raw, 2), ["only one", ""]);
});
