// Decorative natal wheel behind the hero headline. Custom hand-drawn zodiac
// glyphs (stroke paths, not font glyphs) so the mark is ownable and renders
// identically everywhere. Zodiac band and inner chart counter-rotate slowly;
// everything sits at low opacity so the headline stays the hero.

import { ZODIAC_PATHS, ZODIAC_SIGNS } from "./zodiacPaths";

const C = 500; // centre of the 1000×1000 viewBox

// Glyphs drawn in a 10×10 box centred on 0,0 (see zodiacPaths.ts).
const SIGN_PATHS = ZODIAC_SIGNS.map((sign) => ZODIAC_PATHS[sign]);

// A few planets parked on the wheel, drawn in the same hand.
const PLANETS: { lon: number; path: string }[] = [
  // Sun
  {
    lon: 18,
    path: "M0 -3.6 A3.6 3.6 0 1 1 -0.01 -3.6 M0 -0.6 A0.6 0.6 0 1 1 -0.01 -0.6",
  },
  // Moon
  { lon: 103, path: "M1.2 -3.8 A3.8 3.8 0 1 0 1.2 3.8 A3 3 0 1 1 1.2 -3.8" },
  // Venus
  {
    lon: 157,
    path: "M0 -1.8 A2.6 2.6 0 1 1 -0.01 -1.8 M0 3.4 L0 5.2 M-1.6 4.3 L1.6 4.3 M0 -1.8 L0 0",
  },
  // Mars
  {
    lon: 214,
    path: "M-1.2 -0.6 A2.8 2.8 0 1 0 -1.19 -0.6 M0.8 -1.2 L4 -4.4 M1.6 -4.4 L4 -4.4 L4 -2",
  },
  // Saturn
  {
    lon: 286,
    path: "M-2.6 -4.6 L-2.6 2 M-4 -3.4 L-1.2 -3.4 M-2.6 0 C-1.6 -2.4 2.6 -2.2 2.2 0.8 C1.9 2.6 0.4 3 1.4 4.8",
  },
  // Mercury
  {
    lon: 341,
    path: "M-2.2 -4.8 C-1.6 -3 1.6 -3 2.2 -4.8 M0 -3.2 A2.3 2.3 0 1 1 -0.01 -3.2 M0 1.4 L0 4.8 M-1.5 3.3 L1.5 3.3",
  },
];

// Unequal house cusps, like a real chart.
const CUSPS = [0, 27, 58, 91, 121, 149, 180, 207, 238, 271, 301, 329];

// Aspect chords between planets (indexes into PLANETS); hard ones in blood.
const ASPECTS: { a: number; b: number; hard: boolean }[] = [
  { a: 0, b: 1, hard: true },
  { a: 0, b: 3, hard: true },
  { a: 1, b: 3, hard: false },
  { a: 2, b: 4, hard: false },
  { a: 3, b: 5, hard: false },
  { a: 4, b: 0, hard: true },
  { a: 2, b: 5, hard: false },
];

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
}

const f = (n: number) => n.toFixed(2);

const GLYPH_R = 412;
const GLYPH_SCALE = 3.4;

function signGlyph(d: string, i: number) {
  const [gx, gy] = polar(GLYPH_R, i * 30 + 15);
  // Glyphs face outward along the ring, like a printed chart.
  return (
    <path
      key={i}
      d={d}
      transform={`translate(${f(gx)} ${f(gy)}) rotate(${i * 30 + 15}) scale(${GLYPH_SCALE})`}
      strokeWidth={1.3 / GLYPH_SCALE}
    />
  );
}

export default function AstroWheel({ className = "" }: { className?: string }) {
  const ticks = Array.from({ length: 360 }, (_, d) => {
    const len = d % 30 === 0 ? 0 : d % 10 === 0 ? 16 : d % 5 === 0 ? 11 : 6;
    if (!len) return null;
    const [x1, y1] = polar(478, d);
    const [x2, y2] = polar(478 - len, d);
    return (
      <line
        key={d}
        x1={f(x1)}
        y1={f(y1)}
        x2={f(x2)}
        y2={f(y2)}
        opacity={d % 10 === 0 ? 0.7 : 0.4}
      />
    );
  });

  const ASPECT_R = 248;

  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        {/* Fixed spotlight at 12 o'clock; the glyph ring rotates under it. */}
        <radialGradient
          id="astro-spot-grad"
          gradientUnits="userSpaceOnUse"
          cx={C}
          cy={C - GLYPH_R}
          r="120"
        >
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask
          id="astro-spot"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1000"
          height="1000"
        >
          <rect width="1000" height="1000" fill="url(#astro-spot-grad)" />
        </mask>
        <filter id="astro-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g opacity="0.13">
        {/* Outer zodiac: ticks, band, glyphs */}
        <g className="astro-wheel-outer" strokeWidth="1.2">
          <circle cx={C} cy={C} r="478" />
          <circle cx={C} cy={C} r="452" opacity="0.5" />
          <circle cx={C} cy={C} r="372" />
          <g strokeWidth="1">{ticks}</g>
          {SIGN_PATHS.map((_, i) => {
            const [x1, y1] = polar(478, i * 30);
            const [x2, y2] = polar(372, i * 30);
            return (
              <line
                key={i}
                x1={f(x1)}
                y1={f(y1)}
                x2={f(x2)}
                y2={f(y2)}
                opacity="0.8"
              />
            );
          })}
          {SIGN_PATHS.map(signGlyph)}
        </g>

        {/* Inner chart: houses, planets, aspects — counter-rotates */}
        <g className="astro-wheel-inner" strokeWidth="1">
          <circle cx={C} cy={C} r="300" strokeDasharray="2 7" opacity="0.8" />
          <circle cx={C} cy={C} r={ASPECT_R} opacity="0.7" />
          <circle cx={C} cy={C} r="7" />
          {CUSPS.map((deg, i) => {
            const angular = i % 3 === 0;
            const [x1, y1] = polar(372, deg);
            const [x2, y2] = polar(angular ? 60 : ASPECT_R, deg);
            return (
              <line
                key={deg}
                x1={f(x1)}
                y1={f(y1)}
                x2={f(x2)}
                y2={f(y2)}
                opacity={angular ? 0.55 : 0.35}
              />
            );
          })}
          {PLANETS.map((p) => {
            const [gx, gy] = polar(336, p.lon);
            const [tx1, ty1] = polar(ASPECT_R, p.lon);
            const [tx2, ty2] = polar(ASPECT_R + 12, p.lon);
            return (
              <g key={p.lon}>
                <path
                  d={p.path}
                  transform={`translate(${f(gx)} ${f(gy)}) scale(3.2)`}
                  strokeWidth={1.2 / 3.2}
                />
                <line x1={f(tx1)} y1={f(ty1)} x2={f(tx2)} y2={f(ty2)} />
                <circle
                  cx={f(tx1)}
                  cy={f(ty1)}
                  r="3"
                  fill="currentColor"
                  stroke="none"
                />
              </g>
            );
          })}
          {ASPECTS.map(({ a, b, hard }) => {
            const [x1, y1] = polar(ASPECT_R, PLANETS[a].lon);
            const [x2, y2] = polar(ASPECT_R, PLANETS[b].lon);
            return (
              <line
                key={`${a}-${b}`}
                x1={f(x1)}
                y1={f(y1)}
                x2={f(x2)}
                y2={f(y2)}
                className={hard ? "text-blood" : undefined}
                stroke={hard ? "currentColor" : undefined}
                strokeWidth={hard ? 1.6 : 1}
                strokeDasharray={hard ? undefined : "6 6"}
                opacity={hard ? 1 : 0.6}
              />
            );
          })}
        </g>
      </g>

      {/* Glow pass: same glyphs, same spin, only visible under the spotlight */}
      <g mask="url(#astro-spot)">
        <g
          className="astro-wheel-outer text-blood"
          stroke="currentColor"
          filter="url(#astro-glow)"
          opacity="0.85"
        >
          {SIGN_PATHS.map(signGlyph)}
        </g>
      </g>
    </svg>
  );
}
