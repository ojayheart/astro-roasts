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

interface GenerateChartAnnotationOptions {
  runnerUrl?: string;
  runnerSecret?: string;
  fetchImpl?: typeof fetch;
}

// One Hermes subscription call → a witty line per element. Facts stay
// deterministic; only the line is model-written. On any failure, callers fall
// back to facts-only.
export async function generateChartAnnotations(
  chart: NatalChart,
  roastText: string,
  options: GenerateChartAnnotationOptions = {},
): Promise<ChartAnnotations> {
  const elements = enumerateElements(chart);
  const annotations: ChartAnnotations = {};
  for (const e of elements) annotations[e.id] = { facts: e.facts, line: "" };

  const runnerUrl = options.runnerUrl ?? process.env.ROAST_RUNNER_URL ?? "";
  const runnerSecret =
    options.runnerSecret ?? process.env.ROAST_RUNNER_SECRET ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!runnerUrl || !runnerSecret) {
    throw new Error("Chart annotation runner not configured");
  }

  const response = await fetchImpl(
    `${runnerUrl.replace(/\/+$/, "")}/chart-annotations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runnerSecret}`,
      },
      body: JSON.stringify({
        roastText,
        elements: elements.map(({ id, title, facts }) => ({ id, title, facts })),
      }),
      signal: AbortSignal.timeout(55_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Chart annotation runner failed (${response.status})`);
  }

  const body = (await response.json()) as {
    lines?: Array<{ id?: unknown; line?: unknown }>;
  };
  if (!Array.isArray(body.lines)) {
    throw new Error("Chart annotation runner returned invalid output");
  }
  for (const item of body.lines) {
    if (
      typeof item.id === "string" &&
      typeof item.line === "string" &&
      annotations[item.id]
    ) {
      const line = item.line.trim();
      if (line && line.length <= 300) annotations[item.id].line = line;
    }
  }
  return annotations;
}
