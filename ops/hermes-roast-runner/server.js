// Roast runner — two-phase.
// Phase 1 (write): compute chart via natal_chart.py + write the roast as pure
//   prose in a bathetic style. No structured fields — keeps the creative call
//   uncontaminated by format scaffolding (which was degrading interpretation).
// Phase 2 (package): cheap call to extract TITLE + CALLOUTS. TEASER/FULL are
//   derived from the prose in code.

import { roastWritingPolicy } from "./roast-evidence.js";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleChartAnnotations } from "./chart-annotations.js";
import { CLAUDE_MODEL, hasCalculatedChart, loadRoastSkill, runClaude } from "./claude.js";
import { handleEnrichAgent } from "./enrich-agent.js";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.ROAST_RUNNER_SECRET;
const MODEL = process.env.ROAST_CLAUDE_MODEL || CLAUDE_MODEL;
// Medium writes the same roast in about 60% of the time of high (65 s against
// 106 s for a solo roast, measured 2026-11-16).
const EFFORT = process.env.ROAST_CLAUDE_EFFORT || "medium";
const TIMEOUT_MS = Number(process.env.ROAST_TIMEOUT_MS || 10 * 60 * 1000);
const PROGRESS_URL = process.env.PROGRESS_CALLBACK_URL || "";
const PYTHON_BIN =
  process.env.ASTRO_PYTHON || "/opt/roast-runner/venv/bin/python3";
const NATAL_CHART_PATH =
  process.env.NATAL_CHART_PATH || join(homedir(), "natal_chart.py");
const TRANSITS_PATH =
  process.env.TRANSITS_PATH || join(homedir(), "transits.py");
const SYNASTRY_PATH =
  process.env.SYNASTRY_PATH || join(homedir(), "synastry_offline.py");

if (!SECRET) {
  console.error("ROAST_RUNNER_SECRET not set");
  process.exit(1);
}

// ─── DM agent: one in-voice conversational turn on the subscription ────────
// The webhook (Vercel) posts {history, latestText}; we run one Claude
// turn and return the raw action JSON. Validation happens on the web side.

const DM_MODEL = process.env.DM_CLAUDE_MODEL || MODEL;
const DM_TIMEOUT_MS = Number(process.env.DM_AGENT_TIMEOUT_MS || 45_000);
const ANNOTATION_MODEL = process.env.ANNOTATION_CLAUDE_MODEL || DM_MODEL;

// DM replies and chart annotations are short and latency-bound: low effort.
const runQuick = (options) => runClaude({ ...options, effort: "low" });

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
  const run = await runQuick({
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
  return `Follow the supplied Astro Roast skill instructions EXACTLY using this birth data:

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

  return `Follow the supplied Astro Roast Group skill instructions EXACTLY. Relationship type: ${relationship}. The people:

${roster}

Resolve each messy place input to exact coordinates and IANA timezone. Run the synastry engine as the skill instructs, then write ONE group roast of the dynamic. Use the actual returned schema (synastry crossAspects and overlays); never invent composite placements absent from the calculation. Also run natal_chart.py for each person and put its full raw text in that person's CHART marker below. Output format, EXACTLY:
${people.map((_, i) => `---CHART_${i + 1}_START---\n<person ${i + 1} full chart text>\n---CHART_${i + 1}_END---`).join("\n\n")}
---ROAST_START---
<the group roast prose — no TITLE/TEASER/FULL/CALLOUTS fields>
---ROAST_END---
No commentary outside the markers. The ROAST block must contain only the comedic reading: no geocoding, coordinates, timezone explanations, links, citations, engine or schema descriptions, tool status, or calculation caveats. All technical metadata belongs in the CHART blocks.`;
}

// ─── Fast path: the runner calculates, the model only writes ───────────────
// When the web side already resolved the birthplace, the charts are cast here
// in about a second. The writer then needs no tools, no lookup turns and does
// not copy the chart back out. Any gap returns null and the tool path runs.

function chartInput(person) {
  const place = person.coords || person.evidence?.birth;
  const [year, month, day] = String(person.date).split("-").map(Number);
  const [hour, minute] = person.hasBirthTime
    ? String(person.time).split(":").map(Number)
    : [null, null];
  const input = {
    name: person.name,
    year,
    month,
    day,
    hour,
    minute,
    lat: place?.lat,
    lon: place?.lon,
    tz: place?.tz,
  };
  return validateChartInput(input) ? null : input;
}

function runPython(args, input = "") {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, args, {
      timeout: 20_000,
      killSignal: "SIGKILL",
      stdio: ["pipe", "pipe", "ignore"],
    });
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.on("error", () => resolve(""));
    proc.on("close", (code) => resolve(code === 0 ? stdout.trim() : ""));
    proc.stdin.on("error", () => {});
    proc.stdin.end(input);
  });
}

async function precalculate(subjects, isGroup) {
  const inputs = subjects.map(chartInput);
  if (inputs.some((input) => !input)) return null;
  const [synastry, ...charts] = await Promise.all([
    isGroup
      ? runPython(
          [SYNASTRY_PATH],
          JSON.stringify({
            people: inputs.map(({ hour, minute, ...rest }) =>
              hour == null ? rest : { ...rest, hour, minute },
            ),
          }),
        )
      : "",
    ...inputs.map((input) => runPython([NATAL_CHART_PATH, ...birthArgs(input)])),
  ]);
  if (charts.some((chart) => !hasCalculatedChart(chart))) return null;
  if (isGroup && !synastry.startsWith('{"schema"')) return null;
  return { charts, synastry };
}

function buildFastWriteUserPrompt({ subjects, isGroup, relationship, charts, synastry }) {
  const people = subjects
    .map(
      (p, i) => `Person ${i + 1}:
- Name: ${p.name}${p.gender ? `\n- Gender: ${p.gender}` : ""}
- Date of birth: ${p.date}
- Birth time: ${p.hasBirthTime ? p.time : "unknown"}
- Place of birth: ${p.birthPlace}

natal_chart.py output for person ${i + 1}:
${charts[i]}`,
    )
    .join("\n\n");
  return `Follow the supplied ${isGroup ? "Astro Roast Group" : "Astro Roast"} skill instructions EXACTLY for the reading and the voice. The lookup and calculation steps of the workflow are already done: the calculator output below is final, so do not ask for tools and do not recalculate.${isGroup ? ` Relationship type: ${relationship}. Write ONE group roast of the dynamic. Use the actual returned schema (synastry crossAspects and overlays); never invent composite placements absent from the calculation.` : ""} For anyone with no birth time, do not use houses, Ascendant, MC, or chart ruler.

${people}${isGroup ? `\n\nsynastry_offline.py output:\n${synastry}` : ""}

Output format, EXACTLY:
---ROAST_START---
<the roast prose — no TITLE/TEASER/FULL/CALLOUTS fields>
---ROAST_END---
No commentary outside the markers and no copy of the chart. The ROAST block must contain only the comedic reading: no coordinates, timezone explanations, links, citations, engine or schema descriptions, or calculation caveats.`;
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
  if (
    typeof b.lat !== "number" ||
    !Number.isFinite(b.lat) ||
    Math.abs(b.lat) > 90
  )
    return "lat";
  if (
    typeof b.lon !== "number" ||
    !Number.isFinite(b.lon) ||
    Math.abs(b.lon) > 180
  )
    return "lon";
  if (
    typeof b.tz !== "string" ||
    b.tz.length > 64 ||
    !/^[A-Za-z0-9_+\-/]+$/.test(b.tz)
  )
    return "tz";
  if (b.name != null && (typeof b.name !== "string" || b.name.length > 80))
    return "name";
  return null;
}

function birthArgs(body) {
  const args = [
    "--name",
    body.name || "Friend",
    "--year",
    String(body.year),
    "--month",
    String(body.month),
    "--day",
    String(body.day),
    "--lat",
    String(body.lat),
    "--lon",
    String(body.lon),
    "--tz",
    body.tz,
  ];
  if (body.hour != null) {
    args.push(
      "--hour",
      String(body.hour),
      "--minute",
      String(body.minute ?? 0),
    );
  }
  return args;
}

function runPythonJson({ args, timeoutMs, error }, send) {
  const proc = spawn(PYTHON_BIN, args, {
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d) => (stdout += d.toString()));
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  proc.on("error", (err) => {
    send(502, { error, detail: String(err).slice(0, 500) });
  });
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(error, { code, stderr: stderr.slice(0, 300) });
      return send(502, { error, detail: stderr.slice(0, 500) });
    }
    try {
      return send(200, JSON.parse(stdout));
    } catch {
      console.error(`${error}_parse`, { stdout: stdout.slice(0, 300) });
      return send(502, { error, detail: "bad_json_from_script" });
    }
  });
}

function handleChart(body, send) {
  const bad = validateChartInput(body);
  if (bad) {
    return send(400, { error: "invalid_input", detail: bad });
  }
  return runPythonJson(
    {
      args: [NATAL_CHART_PATH, "--json", ...birthArgs(body)],
      timeoutMs: 15_000,
      error: "chart_failed",
    },
    send,
  );
}

// ─── Transits endpoint ──────────────────────────────────────────────────────
// Deterministic transits.py run, same birth-argument convention as /chart.
// Daily/monthly/yearly generation reads this, then writes through the metered
// API in lib/roast-model.ts — never the claude CLI.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function transitArgs(body) {
  if (body.mode === "daily") {
    if (!ISO_DATE.test(String(body.date))) return null;
    return ["--date", body.date];
  }
  if (body.mode === "month") {
    if (!intIn(body.targetYear, 1800, 2100)) return null;
    if (!intIn(body.targetMonth, 1, 12)) return null;
    return [
      "--target-year",
      String(body.targetYear),
      "--target-month",
      String(body.targetMonth),
    ];
  }
  if (body.mode === "year") {
    if (!ISO_DATE.test(String(body.start))) return null;
    return ["--start", body.start];
  }
  return null;
}

function handleTransits(body, send) {
  const bad = validateChartInput(body);
  if (bad) {
    return send(400, { error: "invalid_input", detail: bad });
  }
  const period = transitArgs(body);
  if (!period) {
    return send(400, { error: "invalid_input", detail: "mode" });
  }
  return runPythonJson(
    {
      args: [
        TRANSITS_PATH,
        "--mode",
        body.mode,
        "--json",
        ...birthArgs(body),
        ...period,
      ],
      timeoutMs: body.mode === "year" ? 120_000 : 30_000,
      error: "transits_failed",
    },
    send,
  );
}

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    return send(200, { ok: true, provider: "claude", model: MODEL });
  }
  if (
    req.method !== "POST" ||
    (req.url !== "/roast" &&
      req.url !== "/dm-agent" &&
      req.url !== "/chart" &&
      req.url !== "/transits" &&
      req.url !== "/chart-annotations" &&
      req.url !== "/enrich-agent")
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

  if (req.url === "/transits") {
    return handleTransits(body, send);
  }

  if (req.url === "/dm-agent") {
    return handleDmAgent(body, send);
  }

  if (req.url === "/chart-annotations") {
    return handleChartAnnotations(body, send, runQuick, ANNOTATION_MODEL);
  }

  if (req.url === "/enrich-agent") {
    return handleEnrichAgent({
      body,
      send,
      runClaude,
      extractJsonObject,
      isRateLimit,
    });
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

  let skill;
  try {
    skill = await loadRoastSkill(isGroup);
  } catch (error) {
    console.error("roast_skill_unavailable", String(error));
    return send(500, { error: "roast_skill_unavailable" });
  }

  const startedAt = Date.now();

  // Initial tick so the bar moves the moment the runner accepts the job.
  postProgress(roastId, 8);

  // Phase 1 — write. Background creep 10→70 while Fable computes and writes.
  // If the phase finishes faster, the creep stops; if it's slower, the creep
  // caps at 70 and we wait for the real finish to jump to 78.
  const stopWriteCreep = startProgressCreep({
    roastId,
    fromPct: 10,
    toPct: 70,
    durationMs: isGroup ? 90_000 : 65_000,
  });

  const groupRelationship =
    (typeof relationship === "string" && relationship.trim()) || "couple";
  const subjects = isGroup ? people : [{ ...body, hasBirthTime: !!hasBirthTime }];
  const precalculated = await precalculate(subjects, isGroup);

  const write = await runClaude({
    systemPrompt: skill + roastWritingPolicy(body),
    userPrompt: precalculated
      ? buildFastWriteUserPrompt({
          subjects,
          isGroup,
          relationship: groupRelationship,
          ...precalculated,
        })
      : isGroup
        ? buildGroupWriteUserPrompt({ relationship: groupRelationship, people })
        : buildWriteUserPrompt({
            name,
            date,
            time,
            birthPlace,
            hasBirthTime: !!hasBirthTime,
          }),
    model: MODEL,
    tools: precalculated ? "" : "Bash,WebSearch",
    effort: EFFORT,
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
      fastPath: !!precalculated,
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

  const chartData = precalculated
    ? precalculated.charts[0]
    : extractMarkedSection(write.stdout, "CHART");
  const roastBody = extractMarkedSection(write.stdout, "ROAST");
  if (!roastBody || (!isGroup && !hasCalculatedChart(chartData))) {
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
    const charts =
      precalculated?.charts ||
      people.map((_, i) => extractMarkedSection(write.stdout, `CHART_${i + 1}`));
    if (charts.some((c) => !hasCalculatedChart(c))) {
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
      fastPath: !!precalculated,
      durationMs: Date.now() - startedAt,
    });
  }

  return send(200, {
    chartData,
    roast,
    fastPath: !!precalculated,
    durationMs: Date.now() - startedAt,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`roast-runner listening on :${PORT}, write=${MODEL}`);
});
