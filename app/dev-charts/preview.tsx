"use client";
import { useState } from "react";
import RoastWheel from "@/components/RoastWheel";
import type { NatalChart } from "@/lib/types";
const signs = [
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
const fixture = {
  schema: 1,
  name: "Sample A",
  birth: {
    date: "1994-01-21",
    time: "00:00",
    timeKnown: true,
    utc: "1994-01-21T00:00:00Z",
    tz: "UTC",
    lat: 0,
    lon: 0,
    dayOfWeek: "Friday",
    moonPhase: "",
    moonPhaseAngle: 0,
    sect: null,
    chartRuler: null,
    houseSystem: "",
  },
  planets: [
    ["Sun", 301],
    ["Moon", 48],
    ["Mercury", 312],
    ["Venus", 303],
    ["Mars", 290],
    ["Jupiter", 223],
    ["Saturn", 329],
    ["Uranus", 292],
    ["Neptune", 291],
    ["Pluto", 237],
  ].map(([name, lon]) => ({
    name: String(name),
    lon: Number(lon),
    sign: signs[Math.floor(Number(lon) / 30)],
    degInSign: Number(lon) % 30,
    house: null,
    retrograde: false,
    speed: 1,
  })),
  angles: null,
  houses: null,
  aspects: [
    { a: "Sun", b: "Jupiter", type: "square", orb: 12, strength: 1 },
    { a: "Moon", b: "Mars", type: "trine", orb: 2, strength: 4 },
  ],
  elements: { Fire: [], Earth: [], Air: [], Water: [] },
  modalities: { Cardinal: [], Fixed: [], Mutable: [] },
  stelliums: { bySign: {}, byHouse: {} },
  configurations: [],
} as NatalChart;
const unknown = {
  ...fixture,
  birth: { ...fixture.birth, timeKnown: false, time: null, utc: "" },
};
const partner = {
  ...fixture,
  name: "Sample B",
  birth: { ...fixture.birth, date: "2000-01-01", utc: "2000-01-01T12:00:00Z" },
};
export default function Preview() {
  const [mode, setMode] = useState("solo");
  return (
    <main style={{ maxWidth: 1200, margin: "auto", padding: 24 }}>
      <p>
        LOCAL QA — synthetic astrology placements; Human Design calculated from
        stated UTC.
      </p>
      <label>
        Scenario{" "}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          style={{ background: "#222", padding: 12 }}
        >
          <option value="solo">Solo</option>
          <option value="duo">Duo</option>
          <option value="unknown">Unknown time</option>
        </select>
      </label>
      <RoastWheel
        key={mode}
        roastId=""
        caption="Chart interaction preview"
        charts={{
          chart: mode === "unknown" ? unknown : fixture,
          charts: mode === "duo" ? [fixture, partner] : null,
        }}
      />
    </main>
  );
}
