import { test } from "node:test";
import assert from "node:assert/strict";
import { spaceChartLabels } from "../lib/chart-label-spacing.ts";
test("separates labels that straddle 0 degrees without altering longitudes", () => {
  const planets = [
    { name: "A", lon: 358 },
    { name: "B", lon: 1 },
    { name: "C", lon: 3 },
  ];
  const result = spaceChartLabels(planets);
  const values = [...result.values()].sort((a, b) => a - b);
  for (let i = 0; i < values.length; i++) {
    const next =
      values[(i + 1) % values.length] + (i === values.length - 1 ? 360 : 0);
    assert.ok(next - values[i] >= 7.5 - 1e-8);
  }
  assert.deepEqual(
    planets.map((p) => p.lon),
    [358, 1, 3],
  );
});
test("keeps already spaced positions and handles empty charts", () => {
  assert.equal(spaceChartLabels([]).size, 0);
  assert.deepEqual(
    [
      ...spaceChartLabels([
        { name: "A", lon: 30 },
        { name: "B", lon: 180 },
      ]).values(),
    ].sort((a, b) => a - b),
    [30, 180],
  );
});
