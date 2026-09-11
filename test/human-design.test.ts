import { test } from "node:test";
import assert from "node:assert/strict";
import engine from "../lib/vendor/hd-engine.js";
import {
  CENTRES,
  PAIRS,
  GATE_CENTRE,
  derive,
  gatePoint,
  centreOutline,
} from "../lib/human-design-graph.js";
test("reference instant retains all activations and definition", () => {
  const chart = engine.build(1994, 1, 21, 0, 0, "+00:00");
  const model = derive(chart);
  assert.equal(chart.type, "Manifesting Generator");
  assert.equal(chart.authority, "Emotional");
  assert.equal(chart.profile, "5/1");
  assert.equal(chart.definition, "Triple Split");
  assert.equal(Object.keys(model.sources).length, 18);
  assert.equal(model.defined.size, 7);
  assert.equal(model.islands.length, 3);
  assert.deepEqual(model.channels, [
    [61, 24],
    [20, 34],
    [27, 50],
    [19, 49],
  ]);
});
test("all 64 gates attach to their centre shape boundary", () => {
  assert.equal(Object.keys(GATE_CENTRE).length, 64);
  assert.equal(PAIRS.length, 36);
  for (let g = 1; g <= 64; g++) {
    const p = gatePoint(g),
      v = centreOutline(GATE_CENTRE[g]);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    const distances = v.map((a, i) => {
      const b = v[(i + 1) % v.length],
        dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
          ),
        );
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    });
    assert.ok(Math.min(...distances) < 1e-6, `gate ${g}`);
  }
  assert.equal(Object.keys(CENTRES).length, 9);
});
test("single hanging activation defines no centre", () => {
  const m = derive({ personality: { sun: { gate: 61, line: 1 } }, design: {} });
  assert.equal(m.channels.length, 0);
  assert.equal(m.defined.size, 0);
});
test("different birth instants generate distinct charts", () => {
  assert.notDeepEqual(
    engine.build(1994, 1, 21, 0, 0, "+00:00").personality,
    engine.build(2000, 1, 1, 12, 0, "+00:00").personality,
  );
});

test("design instant is 88 solar degrees before birth", () => {
  const birth = new Date("1994-01-21T00:00:00Z");
  const design = engine.designTime(birth);
  const arc =
    (engine.positions(birth).sun - engine.positions(design).sun + 360) % 360;
  assert.ok(Math.abs(arc - 88) < 0.00001);
  assert.ok(design.getTime() < birth.getTime());
});
