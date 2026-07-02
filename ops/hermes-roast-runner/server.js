// Roast runner — two-phase.
// Phase 1 (write): compute chart via natal_chart.py + write the roast as pure
//   prose in a bathetic style. No structured fields — keeps the creative call
//   uncontaminated by format scaffolding (which was degrading interpretation).
// Phase 2 (package): cheap call to extract TITLE + CALLOUTS. TEASER/FULL are
//   derived from the prose in code.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.ROAST_RUNNER_SECRET;
const MODEL = process.env.ROAST_MODEL || "claude-opus-4-8";
const TIMEOUT_MS = Number(process.env.ROAST_TIMEOUT_MS || 10 * 60 * 1000);
const PROGRESS_URL = process.env.PROGRESS_CALLBACK_URL || "";
const PYTHON_BIN =
  process.env.ASTRO_PYTHON || "/opt/roast-runner/venv/bin/python3";
const NATAL_CHART_PATH =
  process.env.NATAL_CHART_PATH || join(homedir(), "natal_chart.py");

if (!SECRET) {
  console.error("ROAST_RUNNER_SECRET not set");
  process.exit(1);
}

// ─── Phase 1: chart computation + the proven bathos write ──────────────────

function buildWriteUserPrompt({ name, date, time, birthPlace, hasBirthTime }) {
  return `Invoke the Skill tool now with skill="astro-roast" to load the full skill instructions, then follow them EXACTLY using this birth data:

- Name: ${name}
- Date of birth: ${date}
- Birth time: ${hasBirthTime ? time : "unknown"}
- Place of birth: ${birthPlace}

Resolve messy place input to the best exact place, coordinates, and IANA timezone. Run natal_chart.py, then write the roast from that chart only. If no birth time, do not use houses, Ascendant, MC, or chart ruler. Output EXACTLY the format the skill specifies — no extra commentary, no nested TITLE/TEASER/FULL/CALLOUTS fields inside the roast (those are derived downstream).`;
}

function buildGroupWriteUserPrompt({ relationship, people }) {
  const roster = people
    .map(
      (p, i) => `Person ${i + 1}:
- Name: ${p.name}
- Gender: ${p.gender}
- Date of birth: ${p.date}
- Birth time: ${p.hasBirthTime ? p.time : "unknown"}
- Place of birth: ${p.birthPlace}`,
    )
    .join("\n\n");

  return `Invoke the Skill tool now with skill="astro-roast-group" to load the full skill instructions, then follow them EXACTLY. Relationship type: ${relationship}. The people:

${roster}

Resolve each messy place input to exact coordinates and IANA timezone. Run the synastry engine as the skill instructs, then write ONE group roast of the dynamic. Output format, EXACTLY:
${people.map((_, i) => `---CHART_${i + 1}_START---\n<person ${i + 1} full chart text>\n---CHART_${i + 1}_END---`).join("\n")}
---ROAST_START---
<the group roast prose — no TITLE/TEASER/FULL/CALLOUTS fields>
---ROAST_END---
No commentary outside the markers.`;
}

// ─── claude subprocess ─────────────────────────────────────────────────────

function runClaude({ userPrompt, systemPrompt, model, tools }) {
  return new Promise((resolve) => {
    const args = [
      "-p",
      userPrompt,
      "--model",
      model,
      "--output-format",
      "text",
      "--permission-mode",
      "bypassPermissions",
      "--allowed-tools",
      tools || "",
    ];
    if (systemPrompt) {
      args.push("--append-system-prompt", systemPrompt);
    }
    const proc = spawn("claude", args, {
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        PATH: `/opt/roast-runner/venv/bin:${process.env.PATH || ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

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

function extractMarkedSection(raw, marker) {
  const start = `---${marker}_START---`;
  const end = `---${marker}_END---`;
  if (!raw.includes(start) || !raw.includes(end)) return "";
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

// ─── Progress callback ─────────────────────────────────────────────────────
// Fire-and-forget. Failures must never block the roast. Server clamps to 0–99
// and uses GREATEST so a slow callback can't drag the bar backwards.
async function postProgress(roastId, pct) {
  if (!PROGRESS_URL || !roastId) return;
  try {
    await fetch(PROGRESS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ roastId, pct }),
      // 3s ceiling — never let the callback gum up the main pipeline.
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error("progress_callback_failed", String(err).slice(0, 200));
  }
}

// Background creep during a long-running phase. Returns a stop() function.
// Drips +1 toward `targetCap` every `intervalMs` until stopped or capped.
function startProgressCreep({ roastId, fromPct, toPct, durationMs }) {
  if (!PROGRESS_URL || !roastId) return () => {};
  const steps = Math.max(1, toPct - fromPct);
  const intervalMs = Math.max(1000, Math.floor(durationMs / steps));
  let current = fromPct;
  const timer = setInterval(() => {
    if (current >= toPct) {
      clearInterval(timer);
      return;
    }
    current += 1;
    postProgress(roastId, current);
  }, intervalMs);
  return () => clearInterval(timer);
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
    return send(200, { ok: true, model: MODEL });
  }
  if (req.method !== "POST" || req.url !== "/roast") {
    return send(404, { error: "not_found" });
  }
  if ((req.headers.authorization || "") !== `Bearer ${SECRET}`) {
    return send(401, { error: "unauthorized" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(400, { error: "bad_json" });
  }

  const {
    roastId,
    name,
    date,
    time,
    birthPlace,
    hasBirthTime,
    mode,
    relationship,
    people,
  } = body;
  const isGroup = mode === "group";
  if (isGroup) {
    if (!Array.isArray(people) || people.length < 2 || people.length > 6) {
      return send(400, { error: "missing_fields" });
    }
  } else if (!name || !date || !birthPlace) {
    return send(400, { error: "missing_fields" });
  }

  const startedAt = Date.now();

  // Initial tick so the bar moves the moment the runner accepts the job.
  postProgress(roastId, 8);

  // Phase 1 — write. Background creep 10→70 across the expected ~75s opus run.
  // If the phase finishes faster, the creep stops; if it's slower, the creep
  // caps at 70 and we wait for the real finish to jump to 78.
  const stopWriteCreep = startProgressCreep({
    roastId,
    fromPct: 10,
    toPct: 70,
    durationMs: isGroup ? 150_000 : 75_000,
  });

  const write = await runClaude({
    userPrompt: isGroup
      ? buildGroupWriteUserPrompt({
          relationship: relationship || "couple",
          people,
        })
      : buildWriteUserPrompt({
          name,
          date,
          time,
          birthPlace,
          hasBirthTime: !!hasBirthTime,
        }),
    model: MODEL,
    tools: "Bash,WebSearch,Skill",
  });

  stopWriteCreep();

  if (write.code !== 0) {
    const durationMs = Date.now() - startedAt;
    if (isRateLimit(write.stderr, write.stdout)) {
      console.error("rate_limited", { stderr: write.stderr.slice(0, 500) });
      return send(503, {
        error: "rate_limited",
        detail: write.stderr.slice(0, 1000),
        durationMs,
      });
    }
    console.error("write_failed", {
      code: write.code,
      stderr: write.stderr.slice(0, 500),
    });
    return send(500, {
      error: "claude_failed",
      code: write.code,
      detail: write.stderr.slice(0, 1000),
      durationMs,
    });
  }

  const chartData = extractMarkedSection(write.stdout, "CHART");
  const roastBody = extractMarkedSection(write.stdout, "ROAST");
  if (!roastBody) {
    return send(500, {
      error: "missing_structured_output",
      detail: write.stdout.slice(0, 1000),
      durationMs: Date.now() - startedAt,
    });
  }

  const roast = `---ROAST_START---
${roastBody}
---ROAST_END---`;

  if (isGroup) {
    const charts = people.map((_, i) =>
      extractMarkedSection(write.stdout, `CHART_${i + 1}`),
    );
    const chartData = charts
      .map((c, i) => `=== ${people[i].name} ===\n\n${c}`)
      .join("\n\n");
    return send(200, {
      chartData,
      charts,
      roast,
      durationMs: Date.now() - startedAt,
    });
  }

  return send(200, {
    chartData,
    roast,
    durationMs: Date.now() - startedAt,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`roast-runner listening on :${PORT}, write=${MODEL}`);
});
