"use client";
import { useEffect, useId, useState, useRef } from "react";
import { calculateDesign, type DesignChart } from "@/lib/human-design";
import {
  CENTRES,
  PAIRS,
  GATE_CENTRE,
  derive,
  gatePoint,
  channelPath,
  keyOf,
  centrePath,
} from "@/lib/human-design-graph.js";
import type { NatalChart } from "@/lib/types";
const centers = CENTRES as Record<
  string,
  {
    name: string;
    theme: string;
    x: number;
    y: number;
    r: number;
    gates: number[];
    summary: string;
    reflection: string;
  }
>;
export default function HumanDesignChart({ chart }: { chart: NatalChart }) {
  const [data, setData] = useState<DesignChart | null>(null),
    [error, setError] = useState(""),
    [full, setFull] = useState(false),
    [selection, setSelection] = useState<{
      title: string;
      facts: string;
      line: string;
    } | null>(null);
  const [zoom, setZoom] = useState(1);
  const detailRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (
      selection &&
      window.matchMedia("(max-width:680px)").matches &&
      detailRef.current
    ) {
      detailRef.current.focus({ preventScroll: true });
      window.scrollTo({
        top:
          detailRef.current.getBoundingClientRect().top + window.scrollY - 24,
        behavior: "instant",
      });
    }
  }, [selection]);
  const pattern = useId().replace(/:/g, "");
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setSelection(null);
    if (chart.birth.timeKnown)
      calculateDesign(chart.birth)
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {
          if (alive)
            setError(
              "We couldn’t calculate this chart. Check the saved birth details and reload.",
            );
        });
    return () => {
      alive = false;
    };
  }, [chart]);
  if (!chart.birth.timeKnown)
    return (
      <div className="chart-empty">
        <h3>Even the cosmos needs a timestamp.</h3>
        <p>
          Human Design needs a known birth time. Your astrology chart is still
          available; we won’t invent the missing details.
        </p>
      </div>
    );
  if (!data)
    return (
      <div className="chart-empty" role="status">
        {error || "Calculating your connections…"}
      </div>
    );
  const model = derive(data),
    sources = model.sources as Record<
      number,
      { side: string; planet: string; line: number }[]
    >;
  const complete = (a: number, b: number) => !!sources[a] && !!sources[b];
  const source = (g: number) =>
    sources[g]?.some((s) => s.side === "personality")
      ? sources[g]?.some((s) => s.side === "design")
        ? `url(#${pattern})`
        : "#e5e5e5"
      : "#ff2a00";
  const chosenPair = PAIRS.find(
    ([a, b]) => selection?.title === `Channel ${a}–${b}`,
  );
  const chosenGate = selection?.title.startsWith("Gate ")
    ? Number(selection.title.slice(5))
    : null;
  const chosenCenter = Object.keys(centers).find(
    (id) => centers[id].name === selection?.title,
  );
  const focusGates =
    chosenPair ||
    (chosenGate
      ? [chosenGate]
      : chosenCenter
        ? centers[chosenCenter].gates
        : []);
  const focusPairs = chosenPair
    ? [chosenPair]
    : PAIRS.filter((p) => p.some((g) => focusGates.includes(g)));
  const focusCenters = new Set(focusPairs.flat().map((g) => GATE_CENTRE[g]));
  const opacity = (active: boolean) => (!selection || active ? 1 : 0.18);
  const chooseChannel = (a: number, b: number) =>
    setSelection({
      title: `Channel ${a}–${b}`,
      facts: `${centers[GATE_CENTRE[a]].name} ↔ ${centers[GATE_CENTRE[b]].name}. ${complete(a, b) ? "Both gates are activated: this channel defines both connected centres." : "This channel is incomplete and does not define either centre."}`,
      line: complete(a, b)
        ? "An actual connection. Finally, something in this chart has committed."
        : "Potential is lovely. It still isn’t a complete connection.",
    });
  return (
    <div>
      <div className="chart-stats">
        {[
          ["Type", data.type],
          ["Authority", data.authority],
          ["Profile", data.profile],
          ["Definition", data.definition],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="chart-controls">
        <p>
          {model.channels.length} defined connections · {model.defined.size}{" "}
          defined centres
        </p>
        <button aria-pressed={full} onClick={() => setFull(!full)}>
          {full ? "Show essentials" : "Show all gates & channels"}
        </button>
      </div>
      <div className="chart-layout">
        <div>
          <div
            className="chart-zoom"
            role="group"
            aria-label="Human Design chart zoom"
          >
            <button
              disabled={zoom === 1}
              onClick={() => setZoom(Math.max(1, zoom - 0.5))}
              aria-label="Zoom out"
            >
              −
            </button>
            <output>{zoom * 100}%</output>
            <button
              disabled={zoom === 2.5}
              onClick={() => setZoom(Math.min(2.5, zoom + 0.5))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <div className="chart-map-scroll" data-chart-zoomed={zoom > 1}>
            <svg
              style={{
                width: `${zoom * 100}%`,
                maxHeight: zoom > 1 ? "none" : 740,
              }}
              ref={graphRef}
              viewBox="0 0 810 1110"
              className="design-graph"
              role="group"
              aria-label={`Human Design chart for ${chart.name}`}
            >
              <defs>
                <pattern
                  id={pattern}
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#e5e5e5" />
                  <rect width="4" height="8" fill="#ff2a00" />
                </pattern>
                <filter
                  id={pattern + "-light"}
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur stdDeviation="4" />
                  <feComponentTransfer>
                    <feFuncA type="linear" slope=".65" />
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient
                  id={pattern + "-body"}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop stopColor="#e5e5e5" stopOpacity=".10" />
                  <stop offset=".55" stopColor="#e5e5e5" stopOpacity=".035" />
                  <stop offset="1" stopColor="#ff2a00" stopOpacity=".06" />
                </linearGradient>
              </defs>
              <path
                className="human-silhouette" fillRule="evenodd"
                d="M400 25 C348 25 309 65 309 119 L303 159 L289 183 Q282 196 300 204 L308 208 L310 249 Q310 280 343 282 L349 315 L345 350 C319 373 254 383 222 419 C190 456 179 525 158 591 L89 769 C69 814 66 859 96 898 C130 939 187 961 252 980 C292 996 318 1022 342 1051 C366 1080 434 1080 458 1051 C482 1022 508 996 548 980 C613 961 670 939 704 898 C734 859 731 814 711 769 L642 591 C621 525 610 456 578 419 C546 383 481 373 455 350 L451 315 C470 295 489 267 489 221 L489 134 C489 72 452 25 400 25 Z M250 465 C230 531 202 616 174 680 L204 704 C229 638 251 581 273 538 Z M550 465 C570 531 598 616 626 680 L596 704 C571 638 549 581 527 538 Z M162 877 C234 837 322 861 388 918 C298 909 231 927 162 877 Z M638 877 C566 837 478 861 412 918 C502 909 569 927 638 877 Z"
                fill={`url(#${pattern}-body)`}
                stroke="#e5e5e5"
                strokeOpacity=".10"
                strokeWidth="1.5"
                pointerEvents="none"
                aria-hidden="true"
              />
              {PAIRS.filter(([a, b]) => full || complete(a, b)).map(
                ([a, b]) => (
                  <g
                    key={keyOf(a, b)}
                    style={{
                      opacity: opacity(
                        focusPairs.some((p) => keyOf(...p) === keyOf(a, b)),
                      ),
                    }}
                    aria-pressed={selection?.title === `Channel ${a}–${b}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Channel ${a}–${b}, ${complete(a, b) ? "defined" : "incomplete"}`}
                    onClick={() => chooseChannel(a, b)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chooseChannel(a, b);
                      }
                    }}
                  >
                    <path
                      d={channelPath(a, b)}
                      fill="none"
                      stroke="#444"
                      strokeWidth="3"
                    />
                    {[a, b].map(
                      (g, i) =>
                        sources[g] && (
                          <path
                            key={g}
                            d={channelPath(a, b)}
                            pathLength="100"
                            fill="none"
                            className="light-cable"
                            stroke={source(g)}
                            strokeWidth="6"
                            filter={`url(#${pattern}-light)`}
                            strokeDasharray="50 50"
                            strokeDashoffset={i === 0 ? 0 : -50}
                          />
                        ),
                    )}
                    <path
                      d={channelPath(a, b)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="25"
                    />
                  </g>
                ),
              )}
              {Object.entries(centers).map(([id, c]) => (
                <g
                  key={id}
                  style={{
                    opacity: opacity(
                      focusCenters.has(id) || chosenCenter === id,
                    ),
                  }}
                  aria-pressed={chosenCenter === id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.name}, ${model.defined.has(id) ? "defined" : "undefined"}`}
                  onClick={() =>
                    setSelection({
                      title: c.name,
                      facts: `${model.defined.has(id) ? "Defined by a complete channel." : "Undefined: no complete channel connects here."} ${c.summary}`,
                      line: c.reflection,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.dispatchEvent(
                        new MouseEvent("click", { bubbles: true }),
                      );
                    }
                  }}
                >
                  <path
                    d={centrePath(id)}
                    strokeLinejoin="round"
                    fill={model.defined.has(id) ? "#321108" : "#090909"}
                    stroke={model.defined.has(id) ? "#ff2a00" : "#666"}
                    strokeWidth="2"
                  />
                  <text
                    x={c.x}
                    y={c.y - 3}
                    textAnchor="middle"
                    fill="#e5e5e5"
                    fontSize="17"
                  >
                    {id === "SolarPlexus"
                      ? "Emotional"
                      : id === "G"
                        ? "Identity"
                        : id === "Ego"
                          ? "Heart"
                          : id}
                  </text>
                  <text
                    x={c.x}
                    y={c.y + 19}
                    textAnchor="middle"
                    fill="#aaa"
                    fontSize="11"
                  >
                    {model.defined.has(id) ? "DEFINED" : "UNDEFINED"}
                  </text>
                </g>
              ))}
              {Object.keys(GATE_CENTRE)
                .map(Number)
                .filter(
                  (g) => full || model.channels.some((p) => p.includes(g)),
                )
                .map((g) => {
                  const p = gatePoint(g);
                  return (
                    <g
                      key={g}
                      style={{
                        opacity: opacity(focusPairs.some((p) => p.includes(g))),
                      }}
                      aria-pressed={chosenGate === g}
                      role="button"
                      tabIndex={0}
                      aria-label={`Gate ${g}, ${sources[g] ? "activated" : "inactive"}`}
                      onClick={() =>
                        setSelection({
                          title: `Gate ${g}`,
                          facts:
                            sources[g]
                              ?.map(
                                (s) =>
                                  `${s.planet} · ${s.side} · ${g}.${s.line}`,
                              )
                              .join(" / ") ||
                            "No natal activation. An inactive gate does not define a centre.",
                          line: "The number after the dot is the line, from 1 to 6. Same gate, more detail.",
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.dispatchEvent(
                            new MouseEvent("click", { bubbles: true }),
                          );
                        }
                      }}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="14"
                        fill="#030303"
                        stroke={sources[g] ? "#e5e5e5" : "#555"}
                      />
                      <text
                        x={p.x}
                        y={p.y + 4}
                        textAnchor="middle"
                        fill={sources[g] ? "#fff" : "#999"}
                        fontSize="13"
                      >
                        {g}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
          <p className="chart-hint">
            Ash = Personality · Red = Design · Stripes = both.
            <br />
            Crossing lines don’t connect. Numbered gates do.
          </p>
        </div>
        <aside className="chart-reader">
          <small>YOUR CONNECTIONS</small>
          <p className="chart-hint">
            Select a connection, centre or numbered gate.
          </p>
          {model.channels.map(([a, b]) => (
            <button
              className="chart-row"
              key={keyOf(a, b)}
              onClick={() => chooseChannel(a, b)}
            >
              <strong>
                {a}–{b}
              </strong>
              <span>
                {centers[GATE_CENTRE[a]].name} ↔ {centers[GATE_CENTRE[b]].name}
              </span>
            </button>
          ))}
          {!model.channels.length && (
            <p>No complete channels. All nine centres are undefined.</p>
          )}
          <div
            ref={detailRef}
            tabIndex={-1}
            className="chart-detail"
            aria-live="polite"
          >
            {selection && (
              <button
                className="chart-return"
                onClick={() => {
                  setSelection(null);
                  graphRef.current?.scrollIntoView({
                    block: "center",
                    behavior: "instant",
                  });
                }}
              >
                ↑ Back to graph
              </button>
            )}
            <h3>{selection?.title || "Your wiring. With receipts."}</h3>
            <p>
              {selection?.facts ||
                "A coloured half is an activated gate. Two activated endpoints make a complete channel. Only complete channels define centres."}
            </p>
            <p className="chart-roast">
              {selection?.line ||
                "One interested party does not make a relationship. Your channels understand this."}
            </p>
          </div>
          <p className="chart-hint">
            Human Design is an interpretive system. Design activations use the
            instant the Sun was 88° earlier than at birth.
          </p>
        </aside>
      </div>
    </div>
  );
}
