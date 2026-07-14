import { test } from "node:test";
import assert from "node:assert";
import { generateChartAnnotations } from "../lib/chart-annotations.ts";
import type { NatalChart } from "../lib/types.ts";

const chart = {
  schema: 1,
  name: "Oliver",
  birth: {
    date: "1994-01-21",
    time: "13:00",
    timeKnown: false,
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
  planets: [
    {
      name: "Sun",
      lon: 301,
      sign: "Aquarius",
      degInSign: 1,
      house: null,
      retrograde: false,
      speed: 1,
    },
  ],
  angles: null,
  houses: null,
  aspects: [],
  elements: { Fire: [], Earth: [], Air: ["Sun"], Water: [] },
  modalities: { Cardinal: [], Fixed: ["Sun"], Mutable: [] },
  stelliums: { bySign: {}, byHouse: {} },
  configurations: [],
} satisfies NatalChart;

test("requests annotations from the authenticated Hermes endpoint", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const annotations = await generateChartAnnotations(chart, "The full roast.", {
    runnerUrl: "https://runner.example/",
    runnerSecret: "secret",
    fetchImpl: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return Response.json({
        lines: [
          { id: "planet:Sun", line: "  Your rebellion has office hours.  " },
          { id: "planet:Unknown", line: "Ignored." },
        ],
      });
    },
  });

  assert.equal(requestUrl, "https://runner.example/chart-annotations");
  assert.equal(
    (requestInit?.headers as Record<string, string>).Authorization,
    "Bearer secret",
  );
  const payload = JSON.parse(String(requestInit?.body));
  assert.equal(payload.roastText, "The full roast.");
  assert.equal(payload.elements[0].id, "planet:Sun");
  assert.equal(
    annotations["planet:Sun"].line,
    "Your rebellion has office hours.",
  );
  assert.equal(annotations["planet:Unknown"], undefined);
});

test("rejects missing runner configuration", async () => {
  await assert.rejects(
    generateChartAnnotations(chart, "The full roast.", {
      runnerUrl: "",
      runnerSecret: "",
      fetchImpl: fetch,
    }),
    /runner not configured/i,
  );
});

test("rejects non-OK runner responses", async () => {
  await assert.rejects(
    generateChartAnnotations(chart, "The full roast.", {
      runnerUrl: "https://runner.example",
      runnerSecret: "secret",
      fetchImpl: async () => Response.json({ error: "claude_failed" }, { status: 502 }),
    }),
    /runner failed \(502\)/i,
  );
});
