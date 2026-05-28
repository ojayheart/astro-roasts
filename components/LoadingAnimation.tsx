"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { ChartPlacement } from "@/lib/types";

const STATUSES = [
  "Locating your planets. Bracing for impact...",
  "Calculating exactly where it went wrong...",
  "Cross-referencing your delusions...",
  "Consulting Saturn. Saturn is disappointed...",
  "Measuring the gap between you and your potential...",
  "Asking Mercury why you said that in 2019...",
  "Tallying the red flags. Running low on ink...",
  "Translating your trauma into degrees and minutes...",
  "Finding the part you hoped we'd miss...",
  "Almost done. You're not going to love this...",
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

const SIGN_LABELS: Record<string, string> = {
  Aries: "ARI",
  Taurus: "TAU",
  Gemini: "GEM",
  Cancer: "CAN",
  Leo: "LEO",
  Virgo: "VIR",
  Libra: "LIB",
  Scorpio: "SCO",
  Sagittarius: "SAG",
  Capricorn: "CAP",
  Aquarius: "AQU",
  Pisces: "PIS",
};

const PLANET_LABELS: Record<string, string> = {
  Sun: "SUN",
  Moon: "MOO",
  Asc: "ASC",
  Mercury: "MER",
  Venus: "VEN",
  Mars: "MAR",
  Jupiter: "JUP",
  Saturn: "SAT",
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
      { r: 230, stroke: "#E5E5E5", opacity: 0.08 },
      { r: 178, stroke: "#E5E5E5", opacity: 0.18 },
      { r: 76, stroke: "#E5E5E5", opacity: 0.08 },
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

    // 12 outer-edge tick marks at sign boundaries (not full spokes)
    const ticks = d3.range(12).map((index) => {
      const angle = ((index * 30 - 90) * Math.PI) / 180;
      return {
        inner: pointOnCircle(angle, 178),
        outer: pointOnCircle(angle, 192),
      };
    });

    wheel
      .selectAll("line.tick")
      .data(ticks)
      .join("line")
      .attr("class", "tick")
      .attr("x1", (d) => d.inner.x)
      .attr("y1", (d) => d.inner.y)
      .attr("x2", (d) => d.outer.x)
      .attr("y2", (d) => d.outer.y)
      .attr("stroke", "#E5E5E5")
      .attr("stroke-width", 0.6)
      .attr("opacity", 0)
      .transition()
      .duration(700)
      .delay((_, index) => 600 + index * 40)
      .attr("opacity", 0.25);

    wheel
      .selectAll("text.sign")
      .data(SIGNS)
      .join("text")
      .attr("class", "sign")
      .attr(
        "x",
        (_, index) => pointOnCircle(placementAngle(SIGNS[index], 0), 212).x,
      )
      .attr(
        "y",
        (_, index) => pointOnCircle(placementAngle(SIGNS[index], 0), 212).y,
      )
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#E5E5E5")
      .attr("opacity", 0)
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .attr("letter-spacing", "0.1em")
      .text((sign) => SIGN_LABELS[sign])
      .transition()
      .duration(500)
      .delay((_, index) => 900 + index * 35)
      .attr("opacity", 0.4);

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
      .attr("stroke", "#E5E5E5")
      .attr("stroke-width", 0.6)
      .attr("opacity", 0);

    linkSelection
      .transition()
      .duration(900)
      .delay((_, index) => 1300 + index * 130)
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("opacity", 0.22);

    const nodeSelection = graph
      .selectAll("g.placement")
      .data(nodes)
      .join("g")
      .attr("class", "placement")
      .attr("transform", "translate(0,0)")
      .attr("opacity", 0);

    nodeSelection
      .append("circle")
      .attr("r", 3)
      .attr("fill", "#E5E5E5")
      .attr("opacity", 0.85);

    nodeSelection
      .append("text")
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#E5E5E5")
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .attr("letter-spacing", "0.1em")
      .attr("opacity", 0.7)
      .text(
        (d) => PLANET_LABELS[d.planet] || d.planet.slice(0, 3).toUpperCase(),
      );

    nodeSelection
      .transition()
      .duration(800)
      .delay((_, index) => 1000 + index * 90)
      .ease(d3.easeCubicOut)
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("opacity", 1);

    // Subtle, slow node breathe (no scale jump, just opacity)
    const pulseTimer = d3.interval(() => {
      nodeSelection
        .select("circle")
        .transition()
        .duration(1400)
        .attr("opacity", 0.5)
        .transition()
        .duration(1400)
        .attr("opacity", 0.85);
    }, 2800);

    wheel
      .transition()
      .duration(90000)
      .ease(d3.easeLinear)
      .attrTween("transform", () =>
        d3.interpolateString("rotate(0)", "rotate(360)"),
      )
      .on("end", function repeat() {
        d3.select(this)
          .attr("transform", "rotate(0)")
          .transition()
          .duration(90000)
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
      setStatusIndex((prev) => (prev + 1) % STATUSES.length);
    }, 1800);

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
          <span
            key={statusIndex}
            className="status-line text-xs md:text-sm tracking-[0.15em] text-blood uppercase"
          >
            {STATUSES[statusIndex]}
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
          Built from chart data. Delivered without padding.
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
