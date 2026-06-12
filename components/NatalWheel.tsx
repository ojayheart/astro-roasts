"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NatalChart } from "@/lib/types";

/**
 * The person's actual natal chart, drawn live on the loading screen.
 * Pure d3 inside a useEffect — d3 transitions own the draw-in sequencing.
 * Brand only: void bg, ash hairlines, blood accents, mono data labels.
 *
 * Orientation: Ascendant on the left (9 o'clock), longitudes increase
 * counterclockwise — standard chart convention. Unknown birth time → no
 * houses/angles; wheel orients 0° Aries left instead.
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

export default function NatalWheel({ chart }: { chart: NatalChart }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

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
      ring
        .append("text")
        .attr("x", gx)
        .attr("y", gy)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", ASH)
        .attr("font-size", 15)
        .attr("opacity", 0)
        .text(SIGN_GLYPHS[i])
        .transition()
        .delay(T(400 + i * 50))
        .duration(T(450))
        .attr("opacity", 0.4);
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
        housesG
          .append("text")
          .attr("x", nx)
          .attr("y", ny)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", ASH)
          .attr("font-family", MONO)
          .attr("font-size", 9)
          .attr("opacity", 0)
          .text(i + 1)
          .transition()
          .delay(T(1700 + i * 60))
          .duration(T(450))
          .attr("opacity", 0.3);
      });

      // ASC / MC labels just outside the ring
      const angles = [
        { label: "ASC", lon: chart.angles!.ascendant.lon },
        { label: "MC", lon: chart.angles!.mc.lon },
      ];
      for (const { label, lon } of angles) {
        const [lx, ly] = toXY(lon, R_RING_OUT + 14);
        housesG
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
          .text(label)
          .transition()
          .delay(T(2100))
          .duration(T(450))
          .attr("opacity", 0.85);
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
    const PLANET_START = 2600;
    const PLANET_STEP = 320;
    sorted.forEach((p, i) => {
      const dLon = display.get(p.name)!;
      const [px, py] = toXY(dLon, R_PLANET);
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
    });

    return () => {
      svg.selectAll("*").interrupt().remove();
    };
  }, [chart]);

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
