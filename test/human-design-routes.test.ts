import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PAIRS,
  GATE_CENTRE,
  CENTRES,
  centreOutline,
  channelPath,
} from "../lib/human-design-graph.js";
type Point = { x: number; y: number };
const inside = (p: Point, v: Point[]) => {
  let yes = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i],
      b = v[j];
    if (
      a.y > p.y != b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
};
test("all channel routes avoid unrelated centre interiors", () => {
  const fail = [];
  for (const [a, b] of PAIRS) {
    const n = channelPath(a, b)
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    for (const id of Object.keys(CENTRES)) {
      if ([GATE_CENTRE[a], GATE_CENTRE[b]].includes(id)) continue;
      const v = centreOutline(id);
      for (let i = 1; i < 200; i++) {
        const t = i / 200,
          s = 1 - t,
          p = {
            x:
              s * s * s * n[0] +
              3 * s * s * t * n[2] +
              3 * s * t * t * n[4] +
              t * t * t * n[6],
            y:
              s * s * s * n[1] +
              3 * s * s * t * n[3] +
              3 * s * t * t * n[5] +
              t * t * t * n[7],
          };
        if (inside(p, v)) {
          fail.push(`${a}-${b} crosses ${id}`);
          break;
        }
      }
    }
  }
  assert.deepEqual(fail, []);
});
