import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildDailyPrompt,
  buildForecastPrompt,
  collectForecastBatch,
  forecastBatchItems,
  generateDaily,
  generateForecast,
  parseDaily,
  parseForecast,
  submitForecastBatch,
} from "../lib/subscription-roast.ts";
import { buildVoiceBlock } from "../lib/roast-model.ts";
import { VOICE_PRESETS } from "../inngest/prompts.ts";
import type {
  BirthInput,
  CalendarTransits,
  DailyTransits,
} from "../lib/transits.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const BIRTH: BirthInput = {
  name: "Test",
  year: 1994,
  month: 1,
  day: 21,
  hour: 13,
  minute: 0,
  lat: -41.2866,
  lon: 174.7762,
  tz: "Pacific/Auckland",
};

const DAILY: DailyTransits = {
  mode: "daily",
  name: "Test",
  date: "2026-08-10",
  tz: "Pacific/Auckland",
  has_birth_time: true,
  natal: { Sun: 300.7 },
  transits: [
    {
      summary: "Saturn square natal Moon",
      transiter: "Saturn",
      aspect: "square",
      target: "Moon",
      peak_local: "2026-08-10T19:05:00+12:00",
      peak_utc: "2026-08-10T07:05:00+00:00",
      orb_deg: 0.9,
      applying: true,
    },
    {
      summary: "Mars trine natal Saturn",
      transiter: "Mars",
      aspect: "trine",
      target: "Saturn",
      peak_local: "2026-08-10T11:35:00+12:00",
      peak_utc: "2026-08-09T23:35:00+00:00",
      orb_deg: 0.01,
      applying: false,
    },
  ],
};

const MONTH: CalendarTransits = {
  mode: "month",
  name: "Test",
  start: "2026-09-01",
  end: "2026-09-30",
  tz: "Pacific/Auckland",
  has_birth_time: false,
  natal: { Sun: 300.7 },
  events: [
    {
      summary: "Pluto opposition natal Venus",
      transiter: "Pluto",
      aspect: "opposition",
      target: "Venus",
      start_local: "2026-09-04T00:00:00+12:00",
      end_local: "2026-09-19T00:00:00+12:00",
      peak_local: "2026-09-11T00:00:00+12:00",
      peak_orb_deg: 0.2,
    },
  ],
};

const DAILY_OUTPUT = `TITLE: Saturn Has Notes
GOLD: today is the day the group chat stops covering for you.
BODY:
the square lands at seven and you will feel it as admin.`;

const FORECAST_OUTPUT = `TITLE: A Month Of Being Perceived
HIGHLIGHTS:
- 11 Sep: the Pluto-Venus peak
- mid-month clarity
AVOID:
- signing anything on the 4th
BODY:
september opens with a slow grind.

it closes with you pretending it was your idea.`;

function fakeAnthropic(recorder: { body?: unknown; batch?: unknown } = {}) {
  return {
    recorder,
    client: {
      messages: {
        create: async (body: unknown) => {
          recorder.body = body;
          return { content: [{ type: "text", text: DAILY_OUTPUT }] };
        },
        batches: {
          create: async (body: unknown) => {
            recorder.batch = body;
            return { id: "batch_9" };
          },
          retrieve: async () => ({ processing_status: "ended" }),
          results: async function* () {
            yield {
              custom_id: "month:u1:2026-09",
              result: {
                type: "succeeded",
                message: { content: [{ type: "text", text: FORECAST_OUTPUT }] },
              },
            };
            yield {
              custom_id: "month:u2:2026-09",
              result: { type: "errored", error: { message: "overloaded" } },
            };
          },
        },
      },
    },
  };
}

/** Runner stand-in — asserts the request and answers with transit JSON. */
function fakeRunnerFetch(
  payload: unknown,
  recorder: { url?: string; body?: Record<string, unknown> },
) {
  return (async (url: string | URL, init?: RequestInit) => {
    recorder.url = String(url);
    recorder.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as unknown as typeof fetch;
}

test("the daily prompt leads with the tightest hit", () => {
  const prompt = buildDailyPrompt(DAILY);
  const first = prompt.indexOf("Mars trine natal Saturn");
  const second = prompt.indexOf("Saturn square natal Moon");
  assert.ok(first > 0 && first < second);
  assert.match(prompt, /2026-08-10 \(Pacific\/Auckland\)/);
  assert.ok(!prompt.includes("no birth time"));
});

test("a missing birth time is stated in the forecast prompt", () => {
  assert.match(buildForecastPrompt(MONTH), /no birth time/);
  assert.match(buildForecastPrompt(MONTH), /2026-09-01 to 2026-09-30/);
});

test("parseDaily splits title, gold line and body", () => {
  const roast = parseDaily(DAILY_OUTPUT);
  assert.equal(roast.title, "Saturn Has Notes");
  assert.match(roast.goldLine, /^today is the day/);
  assert.equal(
    roast.body,
    "the square lands at seven and you will feel it as admin.",
  );
});

test("parseForecast keeps highlights and avoid as lists", () => {
  const forecast = parseForecast(FORECAST_OUTPUT);
  assert.equal(forecast.title, "A Month Of Being Perceived");
  assert.deepEqual(forecast.highlights, [
    "11 Sep: the Pluto-Venus peak",
    "mid-month clarity",
  ]);
  assert.deepEqual(forecast.avoid, ["signing anything on the 4th"]);
  assert.match(forecast.body, /^september opens/);
  assert.match(forecast.body, /your idea\.$/);
});

test("generateDaily reads the runner then writes through roast-model", async () => {
  process.env.ROAST_RUNNER_URL = "https://runner.test";
  process.env.ROAST_RUNNER_SECRET = "s3cret";
  const seen: { url?: string; body?: Record<string, unknown> } = {};
  const anthropic = fakeAnthropic();

  const out = await generateDaily({ birth: BIRTH }, "2026-08-10", {
    anthropic: anthropic.client,
    fetch: fakeRunnerFetch(DAILY, seen),
  });

  assert.equal(seen.url, "https://runner.test/transits");
  assert.equal(seen.body?.mode, "daily");
  assert.equal(seen.body?.date, "2026-08-10");
  assert.equal(seen.body?.tz, "Pacific/Auckland");
  assert.equal(out?.roast.title, "Saturn Has Notes");
  assert.equal(out?.transits.date, "2026-08-10");

  const body = anthropic.recorder.body as {
    model: string;
    system: { text: string; cache_control?: unknown }[];
    messages: { content: string }[];
  };
  assert.equal(body.model, "claude-opus-5");
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.match(body.messages[0].content, /Mars trine natal Saturn/);
});

test("a runner failure yields null rather than an invented roast", async () => {
  process.env.ROAST_RUNNER_URL = "https://runner.test";
  process.env.ROAST_RUNNER_SECRET = "s3cret";
  const failing = (async () =>
    new Response("boom", { status: 502 })) as unknown as typeof fetch;
  const out = await generateForecast(
    { birth: BIRTH },
    { kind: "month", year: 2026, month: 9 },
    { anthropic: fakeAnthropic().client, fetch: failing },
  );
  assert.equal(out, null);
});

test("forecast batch items key back to the caller's custom id", async () => {
  const items = forecastBatchItems([
    { customId: "month:u1:2026-09", transits: MONTH },
  ]);
  assert.equal(items[0].customId, "month:u1:2026-09");
  assert.equal(items[0].voice?.hasBirthTime, false);

  const anthropic = fakeAnthropic();
  const { batchId } = await submitForecastBatch(
    [{ customId: "month:u1:2026-09", transits: MONTH }],
    { anthropic: anthropic.client },
  );
  assert.equal(batchId, "batch_9");
  const batch = anthropic.recorder.batch as {
    requests: { custom_id: string; params: { system: { text: string }[] } }[];
  };
  assert.equal(batch.requests[0].custom_id, "month:u1:2026-09");
  assert.match(batch.requests[0].params.system[1].text, /HIGHLIGHTS:/);

  const collected = await collectForecastBatch("batch_9", {
    anthropic: anthropic.client,
  });
  assert.equal(collected[0].forecast?.title, "A Month Of Being Perceived");
  assert.equal(collected[1].error, "overloaded");
});

test("an unknown voice preset falls back to cold-literary", () => {
  assert.ok(
    buildVoiceBlock({ voicePreset: "no-such-preset" }).includes(
      VOICE_PRESETS["cold-literary"],
    ),
  );
});

async function freePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0);
  await once(probe, "listening");
  const { port } = probe.address() as { port: number };
  await new Promise((r) => probe.close(r));
  return port;
}

test("the runner's /transits endpoint uses the natal_chart.py convention", async (t) => {
  const port = await freePort();
  const proc = spawn(
    process.execPath,
    [join(HERE, "..", "ops", "hermes-roast-runner", "server.js")],
    {
      env: {
        ...process.env,
        PORT: String(port),
        ROAST_RUNNER_SECRET: "s3cret",
        ASTRO_PYTHON: process.execPath,
        TRANSITS_PATH: join(HERE, "fixtures", "echo-args.js"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => proc.kill("SIGKILL"));
  await once(proc.stdout, "data");

  const res = await fetch(`http://127.0.0.1:${port}/transits`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer s3cret",
    },
    body: JSON.stringify({ ...BIRTH, mode: "daily", date: "2026-08-10" }),
  });
  assert.equal(res.status, 200);
  const { argv } = (await res.json()) as { argv: string[] };
  assert.deepEqual(argv, [
    "--mode",
    "daily",
    "--json",
    "--name",
    "Test",
    "--year",
    "1994",
    "--month",
    "1",
    "--day",
    "21",
    "--lat",
    "-41.2866",
    "--lon",
    "174.7762",
    "--tz",
    "Pacific/Auckland",
    "--hour",
    "13",
    "--minute",
    "0",
    "--date",
    "2026-08-10",
  ]);

  const bad = await fetch(`http://127.0.0.1:${port}/transits`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer s3cret",
    },
    body: JSON.stringify({ ...BIRTH, mode: "month" }),
  });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).detail, "mode");
});
