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
import { handleChartAnnotations } from "./chart-annotations.js";

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

// ─── DM agent: one in-voice conversational turn on the subscription ────────
// The webhook (Vercel) posts {history, latestText}; we run one fast claude
// turn and return the raw action JSON. Validation happens on the web side.

const DM_MODEL = process.env.DM_AGENT_MODEL || "claude-sonnet-5";
const DM_TIMEOUT_MS = Number(process.env.DM_AGENT_TIMEOUT_MS || 45_000);
const ANNOTATION_MODEL = process.env.ANNOTATION_MODEL || DM_MODEL;

const DM_SYSTEM_PROMPT = `you are astroroasted — the instagram account that writes savage, scarily accurate comedic natal chart roasts. you are talking in instagram DMs.

voice: lowercase. dry. quick. funny-from-truth, never cruel-for-cruelty. no emoji unless one lands hard. absolutely no AI-slop phrasing ("I'd be happy to", "cosmic bestie", "vibes", "let's dive in", exclamation-mark enthusiasm). you sound like a sharp friend who happens to read charts, not a chatbot.

your one goal: collect what you need for a roast, then fire it.
- solo roast needs: name, date of birth, place of birth. birth time is optional (better with it). gender/pronouns optional — ask once, casually.
- "roast us" / partner talk → couple roast: the same details for BOTH people.
- family → 3-6 people, same details each.

rules:
- extract details from however they naturally type them ("im sarah, 12 may 94, london" is fine). resolve dates to YYYY-MM-DD when confident; if ambiguous (2/3/94), ask which.
- ask for AT MOST what's missing, in one short message. never send forms or bullet-point templates.
- when you have enough for a roast, use a generate action. your confirm message stays in voice ("locked. pulling your chart now — this'll take a couple of minutes. brace.").
- price only if asked: solo €5, couple €8, family €4 a head after the first two. the link they get shows a free teaser first.
- if they ask what this is: a personalized comedic roast of their actual natal chart, free teaser, they'll see.
- keep replies 1-2 short DM messages max. this is instagram, not email.
- never claim to be human. never break voice to apologise as an assistant.

OUTPUT FORMAT — reply with ONE raw JSON object and NOTHING else (no fences, no commentary):
  {"action":"reply","messages":["..."]}
  {"action":"generate_solo","person":{"name":"...","gender":"...","date":"YYYY-MM-DD","time":"HH:MM"|null,"birthPlace":"city, country"},"confirmMessage":"..."}
  {"action":"generate_group","relationship":"couple"|"family","people":[{...same person shape...}],"confirmMessage":"..."}`;

function buildDmAgentPrompt({ history, latestText }) {
  const turns = Array.isArray(history) ? history : [];
  const lines = turns
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .slice(-12)
    .map(
      (t) =>
        `${t.role === "assistant" ? "astroroasted" : "them"}: ${t.text.trim()}`,
    );
  const last = lines[lines.length - 1] || "";
  if (!last.startsWith("them:") || !last.includes(String(latestText).trim())) {
    lines.push(`them: ${String(latestText).trim()}`);
  }
  return `conversation so far:\n\n${lines.join("\n")}\n\nrespond with your action JSON now.`;
}

function extractJsonObject(stdout) {
  const trimmed = stdout.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function handleDmAgent(body, send) {
  const { history, latestText } = body || {};
  if (typeof latestText !== "string" || !latestText.trim()) {
    return send(400, { error: "missing_fields" });
  }

  const startedAt = Date.now();
  const run = await runClaude({
    userPrompt: buildDmAgentPrompt({ history, latestText }),
    systemPrompt: DM_SYSTEM_PROMPT,
    model: DM_MODEL,
    tools: "",
    timeoutMs: DM_TIMEOUT_MS,
  });

  if (run.code !== 0) {
    if (isRateLimit(run.stderr, run.stdout)) {
      return send(503, {
        error: "rate_limited",
        durationMs: Date.now() - startedAt,
      });
    }
    console.error("dm_agent_failed", {
      code: run.code,
      stderr: run.stderr.slice(0, 300),
    });
    return send(500, {
      error: "claude_failed",
      durationMs: Date.now() - startedAt,
    });
  }

  const action = extractJsonObject(run.stdout);
  if (!action) {
    console.error("dm_agent_bad_json", { preview: run.stdout.slice(0, 300) });
    return send(500, {
      error: "bad_output",
      durationMs: Date.now() - startedAt,
    });
  }

  return send(200, { action, durationMs: Date.now() - startedAt });
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
${people.map((_, i) => `---CHART_${i + 1}_START---\n<person ${i + 1} full chart text>\n---CHART_${i + 1}_END---`).join("\n\n")}
---ROAST_START---
<the group roast prose — no TITLE/TEASER/FULL/CALLOUTS fields>
---ROAST_END---
No commentary outside the markers.`;
}

// ─── claude subprocess ─────────────────────────────────────────────────────

function runClaude({ userPrompt, systemPrompt, model, tools, timeoutMs }) {
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
    }, timeoutMs || TIMEOUT_MS);

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

// ─── Fast chart endpoint ────────────────────────────────────────────────────
// Deterministic natal_chart.py --json run — no LLM. ~1s. Used by the site's
// loading screen to render the d3 wheel while the slow roast generates.

function intIn(v, lo, hi) {
  return Number.isInteger(v) && v >= lo && v <= hi;
}

function validateChartInput(b) {
  if (!intIn(b.year, 1800, 2100)) return "year";
  if (!intIn(b.month, 1, 12)) return "month";
  if (!intIn(b.day, 1, 31)) return "day";
  if (b.hour != null && !intIn(b.hour, 0, 23)) return "hour";
  if (b.minute != null && !intIn(b.minute, 0, 59)) return "minute";
  if (typeof b.lat !== "number" || !Number.isFinite(b.lat) || Math.abs(b.lat) > 90) return "lat";
  if (typeof b.lon !== "number" || !Number.isFinite(b.lon) || Math.abs(b.lon) > 180) return "lon";
  if (typeof b.tz !== "string" || b.tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(b.tz)) return "tz";
  if (b.name != null && (typeof b.name !== "string" || b.name.length > 80)) return "name";
  return null;
}

function handleChart(body, send) {
  const bad = validateChartInput(body);
  if (bad) {
    return send(400, { error: "invalid_input", detail: bad });
  }

  const args = [
    NATAL_CHART_PATH, "--json",
    "--name", body.name || "Friend",
    "--year", String(body.year),
    "--month", String(body.month),
    "--day", String(body.day),
    "--lat", String(body.lat),
    "--lon", String(body.lon),
    "--tz", body.tz,
  ];
  if (body.hour != null) {
    args.push("--hour", String(body.hour), "--minute", String(body.minute ?? 0));
  }

  const proc = spawn(PYTHON_BIN, args, {
    timeout: 15_000,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d) => (stdout += d.toString()));
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  proc.on("error", (err) => {
    send(502, { error: "chart_failed", detail: String(err).slice(0, 500) });
  });
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error("chart_failed", { code, stderr: stderr.slice(0, 300) });
      return send(502, { error: "chart_failed", detail: stderr.slice(0, 500) });
    }
    try {
      return send(200, JSON.parse(stdout));
    } catch {
      console.error("chart_parse_failed", { stdout: stdout.slice(0, 300) });
      return send(502, { error: "chart_failed", detail: "bad_json_from_script" });
    }
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
  if (
    req.method !== "POST" ||
    (req.url !== "/roast" &&
      req.url !== "/dm-agent" &&
      req.url !== "/chart" &&
      req.url !== "/chart-annotations")
  ) {
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

  if (req.url === "/chart") {
    return handleChart(body, send);
  }

  if (req.url === "/dm-agent") {
    return handleDmAgent(body, send);
  }

  if (req.url === "/chart-annotations") {
    return handleChartAnnotations(body, send, runClaude, ANNOTATION_MODEL);
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
          relationship:
            (typeof relationship === "string" && relationship.trim()) ||
            "couple",
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
    if (charts.some((c) => !c)) {
      return send(500, {
        error: "missing_structured_output",
        detail: write.stdout.slice(0, 1000),
        durationMs: Date.now() - startedAt,
      });
    }
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
