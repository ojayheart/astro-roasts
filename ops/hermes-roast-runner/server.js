// Roast runner - spawn Claude Code headless and require the full astro-roast
// workflow: geolocate, run natal_chart.py, then write the website roast.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.ROAST_RUNNER_SECRET;
const MODEL = process.env.ROAST_MODEL || "claude-opus-4-6";
const TIMEOUT_MS = Number(process.env.ROAST_TIMEOUT_MS || 10 * 60 * 1000);
const SKILL_PATH =
  process.env.SKILL_PATH ||
  join(homedir(), ".claude/skills/astro-roast/SKILL.md");
const PYTHON_BIN =
  process.env.ASTRO_PYTHON || "/opt/roast-runner/venv/bin/python3";
const NATAL_CHART_PATH =
  process.env.NATAL_CHART_PATH || join(homedir(), "natal_chart.py");

let SKILL_BODY = "";
try {
  SKILL_BODY = readFileSync(SKILL_PATH, "utf8");
  console.log(`loaded skill: ${SKILL_BODY.length} bytes`);
} catch (e) {
  console.error(`failed to load skill at ${SKILL_PATH}:`, e);
  process.exit(1);
}

if (!SECRET) {
  console.error("ROAST_RUNNER_SECRET not set");
  process.exit(1);
}

function buildSystemPrompt() {
  return `You are Claude Code running the astro-roast skill for the website.

You MUST use the complete workflow below. Do not infer chart placements from prose.
Geolocate the birth place with WebSearch, then run natal_chart.py with exact
latitude, longitude, and IANA timezone. Use the script output as the only source
of planetary placements.

Use this Python command shape:
${PYTHON_BIN} ${NATAL_CHART_PATH} --name "NAME" --year YYYY --month M --day D --hour H --minute M --lat LAT --lon LON --tz Timezone/Name

If birth time is unavailable, omit --hour and --minute.

Output exactly this combined website format:

---CHART_START---
[paste the full raw natal_chart.py output]
---CHART_END---
---ROAST_START---
TITLE: [one-line devastating title]
TEASER: [first 2-3 paragraphs of the roast, ending mid-sentence]
FULL: [complete roast 1200-1600 words including teaser content]
CALLOUTS: [3-4 devastating one-liners from the roast, pipe-separated]
---ROAST_END---

No markdown code fences. No preamble. No commentary outside those markers.

SPEC:
${SKILL_BODY}`;
}

function buildUserPrompt({ name, date, time, birthPlace, hasBirthTime }) {
  return `Run the astro-roast workflow now.

Birth data:
- Name: ${name}
- Date of birth: ${date}
- Birth time: ${hasBirthTime ? time : "unknown"}
- Place of birth: ${birthPlace}

Requirements:
- Handle messy place/country input by resolving it to the best exact place, country, coordinates, and IANA timezone.
- Run natal_chart.py before writing.
- The CHART block must contain the raw natal_chart.py output.
- The ROAST block must be written from that chart only.
- If no birth time is supplied, do not use houses, Ascendant, MC, or chart ruler in the roast.`;
}

function extractMarkedSection(raw, marker) {
  const start = `---${marker}_START---`;
  const end = `---${marker}_END---`;

  if (!raw.includes(start) || !raw.includes(end)) {
    return "";
  }

  return raw.split(start)[1].split(end)[0].trim();
}

function isRateLimit(stderr, stdout) {
  const blob = (stderr + stdout).toLowerCase();
  return (
    blob.includes("rate_limit") ||
    blob.includes("rate limit") ||
    blob.includes("usage limit") ||
    blob.includes("quota") ||
    blob.includes("429")
  );
}

function runClaude(userPrompt, systemPrompt) {
  return new Promise((resolve) => {
    const proc = spawn(
      "claude",
      [
        "-p",
        userPrompt,
        "--model",
        MODEL,
        "--output-format",
        "text",
        "--permission-mode",
        "bypassPermissions",
        "--allowed-tools",
        "Bash,WebSearch",
        "--append-system-prompt",
        systemPrompt,
      ],
      {
        env: {
          ...process.env,
          FORCE_COLOR: "0",
          PATH: `/opt/roast-runner/venv/bin:${process.env.PATH || ""}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5000);
    }, TIMEOUT_MS);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: "", stderr: String(err) });
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    return send(200, {
      ok: true,
      model: MODEL,
      skillPath: SKILL_PATH,
      natalChartPath: NATAL_CHART_PATH,
      python: PYTHON_BIN,
    });
  }

  if (req.method !== "POST" || req.url !== "/roast") {
    return send(404, { error: "not_found" });
  }

  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${SECRET}`) {
    return send(401, { error: "unauthorized" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(400, { error: "bad_json" });
  }

  const { name, date, time, birthPlace, hasBirthTime } = body;
  if (!name || !date || !birthPlace) {
    return send(400, { error: "missing_fields" });
  }

  const startedAt = Date.now();
  const userPrompt = buildUserPrompt({
    name,
    date,
    time,
    birthPlace,
    hasBirthTime: !!hasBirthTime,
  });
  const systemPrompt = buildSystemPrompt();
  const { code, stdout, stderr } = await runClaude(userPrompt, systemPrompt);
  const durationMs = Date.now() - startedAt;

  if (code !== 0) {
    if (isRateLimit(stderr, stdout)) {
      console.error("rate_limited", { stderr: stderr.slice(0, 500) });
      return send(503, {
        error: "rate_limited",
        detail: stderr.slice(0, 1000),
        durationMs,
      });
    }
    console.error("claude_failed", { code, stderr: stderr.slice(0, 500) });
    return send(500, {
      error: "claude_failed",
      code,
      detail: stderr.slice(0, 1000),
      durationMs,
    });
  }

  const chartData = extractMarkedSection(stdout, "CHART");
  const roast = extractMarkedSection(stdout, "ROAST");

  if (!chartData || !roast) {
    return send(500, {
      error: "missing_structured_output",
      detail: stdout.slice(0, 1000),
      durationMs,
    });
  }

  return send(200, {
    output: stdout,
    chartData,
    roast: `---ROAST_START---\n${roast}\n---ROAST_END---`,
    durationMs,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`roast-runner listening on :${PORT}, model=${MODEL}`);
});
