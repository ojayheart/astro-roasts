import { test } from "node:test";
import assert from "node:assert/strict";
import {
  birthDetailsChanged,
  chartSlotFor,
  planChartRefresh,
  refreshChartsAfterBirthChange,
  type CachedRoast,
  type RefreshPorts,
  type SubjectRow,
} from "../lib/birth-refresh.ts";
import type { NatalChart } from "../lib/types.ts";

const ME = "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
const THEM = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const BIRTH = {
  dob: "1992-03-14",
  birthTime: "09:15",
  birthCity: "Munich, Germany",
};

/** Minimal NatalChart shapes — only identity matters to these assertions. */
const chart = (tag: string) => ({ schema: 1, tag }) as unknown as NatalChart;
const OLD = chart("old");
const OTHER = chart("partner");
const FRESH = chart("fresh");

function roast(over: Partial<CachedRoast> = {}): CachedRoast {
  return {
    id: "roast-1",
    userId: ME,
    chartJson: OLD,
    subjectCharts: null,
    chartAnnotations: null,
    ...over,
  };
}

test("only a real correction counts as a change", () => {
  assert.equal(birthDetailsChanged(null, BIRTH), true);
  assert.equal(birthDetailsChanged(BIRTH, BIRTH), false);
  assert.equal(
    birthDetailsChanged(BIRTH, { ...BIRTH, birthTime: "09:16" }),
    true,
  );
  assert.equal(birthDetailsChanged(BIRTH, { ...BIRTH, birthTime: null }), true);
  assert.equal(
    birthDetailsChanged(BIRTH, { ...BIRTH, birthCity: "Vienna, Austria" }),
    true,
  );
  assert.equal(
    birthDetailsChanged(BIRTH, { ...BIRTH, dob: "1992-03-15" }),
    true,
  );
});

test("a solo roast is slot 0 for its owner and nobody else", () => {
  assert.equal(chartSlotFor(ME, roast(), []), 0);
  assert.equal(chartSlotFor(THEM, roast(), []), null);
});

test("a duo roast uses position order, owner or not", () => {
  const subjects: SubjectRow[] = [
    { roastId: "roast-1", userId: THEM, position: 0 },
    { roastId: "roast-1", userId: ME, position: 1 },
  ];
  const duo = roast({ userId: THEM });
  assert.equal(chartSlotFor(ME, duo, subjects), 1);
  assert.equal(chartSlotFor(THEM, duo, subjects), 0);
  assert.equal(chartSlotFor("someone-else", duo, subjects), null);
});

test("the fresh chart overwrites the old one instead of blanking it", () => {
  const plans = planChartRefresh(ME, [roast()], [], FRESH);
  assert.deepEqual(plans, [
    { roastId: "roast-1", chartJson: FRESH, clearAnnotations: false },
  ]);
  // The plan never carries a null chart — a wheel is never emptied.
  assert.equal(plans[0].chartJson, FRESH);
});

test("stale wheel copy is dropped so the existing queue rebuilds it", () => {
  const plans = planChartRefresh(
    ME,
    [roast({ chartAnnotations: { "planet:Sun": { line: "old" } } })],
    [],
    FRESH,
  );
  assert.equal(plans[0].clearAnnotations, true);
});

test("a duo roast swaps only the changed person's chart", () => {
  const subjects: SubjectRow[] = [
    { roastId: "roast-1", userId: THEM, position: 0 },
    { roastId: "roast-1", userId: ME, position: 1 },
  ];
  const plans = planChartRefresh(
    ME,
    [roast({ userId: THEM, chartJson: OTHER, subjectCharts: [OTHER, OLD] })],
    subjects,
    FRESH,
  );
  assert.deepEqual(plans, [
    {
      roastId: "roast-1",
      subjectCharts: [OTHER, FRESH],
      clearAnnotations: false,
    },
  ]);
});

test("a roast with nothing cached and a roast that is not theirs are skipped", () => {
  const plans = planChartRefresh(
    ME,
    [
      roast({ id: "never-viewed", chartJson: null }),
      roast({ id: "theirs", userId: THEM }),
    ],
    [],
    FRESH,
  );
  assert.deepEqual(plans, []);
});

function ports(over: Partial<RefreshPorts> = {}): RefreshPorts {
  return {
    cachedCharts: async () => ({ roasts: [roast()], subjects: [] }),
    cast: async () => FRESH,
    applyRefresh: async () => {},
    queueAnnotations: async () => true,
    ...over,
  };
}

test("a birth change recasts the chart and rewrites the cache", async () => {
  const applied: string[] = [];
  let cast = 0;
  const result = await refreshChartsAfterBirthChange(
    ME,
    { name: "Oliver", ...BIRTH },
    ports({
      cachedCharts: async () => ({
        roasts: [roast({ chartAnnotations: { "planet:Sun": {} } })],
        subjects: [],
      }),
      cast: async () => {
        cast += 1;
        return FRESH;
      },
      applyRefresh: async (plan) => {
        assert.equal(plan.chartJson, FRESH);
        assert.equal(plan.clearAnnotations, true);
        applied.push(plan.roastId);
      },
    }),
  );

  assert.equal(cast, 1, "one runner cast for the whole account");
  assert.deepEqual(applied, ["roast-1"]);
  assert.deepEqual(result, {
    recomputed: true,
    refreshed: ["roast-1"],
    requeued: ["roast-1"],
  });
});

test("a failed recast writes nothing — the old wheel keeps drawing", async () => {
  let wrote = false;
  let queued = false;
  const result = await refreshChartsAfterBirthChange(
    ME,
    { name: "Oliver", ...BIRTH },
    ports({
      cast: async () => null,
      applyRefresh: async () => {
        wrote = true;
      },
      queueAnnotations: async () => {
        queued = true;
        return true;
      },
    }),
  );

  assert.equal(wrote, false);
  assert.equal(queued, false);
  assert.deepEqual(result, { recomputed: false, refreshed: [], requeued: [] });
});

test("a roast with no cached annotations is refreshed but not requeued", async () => {
  let queued = 0;
  const result = await refreshChartsAfterBirthChange(
    ME,
    { name: "Oliver", ...BIRTH },
    ports({
      queueAnnotations: async () => {
        queued += 1;
        return true;
      },
    }),
  );

  assert.equal(queued, 0, "no model call is queued for a wheel with no lines");
  assert.deepEqual(result.refreshed, ["roast-1"]);
  assert.deepEqual(result.requeued, []);
});

test("no roasts means no runner call at all", async () => {
  let cast = 0;
  const result = await refreshChartsAfterBirthChange(
    ME,
    { name: "Oliver", ...BIRTH },
    ports({
      cachedCharts: async () => ({ roasts: [], subjects: [] }),
      cast: async () => {
        cast += 1;
        return FRESH;
      },
    }),
  );
  assert.equal(cast, 0);
  assert.equal(result.recomputed, false);
});
