const MAX_ROAST_CHARS = 80_000;
const MAX_ELEMENTS = 100;
const MAX_ID_CHARS = 200;
const MAX_TITLE_CHARS = 200;
const MAX_FACTS_CHARS = 500;
const MAX_LINE_CHARS = 300;
// A full natal chart enumerates ~59 elements, and one call covering all of them
// runs ~100s with the tail lines getting lazy. Chunks are for quality and
// blast radius, not speed — the subscription serializes concurrent `claude -p`
// calls, so these run back to back. Only the async Inngest path calls this, so
// there is no request deadline to fit inside.
const CHUNK_SIZE = 20;
const CHUNK_TIMEOUT_MS = 150_000;

export const ANNOTATION_SYSTEM_PROMPT = `You write micro-captions for an astrology "roast" — the user taps an element of their birth chart and you give them one genuinely funny, affectionate read of what it says about them, in the roast's own voice.

Make it funny first. Use precise, surprising recognition, a mundane punchline, or a callback to the roast. Tease like a friend who adores them: warm underneath, never cruel. Match the supplied roast's voice and running jokes without contradicting it.

Each line must use second person, be one sentence, contain no emoji, hashtags, or quotation marks, and stay near 140 characters. Return raw JSON only in this exact shape: {"lines":[{"id":"the supplied id","line":"the caption"}]}. Include one entry for every supplied element id and never invent ids.`;

export function validateAnnotationInput(body) {
  if (!body || typeof body !== "object") return "body";
  if (
    typeof body.roastText !== "string" ||
    !body.roastText.trim() ||
    body.roastText.length > MAX_ROAST_CHARS
  ) {
    return "roastText";
  }
  if (
    !Array.isArray(body.elements) ||
    body.elements.length < 1 ||
    body.elements.length > MAX_ELEMENTS
  ) {
    return "elements";
  }

  const ids = new Set();
  for (const element of body.elements) {
    if (!element || typeof element !== "object") return "element";
    if (
      typeof element.id !== "string" ||
      !element.id.trim() ||
      element.id.length > MAX_ID_CHARS ||
      ids.has(element.id)
    ) {
      return "element.id";
    }
    if (
      typeof element.title !== "string" ||
      !element.title.trim() ||
      element.title.length > MAX_TITLE_CHARS
    ) {
      return "element.title";
    }
    if (
      typeof element.facts !== "string" ||
      !element.facts.trim() ||
      element.facts.length > MAX_FACTS_CHARS
    ) {
      return "element.facts";
    }
    ids.add(element.id);
  }
  return null;
}

export function buildAnnotationPrompt({ roastText, elements }) {
  const list = elements
    .map((element) => `${element.id} — ${element.title} (${element.facts})`)
    .join("\n");
  return `THE ROAST (for voice + continuity):\n\n${roastText}\n\n─────────\nWrite one line for each of these ${elements.length} elements:\n\n${list}`;
}

export function parseAnnotationOutput(stdout, allowedIds) {
  const trimmed = String(stdout)
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const lines = [];
  const seen = new Set();
  for (const item of Array.isArray(parsed?.lines) ? parsed.lines : []) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.line !== "string" ||
      !allowedIds.has(item.id) ||
      seen.has(item.id)
    ) {
      continue;
    }
    const line = item.line.trim();
    if (!line || line.length > MAX_LINE_CHARS) continue;
    seen.add(item.id);
    lines.push({ id: item.id, line });
  }
  return lines;
}

function isUsageLimit(stderr, stdout) {
  const text = `${stderr}\n${stdout}`.toLowerCase();
  return (
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("usage limit") ||
    text.includes("quota") ||
    text.includes("429")
  );
}

export function chunkElements(elements, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < elements.length; i += size) {
    chunks.push(elements.slice(i, i + size));
  }
  return chunks;
}

export async function handleChartAnnotations(
  body,
  send,
  runClaude,
  model = "claude-sonnet-5",
) {
  const invalid = validateAnnotationInput(body);
  if (invalid) {
    return send(400, { error: "invalid_input", detail: invalid });
  }

  // A chunk that dies only costs its own elements — the wheel falls back to
  // facts for those instead of losing every line.
  const chunks = chunkElements(body.elements);
  const allowedIds = new Set(body.elements.map((element) => element.id));

  const results = await Promise.all(
    chunks.map(async (elements) => {
      let run;
      try {
        run = await runClaude({
          userPrompt: buildAnnotationPrompt({
            roastText: body.roastText,
            elements,
          }),
          systemPrompt: ANNOTATION_SYSTEM_PROMPT,
          model,
          tools: "",
          timeoutMs: CHUNK_TIMEOUT_MS,
        });
      } catch (error) {
        console.error(
          "chart_annotations_runner_failed",
          String(error).slice(0, 300),
        );
        return { lines: [], limited: false };
      }

      if (run.code !== 0) {
        const limited = isUsageLimit(run.stderr, run.stdout);
        console.error("chart_annotations_claude_failed", {
          code: run.code,
          count: elements.length,
          stderr: String(run.stderr).slice(0, 300),
        });
        return { lines: [], limited };
      }

      return {
        lines: parseAnnotationOutput(run.stdout, allowedIds),
        limited: false,
        stdout: run.stdout,
      };
    }),
  );

  const lines = [];
  const seen = new Set();
  for (const result of results) {
    for (const item of result.lines) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      lines.push(item);
    }
  }

  if (lines.length === 0) {
    if (results.some((result) => result.limited)) {
      return send(503, { error: "rate_limited" });
    }
    if (results.every((result) => result.stdout === undefined)) {
      return send(500, { error: "claude_failed" });
    }
    console.error("chart_annotations_bad_output", {
      preview: String(
        results.find((r) => r.stdout !== undefined)?.stdout,
      ).slice(0, 300),
    });
    return send(502, { error: "bad_output" });
  }
  return send(200, { lines });
}
