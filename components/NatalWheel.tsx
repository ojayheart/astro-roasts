"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NatalChart } from "@/lib/types";
import {
  enumerateElements,
  drawableAspects,
  planetId,
  angleId,
  houseId,
  aspectId,
  signId,
  type WheelSelection,
} from "@/lib/chart-annotations";

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
  onSelect,
  onHover,
  selectedId,
}: {
  chart: NatalChart;
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
    const specById = new Map<string, WheelSelection>(
      enumerateElements(chart).map((e) => [
        e.id,
        { id: e.id, kind: e.kind, title: e.title },
      ]),
    );
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

      const sSpec = specById.get(signId(SIGN_NAMES[i]));
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

        const hSpec = specById.get(houseId(i + 1));
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

        const aSpec = specById.get(angleId(label));
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
    const sorted = [...chart.planets].sort((a, b) => a.lon - b.lon);
    const MIN_GAP = 7.5;
    const display = new Map<string, number>();
    let prev = -Infinity;
    for (const p of sorted) {
      const d = Math.max(p.lon, prev + MIN_GAP);
      display.set(p.name, d);
      prev = d;
    }
    // If the nudge chain wrapped past the first planet, that's a 14-planet
    // pile-up that doesn't happen in real charts — accept the overlap.

    const planetsG = root.append("g");
    const planetPos = new Map<string, [number, number]>();
    const PLANET_START = 2600;
    const PLANET_STEP = 320;
    sorted.forEach((p, i) => {
      const dLon = display.get(p.name)!;
      const [px, py] = toXY(dLon, R_PLANET);
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

      const pSpec = specById.get(planetId(p.name));
      if (pSpec) {
        g.attr("data-el-id", pSpec.id);
        hits.push({ kind: "circle", x: px, y: py, r: 22, spec: pSpec });
      }

      // Degree label, one step further in
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

    // ── 6. Aspect lines — planet-to-planet only, tightest first ─────────
    const lonOf = new Map(chart.planets.map((p) => [p.name, p.lon]));
    const drawable = chart.aspects.filter(
      (a) => lonOf.has(a.a) && lonOf.has(a.b) && a.type !== "conjunction",
    );
    const ASPECT_START = PLANET_START + sorted.length * PLANET_STEP + 400;
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

      const aspSpec = specById.get(aspectId(a));
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
  }, [chart, onSelect]);

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
    if (selectedId.startsWith("aspect:")) {
      const asp = drawableAspects(chart).find(
        (a) => aspectId(a) === selectedId,
      );
      if (asp) {
        ids.add(planetId(asp.a));
        ids.add(planetId(asp.b));
      }
    }
    ids.forEach((id) =>
      svg.selectAll(`[data-el-id="${id}"]`).classed("is-selected", true),
    );
  }, [selectedId, chart]);

  return (
    <svg
      ref={svgRef}
      viewBox="-320 -320 640 640"
      className="w-full h-full"
      role="img"
      aria-label={`Natal chart for ${chart.name}`}
    />
  );
}

NatalWheel.displayName = "NatalWheel";
