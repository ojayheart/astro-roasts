import { test } from "node:test";
import assert from "node:assert";
import {
  angularDifference,
  computeSynastry,
  synastryAspectId,
} from "../lib/synastry.ts";
import type { NatalChart, NatalPlanet } from "../lib/types.ts";

function planet(name: string, lon: number): NatalPlanet {
  return {
    name,
    lon,
    sign: "Aries",
    degInSign: lon % 30,
    house: null,
    retrograde: false,
    speed: 1,
  };
}

function chartOf(name: string, planets: NatalPlanet[], withAngles = false) {
  return {
    schema: 1,
    name,
    birth: {
      date: "1994-01-21",
      time: null,
      timeKnown: withAngles,
      utc: "",
      tz: "Pacific/Auckland",
      lat: 0,
      lon: 0,
      dayOfWeek: "Friday",
      moonPhase: "",
      moonPhaseAngle: 0,
      sect: null,
      chartRuler: null,
      houseSystem: "",
    },
    planets,
    angles: withAngles
      ? {
          ascendant: { lon: 10, sign: "Aries", degInSign: 10 },
          mc: { lon: 280, sign: "Capricorn", degInSign: 10 },
          partOfFortune: null,
        }
      : null,
    houses: null,
    aspects: [],
    elements: { Fire: [], Earth: [], Air: [], Water: [] },
    modalities: { Cardinal: [], Fixed: [], Mutable: [] },
    stelliums: { bySign: {}, byHouse: {} },
    configurations: [],
  } as unknown as NatalChart;
}

test("measures the shortest way round the circle", () => {
  assert.equal(angularDifference(10, 40), 30);
  assert.equal(angularDifference(350, 10), 20);
  assert.equal(angularDifference(0, 180), 180);
  assert.equal(angularDifference(0, 270), 90);
});

test("finds an exact cross-chart square", () => {
  const a = chartOf("A", [planet("Moon", 100)]);
  const b = chartOf("B", [planet("Mars", 190)]);

  const [aspect] = computeSynastry(a, b);
  assert.equal(aspect.a, "Moon");
  assert.equal(aspect.b, "Mars");
  assert.equal(aspect.type, "square");
  assert.equal(aspect.orb, 0);
  assert.equal(aspect.strength, 5);
});

test("grants luminaries the wider orb natal_chart.py gives them", () => {
  // 9 degrees off a conjunction: inside the Sun's 8+2, outside Mars-Saturn's 8.
  const withSun = computeSynastry(
    chartOf("A", [planet("Sun", 0)]),
    chartOf("B", [planet("Saturn", 9)]),
  );
  assert.equal(withSun.length, 1);
  assert.equal(withSun[0].type, "conjunction");

  const withoutSun = computeSynastry(
    chartOf("A", [planet("Mars", 0)]),
    chartOf("B", [planet("Saturn", 9)]),
  );
  assert.deepEqual(withoutSun, []);
});

test("keeps both directions — whose Saturn lands on whose Sun matters", () => {
  const a = chartOf("A", [planet("Sun", 0), planet("Saturn", 100)]);
  const b = chartOf("B", [planet("Sun", 100), planet("Saturn", 0)]);

  const aspects = computeSynastry(a, b);
  const conjunctions = aspects.filter((x) => x.type === "conjunction");

  // A-Sun on B-Saturn, and A-Saturn on B-Sun. Two distinct statements.
  assert.equal(conjunctions.length, 2);
  assert.deepEqual(conjunctions.map((x) => `${x.a}/${x.b}`).sort(), [
    "Saturn/Sun",
    "Sun/Saturn",
  ]);
});

test("sorts tightest orb first so the top slice is the loudest", () => {
  const a = chartOf("A", [planet("Venus", 0), planet("Mercury", 0)]);
  const b = chartOf("B", [planet("Mars", 5), planet("Jupiter", 1)]);

  const orbs = computeSynastry(a, b).map((x) => x.orb);
  assert.deepEqual(
    orbs,
    [...orbs].sort((p, q) => p - q),
  );
  assert.equal(orbs[0], 1);
});

test("includes the angles only when the birth time is known", () => {
  // A is timed: Ascendant 10, MC 280. B's Sun at 55 aspects neither.
  const timed = chartOf("A", [planet("Sun", 200)], true);
  const untimedFar = chartOf("B", [planet("Sun", 55)]);

  const angleNames = (aspects: { a: string; b: string }[]) =>
    aspects.filter(
      (x) =>
        ["Ascendant", "MC"].includes(x.a) || ["Ascendant", "MC"].includes(x.b),
    );

  assert.deepEqual(angleNames(computeSynastry(timed, untimedFar)), []);

  // An untimed chart contributes no angle points in either position.
  const bothUntimed = computeSynastry(
    chartOf("A", [planet("Sun", 10)]),
    chartOf("B", [planet("Sun", 10)]),
  );
  assert.deepEqual(angleNames(bothUntimed), []);

  // Put B's Sun on A's Ascendant and the contact shows up.
  const hit = computeSynastry(timed, chartOf("B", [planet("Sun", 10)]));
  assert.equal(
    hit.some((x) => x.a === "Ascendant" && x.type === "conjunction"),
    true,
  );
});

test("ignores bodies natal_chart.py does not aspect", () => {
  const a = chartOf("A", [planet("Lilith", 0), planet("N.Node", 0)]);
  const b = chartOf("B", [planet("Sun", 0)]);
  assert.deepEqual(computeSynastry(a, b), []);
});

test("builds a stable id per aspect", () => {
  assert.equal(
    synastryAspectId({
      a: "Moon",
      b: "Mars",
      type: "square",
      orb: 0,
      strength: 5,
    }),
    "synastry:Moon-square-Mars",
  );
});
