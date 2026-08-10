/**
 * End-to-end dry run: real transits.py -> real runner -> real prompt assembly.
 *
 * Nothing here is a fixture. The transit facts asserted on are read back out of
 * the script's own output and looked for in the assembled Anthropic request.
 * The model is never called — the injected client records the body and stops.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateDaily } from "../lib/subscription-roast.ts";
import type { BirthInput, DailyTransits } from "../lib/transits.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, "..", "ops", "hermes-roast-runner");
const SCRIPT = join(RUNNER, "transits.py");
const PYTHON = process.env.ASTRO_PYTHON || "python3";

// Same fixture chart and date as test/transits.test.ts — Wellington,
// 21 Jan 1994 13:00, read on 2026-08-10.
const BIRTH: BirthInput = {
  name: "Fixture",
  year: 1994,
  month: 1,
  day: 21,
  hour: 13,
  minute: 0,
  lat: -41.2866,
  lon: 174.7762,
  tz: "Pacific/Auckland",
};
const DATE = "2026-08-10";

const HAVE_SWE =
  spawnSync(PYTHON, ["-c", "import swisseph"], { stdio: "ignore" }).status ===
  0;
const opts = { skip: HAVE_SWE ? false : "swisseph not installed" };

/** The same transits.py the runner spawns, run here for comparison. */
function directRun(): DailyTransits {
  const proc = spawnSync(
    PYTHON,
    [
      SCRIPT,
      "--mode",
      "daily",
      "--json",
      "--name",
      BIRTH.name,
      "--year",
      String(BIRTH.year),
      "--month",
      String(BIRTH.month),
      "--day",
      String(BIRTH.day),
      "--lat",
      String(BIRTH.lat),
      "--lon",
      String(BIRTH.lon),
      "--tz",
      BIRTH.tz,
      "--hour",
      String(BIRTH.hour),
      "--minute",
      String(BIRTH.minute),
      "--date",
      DATE,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(proc.status, 0, proc.stderr);
  return JSON.parse(proc.stdout) as DailyTransits;
}

async function freePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0);
  await once(probe, "listening");
  const { port } = probe.address() as { port: number };
  await new Promise((r) => probe.close(r));
  return port;
}

type Recorded = {
  model: string;
  system: { text: string }[];
  messages: { content: string }[];
};

/** Records the assembled request and answers without touching a model. */
function recordingAnthropic(seen: { body?: Recorded }) {
  return {
    messages: {
      create: async (body: unknown) => {
        seen.body = body as Recorded;
        return {
          content: [
            {
              type: "text",
              text: "TITLE: Dry Run\nGOLD: nothing was billed.\nBODY:\nthe request was assembled and stopped there.",
            },
          ],
        };
      },
      batches: {
        create: async () => {
          throw new Error("no batch in a dry run");
        },
        retrieve: async () => ({ processing_status: "ended" }),
        results: async function* () {},
      },
    },
  };
}

test(
  "the daily prompt carries the transit facts transits.py actually computed",
  opts,
  async (t) => {
    const direct = directRun();
    assert.ok(direct.transits.length > 0, "fixture day has no transits at all");

    const port = await freePort();
    const proc = spawn(process.execPath, [join(RUNNER, "server.js")], {
      env: {
        ...process.env,
        PORT: String(port),
        ROAST_RUNNER_SECRET: "dry-run-secret",
        ASTRO_PYTHON: PYTHON,
        TRANSITS_PATH: SCRIPT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => proc.kill("SIGKILL"));
    await once(proc.stdout, "data");

    process.env.ROAST_RUNNER_URL = `http://127.0.0.1:${port}`;
    process.env.ROAST_RUNNER_SECRET = "dry-run-secret";
    process.env.ROAST_MODEL = "claude-opus-5";

    const seen: { body?: Recorded } = {};
    const out = await generateDaily({ birth: BIRTH }, DATE, {
      anthropic: recordingAnthropic(seen),
    });

    // The runner served the script, not a fixture: same ephemeris numbers.
    assert.ok(out, "generateDaily returned null");
    assert.equal(out.transits.date, DATE);
    assert.deepEqual(out.transits.natal, direct.natal);
    assert.deepEqual(
      out.transits.transits.map((h) => h.summary),
      direct.transits.map((h) => h.summary),
    );

    const prompt = seen.body?.messages[0].content ?? "";
    assert.ok(prompt.length > 0, "no prompt reached the model layer");
    assert.equal(seen.body?.model, "claude-opus-5");

    // Facts read back out of the script's own output — an empty or stubbed
    // transit list could not satisfy these.
    const tightest = [...direct.transits].sort(
      (a, b) => a.orb_deg - b.orb_deg,
    )[0];
    assert.ok(prompt.includes(tightest.summary));
    assert.ok(prompt.includes(`orb ${tightest.orb_deg.toFixed(2)}°`));
    assert.ok(prompt.includes(tightest.peak_local.slice(11, 16)));
    assert.ok(prompt.includes(`${DATE} (${BIRTH.tz})`));
    assert.ok(!prompt.includes("nothing tight today"));

    // Every bullet in the prompt names a hit the script really returned.
    const bullets = prompt
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).split(" — ")[0]);
    assert.ok(bullets.length > 0);
    const real = new Set(direct.transits.map((h) => h.summary));
    for (const summary of bullets) assert.ok(real.has(summary), summary);

    // The system prefix is the real cached voice block plus the daily format.
    assert.ok((seen.body?.system.length ?? 0) >= 2);
    assert.match(seen.body?.system[1].text ?? "", /GOLD:/);

    assert.equal(out.roast.title, "Dry Run");
  },
);
