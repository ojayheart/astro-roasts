import Anthropic from "@anthropic-ai/sdk";
import type { NatalAspect, NatalChart } from "./types";

// Per-element copy for the interactive natal wheel. `facts` is computed
// deterministically from the chart (always accurate); `line` is the witty,
// roast-tied one-liner written by the model. Keyed by a stable element id so
// the wheel (which attaches click handlers) and the stored annotations agree.
export interface ChartAnnotation {
  facts: string;
  line: string;
}
export type ChartAnnotations = Record<string, ChartAnnotation>;

export type ElementKind = "planet" | "angle" | "aspect" | "house" | "sign";

export interface ElementSpec {
  id: string;
  kind: ElementKind;
  title: string; // human label shown in the detail card header
  facts: string; // deterministic facts line
}

// What the wheel hands back on click/tap (facts + line are looked up by id).
export type WheelSelection = Pick<ElementSpec, "id" | "kind" | "title">;

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

const ASPECT_SYMBOL: Record<NatalAspect["type"], string> = {
  conjunction: "☌",
  sextile: "✶",
  square: "□",
  trine: "△",
  quincunx: "⚻",
  opposition: "☍",
};

const RETRO = "℞"; // ℞

function signFromLon(lon: number): string {
  return SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];
}

function fmtDeg(degInSign: number): string {
  const d = Math.floor(degInSign);
  const m = Math.floor((degInSign - d) * 60);
  return `${String(d).padStart(2, "0")}°${String(m).padStart(2, "0")}′`;
}

// ── Stable element ids — used by BOTH the wheel and the annotation store ────
export const planetId = (name: string) => `planet:${name}`;
export const angleId = (which: "ASC" | "MC") => `angle:${which}`;
export const houseId = (n: number) => `house:${n}`;
export const signId = (sign: string) => `sign:${sign}`;
export function aspectId(a: NatalAspect): string {
  const [x, y] = [a.a, a.b].sort();
  return `aspect:${x}|${y}:${a.type}`;
}

// The wheel only draws planet-to-planet aspects, non-conjunction, both endpoints
// present. Mirror that exactly so ids line up with what's clickable.
export function drawableAspects(chart: NatalChart): NatalAspect[] {
  const names = new Set(chart.planets.map((p) => p.name));
  return chart.aspects.filter(
    (a) => a.type !== "conjunction" && names.has(a.a) && names.has(a.b),
  );
}

const aspectTitle = (a: NatalAspect) =>
  `${a.a} ${ASPECT_SYMBOL[a.type]} ${a.b}`;

// Enumerate every interactive element with its deterministic facts + a title.
export function enumerateElements(chart: NatalChart): ElementSpec[] {
  const out: ElementSpec[] = [];

  for (const p of chart.planets) {
    const house = p.house ? ` · House ${p.house}` : "";
    const retro = p.retrograde ? ` · ${RETRO} retrograde` : "";
    out.push({
      id: planetId(p.name),
      kind: "planet",
      title: `${p.name}${p.retrograde ? ` ${RETRO}` : ""}`,
      facts: `${p.sign} · ${fmtDeg(p.degInSign)}${house}${retro}`,
    });
  }

  if (chart.angles) {
    out.push({
      id: angleId("ASC"),
      kind: "angle",
      title: "Ascendant",
      facts: `${chart.angles.ascendant.sign} · ${fmtDeg(chart.angles.ascendant.degInSign)} · the mask you arrive in`,
    });
    out.push({
      id: angleId("MC"),
      kind: "angle",
      title: "Midheaven",
      facts: `${chart.angles.mc.sign} · ${fmtDeg(chart.angles.mc.degInSign)} · the public-facing résumé`,
    });
  }

  for (const a of drawableAspects(chart)) {
    out.push({
      id: aspectId(a),
      kind: "aspect",
      title: aspectTitle(a),
      facts: `${a.type}, orb ${a.orb.toFixed(1)}° · strength ${a.strength}/5`,
    });
  }

  if (chart.houses) {
    chart.houses.forEach((cusp, i) => {
      const n = i + 1;
      const inside = chart.planets
        .filter((p) => p.house === n)
        .map((p) => p.name);
      out.push({
        id: houseId(n),
        kind: "house",
        title: `House ${n}`,
        facts: `cusp in ${signFromLon(cusp)} · ${inside.length ? inside.join(", ") : "empty"}`,
      });
    });
  }

  for (const sign of SIGNS) {
    const inside = chart.planets
      .filter((p) => p.sign === sign)
      .map((p) => p.name);
    out.push({
      id: signId(sign),
      kind: "sign",
      title: sign,
      facts: inside.length
        ? `holds ${inside.join(", ")}`
        : "no planets — a quiet room",
    });
  }

  return out;
}

const SYSTEM = `You write micro-captions for an astrology "roast" — a comedic, brutally honest natal-chart reading. The user clicks an element of their birth chart and you tell them what it means about them, in the roast's own voice.

Voice: second person ("you"/"your"), bathos (cosmic setup → mundane gut-punch), specific not generic, brutally honest but never cruel-for-cruel's-sake. No astrology jargon-splaining — land the joke. One sentence, max ~140 characters. No emoji, no hashtags, no quotation marks around the line.

You will get the full roast (for voice + continuity — echo its angles, don't contradict it) and a list of chart elements with their factual data. Write one line per element id. Make planets/aspects sharp and personal; houses/signs can riff on what they hold (or the comedy of being empty).`;

// One Opus call → a witty line per element. Facts stay deterministic; only the
// line is model-written. On any failure, callers fall back to facts-only.
export async function generateChartAnnotations(
  chart: NatalChart,
  roastText: string,
): Promise<ChartAnnotations> {
  const elements = enumerateElements(chart);
  const annotations: ChartAnnotations = {};
  for (const e of elements) annotations[e.id] = { facts: e.facts, line: "" };

  const list = elements
    .map((e) => `${e.id} — ${e.title} (${e.facts})`)
    .join("\n");

  const client = new Anthropic(); // ANTHROPIC_API_KEY from env

  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 6000,
    system: SYSTEM,
    tools: [
      {
        name: "emit_lines",
        description: "Return one witty roast line per chart element id.",
        input_schema: {
          type: "object",
          properties: {
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  line: { type: "string" },
                },
                required: ["id", "line"],
                additionalProperties: false,
              },
            },
          },
          required: ["lines"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_lines" },
    messages: [
      {
        role: "user",
        content: `THE ROAST (for voice + continuity):\n\n${roastText}\n\n─────────\nWrite one line for each of these ${elements.length} elements:\n\n${list}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  const parsed = block?.input as { lines?: { id: string; line: string }[] };
  for (const { id, line } of parsed?.lines ?? []) {
    if (annotations[id] && typeof line === "string") {
      annotations[id].line = line.trim();
    }
  }
  return annotations;
}
