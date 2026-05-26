"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { ChartPlacement } from "@/lib/types";

const STATUSES = [
  "Calculating planetary positions...",
  "Mapping house placements...",
  "Analyzing aspects...",
  "Identifying patterns...",
  "Compiling weaknesses...",
  "Preparing your reading...",
];

const FALLBACK_PLACEMENTS: ChartPlacement[] = [
  { planet: "Sun", sign: "Aries" },
  { planet: "Moon", sign: "Cancer" },
  { planet: "Mercury", sign: "Gemini" },
  { planet: "Venus", sign: "Taurus" },
  { planet: "Mars", sign: "Leo" },
  { planet: "Jupiter", sign: "Sagittarius" },
  { planet: "Saturn", sign: "Capricorn" },
];

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
];

const SIGN_GLYPHS: Record<string, string> = {
  Aries: "\u2648",
  Taurus: "\u2649",
  Gemini: "\u264A",
  Cancer: "\u264B",
  Leo: "\u264C",
  Virgo: "\u264D",
  Libra: "\u264E",
  Scorpio: "\u264F",
  Sagittarius: "\u2650",
  Capricorn: "\u2651",
  Aquarius: "\u2652",
  Pisces: "\u2653",
};

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Asc: "AC",
  Mercury: "\u263F",
  Venus: "\u2640",
  Mars: "\u2642",
  Jupiter: "\u2643",
  Saturn: "\u2644",
};

interface LoadingAnimationProps {
  placements?: ChartPlacement[];
  onComplete?: () => void;
}

interface ChartNode extends ChartPlacement {
  angle: number;
  radius: number;
  x: number;
  y: number;
}

function placementAngle(sign: string, index: number): number {
  const signIndex = Math.max(SIGNS.indexOf(sign), 0);
  return ((signIndex * 30 + 15 + index * 4 - 90) * Math.PI) / 180;
}

function pointOnCircle(angle: number, radius: number) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function normalizePlacements(placements?: ChartPlacement[]): ChartPlacement[] {
  const actual = (placements || []).filter(
    (placement) => placement.planet && placement.sign,
  );
  return actual.length > 0 ? actual : FALLBACK_PLACEMENTS;
}

export default function LoadingAnimation({
  placements,
  onComplete,
}: LoadingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const chartPlacements = useMemo(
    () => normalizePlacements(placements),
    [placements],
  );
  const hasActualPlacements = (placements || []).length > 0;

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 500;
    const height = 500;
    const center = { x: width / 2, y: height / 2 };
    const radius = 178;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${center.x}, ${center.y})`);

    const wheel = root.append("g").attr("class", "chart-wheel");
    const graph = root.append("g").attr("class", "placement-graph");

    const rings = [
      { r: 230, stroke: "#E5E5E5", opacity: 0.1 },
      { r: 205, stroke: "#E5E5E5", opacity: 0.24 },
      { r: 178, stroke: "#FF2A00", opacity: 0.55 },
      { r: 76, stroke: "#E5E5E5", opacity: 0.18 },
    ];

    wheel
      .selectAll("circle")
      .data(rings)
      .join("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "none")
      .attr("stroke", (d) => d.stroke)
      .attr("stroke-width", 1)
      .attr("opacity", (d) => d.opacity)
      .attr("stroke-dasharray", function () {
        const length = (this as SVGCircleElement).getTotalLength();
        return `${length} ${length}`;
      })
      .attr("stroke-dashoffset", function () {
        return (this as SVGCircleElement).getTotalLength();
      })
      .transition()
      .duration(1800)
      .delay((_, index) => index * 120)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    const spokes = d3.range(12).map((index) => {
      const angle = ((index * 30 - 90) * Math.PI) / 180;
      return {
        inner: pointOnCircle(angle, 76),
        outer: pointOnCircle(angle, 230),
      };
    });

    wheel
      .selectAll("line.spoke")
      .data(spokes)
      .join("line")
      .attr("class", "spoke")
      .attr("x1", (d) => d.inner.x)
      .attr("y1", (d) => d.inner.y)
      .attr("x2", (d) => d.outer.x)
      .attr("y2", (d) => d.outer.y)
      .attr("stroke", "#E5E5E5")
      .attr("stroke-width", 1)
      .attr("opacity", 0)
      .transition()
      .duration(700)
      .delay((_, index) => 600 + index * 45)
      .attr("opacity", 0.13);

    wheel
      .selectAll("text.sign")
      .data(SIGNS)
      .join("text")
      .attr("class", "sign")
      .attr("x", (_, index) => pointOnCircle(placementAngle(SIGNS[index], 0), 215).x)
      .attr("y", (_, index) => pointOnCircle(placementAngle(SIGNS[index], 0), 215).y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#E5E5E5")
      .attr("opacity", 0)
      .attr("font-size", 17)
      .text((sign) => SIGN_GLYPHS[sign])
      .transition()
      .duration(500)
      .delay((_, index) => 900 + index * 35)
      .attr("opacity", 0.5);

    const nodes: ChartNode[] = chartPlacements.map((placement, index) => {
      const angle = placementAngle(placement.sign, index);
      const placementRadius = radius - (index % 3) * 18;
      const point = pointOnCircle(angle, placementRadius);
      return {
        ...placement,
        angle,
        radius: placementRadius,
        x: point.x,
        y: point.y,
      };
    });

    const links = nodes.slice(1).map((node, index) => ({
      source: nodes[index],
      target: node,
      hot: index % 2 === 0,
    }));

    const linkSelection = graph
      .selectAll("line.aspect")
      .data(links)
      .join("line")
      .attr("class", "aspect")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 0)
      .attr("stroke", (d) => (d.hot ? "#FF2A00" : "#E5E5E5"))
      .attr("stroke-width", 1)
      .attr("opacity", 0);

    linkSelection
      .transition()
      .duration(900)
      .delay((_, index) => 1300 + index * 130)
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("opacity", (d) => (d.hot ? 0.62 : 0.28));

    const nodeSelection = graph
      .selectAll("g.placement")
      .data(nodes)
      .join("g")
      .attr("class", "placement")
      .attr("transform", "translate(0,0)")
      .attr("opacity", 0);

    nodeSelection
      .append("circle")
      .attr("r", 18)
      .attr("fill", "#030303")
      .attr("stroke", "#FF2A00")
      .attr("stroke-width", 1.4);

    nodeSelection
      .append("circle")
      .attr("r", 5)
      .attr("fill", "#FF2A00");

    nodeSelection
      .append("text")
      .attr("y", -25)
      .attr("text-anchor", "middle")
      .attr("fill", "#E5E5E5")
      .attr("font-size", 11)
      .attr("font-family", "monospace")
      .attr("letter-spacing", "0.08em")
      .text((d) => d.planet.toUpperCase());

    nodeSelection
      .append("text")
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#E5E5E5")
      .attr("font-size", 14)
      .attr("font-family", "monospace")
      .text((d) => PLANET_GLYPHS[d.planet] || d.planet.slice(0, 2));

    nodeSelection
      .transition()
      .duration(950)
      .delay((_, index) => 1000 + index * 115)
      .ease(d3.easeBackOut.overshoot(1.8))
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("opacity", 1);

    const pulseTimer = d3.interval(() => {
      nodeSelection
        .select("circle")
        .transition()
        .duration(800)
        .attr("r", 22)
        .attr("opacity", 0.42)
        .transition()
        .duration(800)
        .attr("r", 18)
        .attr("opacity", 1);
    }, 1700);

    wheel
      .transition()
      .duration(40000)
      .ease(d3.easeLinear)
      .attrTween("transform", () => d3.interpolateString("rotate(0)", "rotate(360)"))
      .on("end", function repeat() {
        d3.select(this)
          .attr("transform", "rotate(0)")
          .transition()
          .duration(40000)
          .ease(d3.easeLinear)
          .attrTween("transform", () =>
            d3.interpolateString("rotate(0)", "rotate(360)"),
          )
          .on("end", repeat);
      });

    return () => {
      pulseTimer.stop();
      svg.selectAll("*").interrupt();
      svg.selectAll("*").remove();
    };
  }, [chartPlacements]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => {
        if (prev >= STATUSES.length - 1) return prev;
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100 && !completedRef.current) {
      completedRef.current = true;
      if (flashRef.current) {
        d3.select(flashRef.current)
          .transition()
          .duration(150)
          .style("opacity", 1)
          .on("end", () => {
            setTimeout(() => onComplete?.(), 200);
          });
      }
    }
  }, [progress, onComplete]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3;
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className="font-syne font-extrabold text-[25vw] leading-none text-ash opacity-5 tracking-tighter">
          {String(Math.min(Math.round(progress), 99)).padStart(2, "0")}
        </span>
      </div>

      <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px] z-10 chart-glow">
        <svg ref={svgRef} id="natal-chart" className="w-full h-full" />
      </div>

      <div className="absolute bottom-32 md:bottom-40 flex flex-col items-center z-20 px-6">
        <div className="h-6 overflow-hidden relative w-full text-center flex items-center justify-center">
          <span className="text-xs md:text-sm tracking-[0.15em] text-blood uppercase">
            {hasActualPlacements ? STATUSES[statusIndex] : "Reading the place you gave us..."}
          </span>
        </div>
        <div className="w-64 h-[1px] bg-bruise mt-4 relative overflow-hidden">
          <div
            ref={progressRef}
            className="absolute top-0 left-0 h-full bg-blood transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <footer className="absolute bottom-8 w-full text-center z-20 pointer-events-none px-6">
        <p className="text-[10px] md:text-xs tracking-[0.3em] text-ash/40 uppercase">
          The stars don&apos;t sugarcoat. Neither do we.
        </p>
      </footer>

      <div
        ref={flashRef}
        className="fixed inset-0 bg-blood opacity-0 pointer-events-none z-[100]"
      />
    </div>
  );
}

LoadingAnimation.displayName = "LoadingAnimation";
