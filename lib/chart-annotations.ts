import {
  computeSynastry,
  synastryAspectId,
  type SynastryAspect,
} from "./synastry";
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

export type ElementKind =
  "planet" | "angle" | "aspect" | "house" | "sign" | "synastry";

/**
 * Which chart an element belongs to on a duo roast. Solo roasts never carry
 * one, so their ids stay exactly as they were and old cached annotations keep
 * resolving.
 */
export type PersonSlot = "a" | "b";

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

/**
 * Cached annotations written before this roast became a bi-wheel are keyed by
 * solo ids ("planet:Sun"), which match nothing the duo wheel draws — every tap
 * would come back blank. Detect that and regenerate rather than serve a wheel
 * that silently says nothing.
 */
export function annotationsMatchDuo(annotations: ChartAnnotations): boolean {
  return Object.keys(annotations).some((k) => k.startsWith("synastry:"));
}

/** Prefix a solo element id with the person it belongs to on a duo roast. */
export const personElementId = (slot: PersonSlot, id: string) =>
  `${slot}:${id}`;

/** Split "a:planet:Sun" back into its slot and solo id. Null for solo ids. */
export function splitPersonElementId(
  id: string,
): { slot: PersonSlot; id: string } | null {
  const match = /^([ab]):(.+)$/.exec(id);
  return match ? { slot: match[1] as PersonSlot, id: match[2] } : null;
}

const SYNASTRY_SYMBOL: Record<SynastryAspect["type"], string> = ASPECT_SYMBOL;

/**
 * Every clickable element on a duo roast: both charts' elements namespaced by
 * person, plus the cross-aspects between them. The cross-aspects come first —
 * they are the reason the pair bought a duo roast, and putting them at the top
 * means a truncated model response still covers the relationship itself.
 *
 * `topSynastry` bounds the aspect list; a full pair produces 60+ contacts and
 * the long tail is 6°-orb noise nobody taps.
 */
export function enumerateDuoElements(
  chartA: NatalChart,
  chartB: NatalChart,
  options: { nameA?: string; nameB?: string; topSynastry?: number } = {},
): ElementSpec[] {
  const nameA = options.nameA || chartA.name || "Person 1";
  const nameB = options.nameB || chartB.name || "Person 2";
  const limit = options.topSynastry ?? 24;

  const out: ElementSpec[] = computeSynastry(chartA, chartB)
    .slice(0, limit)
    .map((s) => ({
      id: synastryAspectId(s),
      kind: "synastry" as const,
      title: `${nameA}'s ${s.a} ${SYNASTRY_SYMBOL[s.type]} ${nameB}'s ${s.b}`,
      facts: `${s.type}, orb ${s.orb.toFixed(1)}° · strength ${s.strength}/5 · between the two charts`,
    }));

  for (const [slot, chart, who] of [
    ["a", chartA, nameA],
    ["b", chartB, nameB],
  ] as const) {
    for (const e of enumerateElements(chart)) {
      // The bi-wheel is oriented to person A's ascendant, so only A's houses
      // and sign segments exist on screen. Generating copy for B's would spend
      // model calls on elements nobody can ever tap.
      if (slot === "b" && (e.kind === "house" || e.kind === "sign")) continue;
      out.push({
        ...e,
        id: personElementId(slot, e.id),
        title: `${who}'s ${e.title}`,
      });
    }
  }

  return out;
}

interface GenerateChartAnnotationOptions {
  runnerUrl?: string;
  runnerSecret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Elements to write copy for. Defaults to this chart's own. Duo roasts pass
   * enumerateDuoElements() so both charts and the contacts between them get
   * lines from a single call.
   */
  elements?: ElementSpec[];
}

// The runner writes ~59 lines in chunks and takes ~100s end to end. Only the
// async Inngest step waits on it, so the budget is generous.
const RUNNER_TIMEOUT_MS = 300_000;

// One Hermes subscription call → a witty line per element. Facts stay
// deterministic; only the line is model-written. On any failure, callers fall
// back to facts-only.
export async function generateChartAnnotations(
  chart: NatalChart,
  roastText: string,
  options: GenerateChartAnnotationOptions = {},
): Promise<ChartAnnotations> {
  const elements = options.elements ?? enumerateElements(chart);
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
        elements: elements.map(({ id, title, facts }) => ({
          id,
          title,
          facts,
        })),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? RUNNER_TIMEOUT_MS),
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
