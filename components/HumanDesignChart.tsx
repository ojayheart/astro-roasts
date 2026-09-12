"use client";
import { useEffect, useState, useRef } from "react";
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
const CENTER_COLORS: Record<string, string> = {
  Head: "#fbf7a5",
  Ajna: "#699e94",
  Throat: "#604942",
  G: "#fbf7a5",
  Ego: "#cf494c",
  Sacral: "#cf494c",
  Spleen: "#604942",
  SolarPlexus: "#604942",
  Root: "#604942",
};
const PLANET_SYMBOLS: Record<string, string> = {
  sun: "☉",
  earth: "⊕",
  moon: "☾",
  northNode: "☊",
  southNode: "☋",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
};
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
    [full, setFull] = useState(true),
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
    sources[g]?.some((s) => s.side === "personality") ? "#ffffff" : "#ce494b";
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
      <div className="chart-layout design-reference-layout">
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
          <div className="chart-map-scroll" data-chart-zoomed="true">
            <svg
              style={{
                width: `${zoom * 100}%`,
                minWidth: 640 * zoom,
                maxHeight: zoom > 1 ? "none" : 740,
              }}
              ref={graphRef}
              viewBox="-240 0 1290 1110"
              className="design-graph reference-bodygraph"
              role="group"
              aria-label={`Human Design chart for ${chart.name}`}
            >
              <path
                className="human-silhouette"
                fillRule="evenodd"
                d="M400 98 C340 98 297 144 297 205 L305 228 L289 269 Q282 281 298 287 L304 291 L305 329 Q305 350 336 347 Q359 345 353 375 C346 408 296 426 233 437 Q213 441 205 467 L79 859 Q63 897 90 920 C178 1013 265 1060 400 1064 C535 1060 622 1013 710 920 Q737 897 721 859 L595 467 Q587 441 567 437 C504 426 454 408 447 375 C440 342 450 320 472 287 C493 255 506 215 499 179 C491 132 452 98 400 98 Z"
                fill="#393939"
                stroke="#ffffff"
                strokeOpacity="0"
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
                      stroke="#191919"
                      strokeWidth="14"
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
                            strokeWidth="12"
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
                    fill={model.defined.has(id) ? CENTER_COLORS[id] : "#1c1c1c"}
                    stroke="none"
                    strokeWidth="2"
                  />
                </g>
              ))}
              {Object.keys(GATE_CENTRE)
                .map(Number)
                .filter(
                  (g) => full || model.channels.some((p) => p.includes(g)),
                )
                .map((g) => {
                  const port = gatePoint(g);
                  const p = {
                    x: port.x - port.dx * 12,
                    y: port.y - port.dy * 12,
                  };
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
                        fill={sources[g] ? "#111" : "transparent"}
                        stroke="none"
                      />
                      <text
                        x={p.x}
                        y={p.y + 4}
                        textAnchor="middle"
                        fill={
                          sources[g]
                            ? "#fff"
                            : model.defined.has(GATE_CENTRE[g]) &&
                                ["Head", "G", "Ajna"].includes(GATE_CENTRE[g])
                              ? "#555c50"
                              : "#aaa"
                        }
                        fontSize="13"
                      >
                        {g}
                      </text>
                    </g>
                  );
                })}
              {(["design", "personality"] as const).map((side) => (
                <g
                  key={side}
                  className="activation-column"
                  fill={side === "design" ? "#ce494b" : "#f4f4f4"}
                >
                  <text
                    x={side === "design" ? -130 : 940}
                    y="75"
                    textAnchor="middle"
                    fontSize="24"
                  >
                    {side === "design" ? "Design" : "Personality"}
                  </text>
                  <path
                    d={
                      side === "design" ? "M -215 95 H -45" : "M 855 95 H 1025"
                    }
                    stroke={side === "design" ? "#ce494b" : "#444"}
                    strokeWidth="2"
                  />
                  {Object.keys(PLANET_SYMBOLS).map((planet, i) => {
                    const activation = data[side][planet];
                    return activation ? (
                      <g
                        key={planet}
                        role="button"
                        tabIndex={0}
                        aria-label={
                          side +
                          " " +
                          planet +
                          " " +
                          activation.gate +
                          "." +
                          activation.line
                        }
                        onClick={() =>
                          setSelection({
                            title: "Gate " + activation.gate,
                            facts:
                              planet +
                              " · " +
                              side +
                              " · " +
                              activation.gate +
                              "." +
                              activation.line,
                            line: "The number after the dot is the line, from 1 to 6.",
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
                        <rect
                          x={side === "design" ? -215 : 855}
                          y={115 + i * 69}
                          width="170"
                          height="52"
                          fill="transparent"
                        />
                        <text
                          x={side === "design" ? -188 : 998}
                          y={150 + i * 69}
                          textAnchor="middle"
                          fontSize="28"
                          style={{ fontFamily: "var(--font-symbols),serif" }}
                        >
                          {PLANET_SYMBOLS[planet]}
                        </text>
                        <text
                          x={side === "design" ? -92 : 906}
                          y={150 + i * 69}
                          textAnchor="middle"
                          fontSize="24"
                        >
                          {activation.gate}.{activation.line}
                        </text>
                      </g>
                    ) : null;
                  })}
                </g>
              ))}
            </svg>
          </div>
          <p className="chart-hint">
            White = Personality, including both · Red = Design only.
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
