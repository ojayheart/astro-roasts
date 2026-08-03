"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NatalChart } from "@/lib/types";
import {
  enumerateElements,
  enumerateDuoElements,
  drawableAspects,
  planetId,
  angleId,
  houseId,
  aspectId,
  signId,
  type WheelSelection,
} from "@/lib/chart-annotations";
import { computeSynastry, synastryAspectId } from "@/lib/synastry";

/**
 * The person's actual natal chart, drawn live on the loading screen.
 * Pure d3 inside a useEffect — d3 transitions own the draw-in sequencing.
 * Brand only: void bg, ash hairlines, blood accents, mono data labels.
 *
 * Orientation: Ascendant on the left (9 o'clock), longitudes increase
 * counterclockwise — standard chart convention. Unknown birth time → no
 * houses/angles; wheel orients 0° Aries left instead.
 *
 * Interactivity (opt-in via onSelect/onHover): planets, aspect lines, sign
 * glyphs, houses, and ASC/MC become hoverable + clickable. Transparent
 * oversized hit-targets sit on top so small glyphs are tappable on mobile.
 */

const ASH = "#e5e5e5";
const BLOOD = "#ff2a00";
const MONO = "'DM Mono', ui-monospace, monospace";

// "︎" (variation selector-15) forces text presentation — without it
// Chrome renders zodiac/planet glyphs as color emoji, which wrecks the brand.
const VS15 = "︎";

const SIGN_GLYPHS = [
  "♈",
  "♉",
  "♊",
  "♋",
  "♌",
  "♍",
  "♎",
  "♏",
  "♐",
  "♑",
  "♒",
  "♓",
].map((g) => g + VS15);

const SIGN_NAMES = [
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
];

const PLANET_GLYPHS: Record<string, string> = Object.fromEntries(
  Object.entries({
    Sun: "☉",
    Moon: "☽",
    Mercury: "☿",
    Venus: "♀",
    Mars: "♂",
    Jupiter: "♃",
    Saturn: "♄",
    Uranus: "♅",
    Neptune: "♆",
    Pluto: "♇",
    Chiron: "⚷",
    "N.Node": "☊",
    "S.Node": "☋",
    Lilith: "⚸",
  }).map(([k, v]) => [k, v + VS15]),
);

const HARD_ASPECTS = new Set(["conjunction", "square", "opposition"]);

// Radii within the -320..320 viewBox
const R_RING_OUT = 300;
const R_RING_IN = 268;
const R_GLYPH = 284;
const R_TICK_IN = 262;
const R_PLANET = 226;
const R_DEG_LABEL = 198;
const R_HOUSE_NUM = 164;
const R_ASPECT = 150;

// Bi-wheel: person B rides just inside the zodiac ring, person A drops inward
// to make room, and a hairline divider keeps whose-planet-is-whose readable.
const R_PLANET_OUTER = 244;
const R_PLANET_INNER = 196;
const R_DIVIDER = 220;
const R_RING_LABEL = 214;

// Cross-chart contacts get their own weight so they read as the relationship
// rather than as more of either person's own chart.
const SYNASTRY_HARD = "#ff2a00";
const SYNASTRY_SOFT = "#7db7ff";

function fmtDeg(degInSign: number): string {
  const d = Math.floor(degInSign);
  const m = Math.floor((degInSign - d) * 60);
  return `${String(d).padStart(2, "0")}°${String(m).padStart(2, "0")}′`;
}

export interface HoverInfo {
  title: string;
  x: number;
  y: number;
}

type Hit =
  | { kind: "circle"; x: number; y: number; r: number; spec: WheelSelection }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      spec: WheelSelection;
    };

export default function NatalWheel({
  chart,
  partner,
  names,
  onSelect,
  onHover,
  selectedId,
}: {
  chart: NatalChart;
  /**
   * Second chart for a duo roast. Present → bi-wheel: `chart` becomes the
   * inner ring, `partner` the outer, and the cross-aspects between them are
   * drawn instead of either chart's internal aspects. Absent → the solo wheel,
   * unchanged.
   */
  partner?: NatalChart | null;
  /** Display names for the two rings, in [inner, outer] order. */
  names?: [string, string];
  onSelect?: (sel: WheelSelection | null) => void;
  onHover?: (info: HoverInfo | null) => void;
  selectedId?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Keep latest callbacks reachable from d3 handlers without re-running the draw.
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  });

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const interactive = onSelect !== undefined;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Reduced motion: everything appears near-instantly, nothing rotates.
    const T = (ms: number) => (reduceMotion ? 0 : ms);

    const asc = chart.angles?.ascendant.lon ?? 0;
    const toXY = (lonDeg: number, r: number): [number, number] => {
      const a = ((180 + (lonDeg - asc)) * Math.PI) / 180;
      return [r * Math.cos(a), -r * Math.sin(a)];
    };

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    const root = svg.append("g");

    // id → selection payload, for wiring click/hover targets.
    const specs = partner
      ? enumerateDuoElements(chart, partner, {
          nameA: names?.[0],
          nameB: names?.[1],
        })
      : enumerateElements(chart);
    const specById = new Map<string, WheelSelection>(
      specs.map((e) => [e.id, { id: e.id, kind: e.kind, title: e.title }]),
    );
    // On a bi-wheel every element belongs to someone, so the ids the wheel
    // draws must carry the same prefix the annotations were stored under.
    const elId = (id: string) => (partner ? `a:${id}` : id);
    const hits: Hit[] = [];

    // ── 1. Zodiac ring ──────────────────────────────────────────────────
    const ring = root.append("g").attr("opacity", 0);
    ring
      .append("circle")
      .attr("r", R_RING_OUT)
      .attr("fill", "none")
      .attr("stroke", ASH)
      .attr("stroke-opacity", 0.16)
      .attr("stroke-width", 1);
    ring
      .append("circle")
      .attr("r", R_RING_IN)
      .attr("fill", "none")
      .attr("stroke", ASH)
      .attr("stroke-opacity", 0.16)
      .attr("stroke-width", 1);
    ring.transition().duration(T(700)).attr("opacity", 1);

    for (let i = 0; i < 12; i++) {
      const [x1, y1] = toXY(i * 30, R_RING_IN);
      const [x2, y2] = toXY(i * 30, R_RING_OUT);
      ring
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", ASH)
        .attr("stroke-opacity", 0)
        .attr("stroke-width", 1)
        .transition()
        .delay(T(300 + i * 50))
        .duration(T(400))
        .attr("stroke-opacity", 0.14);

      const [gx, gy] = toXY(i * 30 + 15, R_GLYPH);
      const glyph = ring
        .append("text")
        .attr("x", gx)
        .attr("y", gy)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", ASH)
        .attr("font-size", 15)
        .attr("opacity", 0)
        .text(SIGN_GLYPHS[i]);
      glyph
        .transition()
        .delay(T(400 + i * 50))
        .duration(T(450))
        .attr("opacity", 0.4);

      const sSpec = specById.get(elId(signId(SIGN_NAMES[i])));
      if (sSpec) {
        glyph.attr("data-el-id", sSpec.id);
        hits.push({ kind: "circle", x: gx, y: gy, r: 16, spec: sSpec });
      }
    }

    // ── 2. Degree ticks (rotating group — symmetric, so rotation is pure
    //       ambience and never misaligns with the chart) ─────────────────
    const ticks = root
      .append("g")
      .attr("class", reduceMotion ? "" : "wheel-rotate");
    for (let d = 0; d < 360; d += 5) {
      const major = d % 30 === 0;
      const [x1, y1] = toXY(d, R_RING_IN);
      const [x2, y2] = toXY(d, major ? R_TICK_IN - 4 : R_TICK_IN);
      ticks
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", ASH)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0);
    }
    ticks
      .selectAll("line")
      .transition()
      .delay(T(1100))
      .duration(T(700))
      .attr("stroke-opacity", 0.18);

    // ── 3. House cusps + numerals (known birth time only) ───────────────
    if (chart.houses) {
      const housesG = root.append("g");
      chart.houses.forEach((cusp, i) => {
        const [x1, y1] = toXY(cusp, R_ASPECT);
        const [x2, y2] = toXY(cusp, R_RING_IN);
        const isAxis = i === 0 || i === 9; // ASC / MC cusps
        housesG
          .append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", isAxis ? BLOOD : ASH)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0)
          .transition()
          .delay(T(1500 + i * 60))
          .duration(T(450))
          .attr("stroke-opacity", isAxis ? 0.55 : 0.12);

        const next = chart.houses![(i + 1) % 12];
        const span = (next - cusp + 360) % 360;
        const [nx, ny] = toXY(cusp + span / 2, R_HOUSE_NUM);
        const numeral = housesG
          .append("text")
          .attr("x", nx)
          .attr("y", ny)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", ASH)
          .attr("font-family", MONO)
          .attr("font-size", 9)
          .attr("opacity", 0)
          .text(i + 1);
        numeral
          .transition()
          .delay(T(1700 + i * 60))
          .duration(T(450))
          .attr("opacity", 0.3);

        const hSpec = specById.get(elId(houseId(i + 1)));
        if (hSpec) {
          numeral.attr("data-el-id", hSpec.id);
          hits.push({ kind: "circle", x: nx, y: ny, r: 14, spec: hSpec });
        }
      });

      // ASC / MC labels just outside the ring
      const angles = [
        { label: "ASC" as const, lon: chart.angles!.ascendant.lon },
        { label: "MC" as const, lon: chart.angles!.mc.lon },
      ];
      for (const { label, lon } of angles) {
        const [lx, ly] = toXY(lon, R_RING_OUT + 14);
        const angleText = housesG
          .append("text")
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", BLOOD)
          .attr("font-family", MONO)
          .attr("font-size", 10)
          .attr("letter-spacing", "0.1em")
          .attr("opacity", 0)
          .text(label);
        angleText
          .transition()
          .delay(T(2100))
          .duration(T(450))
          .attr("opacity", 0.85);

        const aSpec = specById.get(elId(angleId(label)));
        if (aSpec) {
          angleText.attr("data-el-id", aSpec.id);
          hits.push({ kind: "circle", x: lx, y: ly, r: 16, spec: aSpec });
        }
      }
    }

    // ── 4. Aspect circle ────────────────────────────────────────────────
    root
      .append("circle")
      .attr("r", R_ASPECT)
      .attr("fill", "none")
      .attr("stroke", ASH)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0)
      .transition()
      .delay(T(2200))
      .duration(T(500))
      .attr("stroke-opacity", 0.1);

    // ── 5. Planets — collision-nudged display angle, true-degree tick ───
    // Glyphs that would collide get pushed apart for legibility; the tick on
    // the ring still marks the true degree.
    const nudge = (planets: { name: string; lon: number }[]) => {
      const out = new Map<string, number>();
      let cursor = -Infinity;
      for (const p of [...planets].sort((a, b) => a.lon - b.lon)) {
        const d = Math.max(p.lon, cursor + 7.5);
        out.set(p.name, d);
        cursor = d;
      }
      // If the nudge chain wrapped past the first planet, that's a 14-planet
      // pile-up that doesn't happen in real charts — accept the overlap.
      return out;
    };

    const sorted = [...chart.planets].sort((a, b) => a.lon - b.lon);
    const display = nudge(chart.planets);
    // Bi-wheel: person A drops inward to leave the outer band for person B.
    const rPlanet = partner ? R_PLANET_INNER : R_PLANET;

    const planetsG = root.append("g");
    const planetPos = new Map<string, [number, number]>();
    const PLANET_START = 2600;
    const PLANET_STEP = 320;
    sorted.forEach((p, i) => {
      const dLon = display.get(p.name)!;
      const [px, py] = toXY(dLon, rPlanet);
      planetPos.set(p.name, [px, py]);
      const delay = T(PLANET_START + i * PLANET_STEP);

      // True-degree tick on the ring's inner edge
      const [t1x, t1y] = toXY(p.lon, R_RING_IN);
      const [t2x, t2y] = toXY(p.lon, R_RING_IN - 7);
      planetsG
        .append("line")
        .attr("x1", t1x)
        .attr("y1", t1y)
        .attr("x2", t2x)
        .attr("y2", t2y)
        .attr("stroke", BLOOD)
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0)
        .transition()
        .delay(delay)
        .duration(T(300))
        .attr("stroke-opacity", 0.7);

      const g = planetsG
        .append("g")
        .attr("transform", `translate(${px},${py}) scale(0.5)`)
        .attr("opacity", 0);
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", ASH)
        .attr("font-size", 19)
        .text(PLANET_GLYPHS[p.name] ?? p.name[0]);
      if (p.retrograde) {
        g.append("text")
          .attr("x", 12)
          .attr("y", -9)
          .attr("fill", BLOOD)
          .attr("font-family", MONO)
          .attr("font-size", 8)
          .text("Rx");
      }
      g.transition()
        .delay(delay)
        .duration(T(450))
        .attr("opacity", 1)
        .attr("transform", `translate(${px},${py}) scale(1)`);

      const pSpec = specById.get(elId(planetId(p.name)));
      if (pSpec) {
        g.attr("data-el-id", pSpec.id);
        hits.push({ kind: "circle", x: px, y: py, r: 22, spec: pSpec });
      }

      // Degree label, one step further in. Dropped on the bi-wheel: 24 glyphs
      // across two rings leaves no room to set it without it colliding with
      // the outer ring's planets.
      if (!partner) {
        const [dx, dy] = toXY(dLon, R_DEG_LABEL);
        planetsG
          .append("text")
          .attr("x", dx)
          .attr("y", dy)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", ASH)
          .attr("font-family", MONO)
          .attr("font-size", 8.5)
          .attr("opacity", 0)
          .text(fmtDeg(p.degInSign))
          .transition()
          .delay(delay + T(150))
          .duration(T(450))
          .attr("opacity", 0.45);
      }

      // Single discovery pulse
      if (!reduceMotion) {
        planetsG
          .append("circle")
          .attr("cx", px)
          .attr("cy", py)
          .attr("r", 4)
          .attr("fill", "none")
          .attr("stroke", BLOOD)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0)
          .transition()
          .delay(delay)
          .attr("opacity", 0.8)
          .transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr("r", 26)
          .attr("opacity", 0)
          .remove();
      }
    });

    // ── 5b. Partner ring — person B just inside the zodiac band ─────────
    const ASPECT_START = PLANET_START + sorted.length * PLANET_STEP + 400;

    if (partner) {
      const partnerSorted = [...partner.planets].sort((a, b) => a.lon - b.lon);
      const partnerDisplay = nudge(partner.planets);
      const partnerG = root.append("g");

      // Hairline between the two rings — without it the eye reads 24 planets
      // as one crowded chart instead of two people.
      partnerG
        .append("circle")
        .attr("r", R_DIVIDER)
        .attr("fill", "none")
        .attr("stroke", ASH)
        .attr("stroke-opacity", 0)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 6")
        .transition()
        .delay(T(PLANET_START - 200))
        .duration(T(600))
        .attr("stroke-opacity", 0.18);

      partnerSorted.forEach((p, i) => {
        const dLon = partnerDisplay.get(p.name)!;
        const [px, py] = toXY(dLon, R_PLANET_OUTER);
        const delay = T(PLANET_START + i * PLANET_STEP);

        // True-degree tick, pointing inward from the zodiac ring.
        const [t1x, t1y] = toXY(p.lon, R_RING_IN - 2);
        const [t2x, t2y] = toXY(p.lon, R_RING_IN - 9);
        partnerG
          .append("line")
          .attr("x1", t1x)
          .attr("y1", t1y)
          .attr("x2", t2x)
          .attr("y2", t2y)
          .attr("stroke", SYNASTRY_SOFT)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0)
          .transition()
          .delay(delay)
          .duration(T(300))
          .attr("stroke-opacity", 0.7);

        const g = partnerG
          .append("g")
          .attr("transform", `translate(${px},${py}) scale(0.5)`)
          .attr("opacity", 0);
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", SYNASTRY_SOFT)
          .attr("font-size", 19)
          .text(PLANET_GLYPHS[p.name] ?? p.name[0]);
        if (p.retrograde) {
          g.append("text")
            .attr("x", 12)
            .attr("y", -9)
            .attr("fill", SYNASTRY_SOFT)
            .attr("font-family", MONO)
            .attr("font-size", 8)
            .text("Rx");
        }
        g.transition()
          .delay(delay)
          .duration(T(450))
          .attr("opacity", 1)
          .attr("transform", `translate(${px},${py}) scale(1)`);

        const pSpec = specById.get(`b:${planetId(p.name)}`);
        if (pSpec) {
          g.attr("data-el-id", pSpec.id);
          hits.push({ kind: "circle", x: px, y: py, r: 22, spec: pSpec });
        }
      });

      // Legend in the bottom corners — outside the r=300 circle, the only
      // space on a 24-glyph wheel where text doesn't land on a planet.
      if (names) {
        const [innerName, outerName] = names;
        const legend = (
          text: string,
          x: number,
          anchor: "start" | "end",
          fill: string,
        ) => {
          const g = partnerG.append("g").attr("opacity", 0);
          g.append("circle")
            .attr("cx", anchor === "start" ? x : x - 8)
            .attr("cy", R_RING_LABEL + 92)
            .attr("r", 3)
            .attr("fill", fill);
          g.append("text")
            .attr("x", anchor === "start" ? x + 10 : x - 18)
            .attr("y", R_RING_LABEL + 92)
            .attr("text-anchor", anchor)
            .attr("dominant-baseline", "central")
            .attr("fill", fill)
            .attr("font-family", MONO)
            .attr("font-size", 10)
            .attr("letter-spacing", "0.16em")
            .text(text.toUpperCase());
          g.transition()
            .delay(T(PLANET_START + 200))
            .duration(T(600))
            .attr("opacity", 0.75);
        };
        legend(innerName, -300, "start", ASH);
        legend(outerName, 300, "end", SYNASTRY_SOFT);
      }
    }

    // ── 6. Aspect lines ─────────────────────────────────────────────────
    // Solo: this chart's own aspects. Bi-wheel: the contacts between the two
    // charts, which are the whole point — neither person's internal aspects
    // say anything about the pair, and drawing all three sets is unreadable.
    const lonOf = new Map(chart.planets.map((p) => [p.name, p.lon]));

    if (partner) {
      const partnerLonOf = new Map(
        partner.planets.map((p) => [p.name, p.lon] as const),
      );
      if (partner.angles) {
        partnerLonOf.set("Ascendant", partner.angles.ascendant.lon);
        partnerLonOf.set("MC", partner.angles.mc.lon);
      }
      const ownLonOf = new Map(lonOf);
      if (chart.angles) {
        ownLonOf.set("Ascendant", chart.angles.ascendant.lon);
        ownLonOf.set("MC", chart.angles.mc.lon);
      }

      const synastryG = root.append("g");
      // Same cut the annotations take, so every drawn line is tappable.
      computeSynastry(chart, partner)
        .slice(0, 24)
        .forEach((s, i) => {
          const lonA = ownLonOf.get(s.a);
          const lonB = partnerLonOf.get(s.b);
          if (lonA === undefined || lonB === undefined) return;

          const [x1, y1] = toXY(lonA, R_ASPECT - 2);
          const [x2, y2] = toXY(lonB, R_ASPECT - 2);
          const hard = HARD_ASPECTS.has(s.type);
          const opacity = hard
            ? 0.28 + s.strength * 0.08
            : 0.12 + s.strength * 0.05;
          const len = Math.hypot(x2 - x1, y2 - y1);

          // A tight conjunction is a sub-pixel line — invisible and impossible
          // to tap. Mark it instead: it's the strongest contact in synastry and
          // has to be reachable.
          if (s.type === "conjunction") {
            const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
            const dot = synastryG
              .append("circle")
              .attr("cx", mx)
              .attr("cy", my)
              .attr("r", 4.5)
              .attr("fill", "none")
              .attr("stroke", SYNASTRY_HARD)
              .attr("stroke-width", 1.2)
              .attr("stroke-opacity", 0)
              .transition()
              .delay(T(ASPECT_START + i * 180))
              .duration(T(450))
              .attr("stroke-opacity", 0.3 + s.strength * 0.08);

            const cSpec = specById.get(synastryAspectId(s));
            if (cSpec) {
              dot.selection().attr("data-el-id", cSpec.id);
              hits.push({ kind: "circle", x: mx, y: my, r: 14, spec: cSpec });
            }
            return;
          }

          const line = synastryG
            .append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("stroke", hard ? SYNASTRY_HARD : SYNASTRY_SOFT)
            .attr("stroke-width", hard ? 1.3 : 1)
            .attr("stroke-dasharray", s.type === "quincunx" ? "3 5" : `${len}`)
            .attr("stroke-dashoffset", s.type === "quincunx" ? 0 : len)
            .attr("stroke-opacity", s.type === "quincunx" ? 0 : opacity);

          if (s.type === "quincunx") {
            line
              .transition()
              .delay(T(ASPECT_START + i * 180))
              .duration(T(500))
              .attr("stroke-opacity", opacity);
          } else {
            line
              .transition()
              .delay(T(ASPECT_START + i * 180))
              .duration(T(550))
              .ease(d3.easeCubicOut)
              .attr("stroke-dashoffset", 0);
          }

          if (!reduceMotion && hard && i < 3) {
            line
              .attr("class", "aspect-breathe")
              .style("--aspect-base-opacity", String(opacity))
              .style(
                "animation-delay",
                `${(ASPECT_START + i * 180 + 800) / 1000}s`,
              );
          }

          const spec = specById.get(synastryAspectId(s));
          if (spec) {
            line.attr("data-el-id", spec.id);
            hits.push({ kind: "line", x1, y1, x2, y2, spec });
          }
        });
    }

    const drawable = partner
      ? []
      : chart.aspects.filter(
          (a) => lonOf.has(a.a) && lonOf.has(a.b) && a.type !== "conjunction",
        );
    const aspectsG = root.append("g");
    drawable.forEach((a, i) => {
      const [x1, y1] = toXY(lonOf.get(a.a)!, R_ASPECT - 2);
      const [x2, y2] = toXY(lonOf.get(a.b)!, R_ASPECT - 2);
      const hard = HARD_ASPECTS.has(a.type);
      const opacity = hard
        ? 0.25 + a.strength * 0.07
        : 0.08 + a.strength * 0.04;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const line = aspectsG
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", hard ? BLOOD : ASH)
        .attr("stroke-width", hard ? 1.2 : 1)
        .attr("stroke-dasharray", a.type === "quincunx" ? "3 5" : `${len}`)
        .attr("stroke-dashoffset", a.type === "quincunx" ? 0 : len)
        .attr("stroke-opacity", a.type === "quincunx" ? 0 : opacity);
      if (a.type === "quincunx") {
        line
          .transition()
          .delay(T(ASPECT_START + i * 220))
          .duration(T(500))
          .attr("stroke-opacity", opacity);
      } else {
        line
          .transition()
          .delay(T(ASPECT_START + i * 220))
          .duration(T(550))
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);
      }
      // The three tightest hard aspects breathe forever once drawn.
      if (!reduceMotion && hard && i < 3) {
        line
          .attr("class", "aspect-breathe")
          .style("--aspect-base-opacity", String(opacity))
          .style(
            "animation-delay",
            `${(ASPECT_START + i * 220 + 800) / 1000}s`,
          );
      }

      const aspSpec = specById.get(elId(aspectId(a)));
      if (aspSpec) {
        line.attr("data-el-id", aspSpec.id);
        hits.push({ kind: "line", x1, y1, x2, y2, spec: aspSpec });
      }
    });

    // ── 7. Interaction layer — transparent oversized hit-targets on top ─
    if (interactive) {
      svg.on("click", () => onSelectRef.current?.(null));

      const hitsG = root.append("g").attr("class", "wheel-hits");
      const wire = (
        sel: d3.Selection<d3.BaseType, unknown, null, undefined>,
        spec: WheelSelection,
      ) => {
        sel
          .attr("data-el-id", spec.id)
          .style("cursor", "pointer")
          .on("mouseenter", (event: MouseEvent) => {
            // First engagement — retire the "poke me" invite cue.
            svg.selectAll(".wheel-invite").interrupt().remove();
            svg
              .selectAll(`[data-el-id="${spec.id}"]`)
              .classed("is-hover", true);
            onHoverRef.current?.({
              title: spec.title,
              x: event.clientX,
              y: event.clientY,
            });
          })
          .on("mousemove", (event: MouseEvent) => {
            onHoverRef.current?.({
              title: spec.title,
              x: event.clientX,
              y: event.clientY,
            });
          })
          .on("mouseleave", () => {
            svg
              .selectAll(`[data-el-id="${spec.id}"]`)
              .classed("is-hover", false);
            onHoverRef.current?.(null);
          })
          .on("click", (event: MouseEvent) => {
            event.stopPropagation();
            onSelectRef.current?.(spec);
          });
      };

      for (const h of hits) {
        if (h.kind === "circle") {
          const c = hitsG
            .append("circle")
            .attr("cx", h.x)
            .attr("cy", h.y)
            .attr("r", h.r)
            .attr("fill", "transparent")
            .style("pointer-events", "all");
          wire(
            c as unknown as d3.Selection<d3.BaseType, unknown, null, undefined>,
            h.spec,
          );
        } else {
          const l = hitsG
            .append("line")
            .attr("x1", h.x1)
            .attr("y1", h.y1)
            .attr("x2", h.x2)
            .attr("y2", h.y2)
            .attr("stroke", "transparent")
            .attr("stroke-width", 14)
            .attr("stroke-linecap", "round")
            .style("pointer-events", "stroke");
          wire(
            l as unknown as d3.Selection<d3.BaseType, unknown, null, undefined>,
            h.spec,
          );
        }
      }

      // "Poke me" invite — a slow blood reticle breathing on a planet until the
      // first hover/tap, so it's obvious the wheel is alive. Motion-safe.
      if (!reduceMotion) {
        const invitePos =
          planetPos.get("Sun") ?? planetPos.get(sorted[0]?.name ?? "");
        if (invitePos) {
          const [ix, iy] = invitePos;
          const ring = root
            .append("circle")
            .attr("class", "wheel-invite")
            .attr("cx", ix)
            .attr("cy", iy)
            .attr("fill", "none")
            .attr("stroke", BLOOD)
            .attr("stroke-width", 1.5)
            .attr("opacity", 0)
            .style("pointer-events", "none");
          const loop = () => {
            ring
              .attr("r", 9)
              .attr("opacity", 0.75)
              .transition()
              .duration(1700)
              .ease(d3.easeCubicOut)
              .attr("r", 30)
              .attr("opacity", 0)
              .on("end", loop);
          };
          ring
            .transition()
            .delay(T(PLANET_START + sorted.length * PLANET_STEP + 700))
            .on("end", loop);
        }
      }
    }

    return () => {
      svg.on("click", null);
      svg.selectAll("*").interrupt().remove();
    };
  }, [chart, partner, names, onSelect]);

  // Selection highlight — dim the wheel, light the selected element (and, for
  // an aspect, the two planets it joins). Independent of the heavy draw effect.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll("[data-el-id]").classed("is-selected", false);

    if (!selectedId) {
      svgEl.classList.remove("has-selection");
      return;
    }
    svgEl.classList.add("has-selection");
    svg.selectAll(".wheel-invite").interrupt().remove();

    const ids = new Set<string>([selectedId]);

    // Selecting an aspect also lights the two planets it joins.
    const bare = partner ? selectedId.replace(/^a:/, "") : selectedId;
    if (bare.startsWith("aspect:")) {
      const asp = drawableAspects(chart).find((a) => aspectId(a) === bare);
      if (asp) {
        ids.add(partner ? `a:${planetId(asp.a)}` : planetId(asp.a));
        ids.add(partner ? `a:${planetId(asp.b)}` : planetId(asp.b));
      }
    }
    // A synastry line joins one planet from each ring.
    if (partner && selectedId.startsWith("synastry:")) {
      const hit = computeSynastry(chart, partner).find(
        (s) => synastryAspectId(s) === selectedId,
      );
      if (hit) {
        // Either end may be an angle rather than a planet.
        const endId = (slot: "a" | "b", body: string) =>
          body === "Ascendant"
            ? `${slot}:${angleId("ASC")}`
            : body === "MC"
              ? `${slot}:${angleId("MC")}`
              : `${slot}:${planetId(body)}`;
        ids.add(endId("a", hit.a));
        ids.add(endId("b", hit.b));
      }
    }
    ids.forEach((id) =>
      svg.selectAll(`[data-el-id="${id}"]`).classed("is-selected", true),
    );
  }, [selectedId, chart, partner]);

  return (
    <svg
      ref={svgRef}
      viewBox="-320 -320 640 640"
      className="w-full h-full"
      role="img"
      aria-label={
        partner
          ? `Synastry chart for ${chart.name} and ${partner.name}`
          : `Natal chart for ${chart.name}`
      }
    />
  );
}

NatalWheel.displayName = "NatalWheel";
