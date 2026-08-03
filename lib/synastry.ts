import type { AspectType, NatalChart, NatalPlanet } from "./types";

/**
 * Cross-aspects between two people's charts — the actual subject of a duo
 * roast. Person A's Moon squaring person B's Mars is the thing they came for;
 * neither chart on its own says it.
 *
 * Orbs and bodies mirror natal_chart.py's compute_aspects() exactly, so a
 * synastry aspect reads the same as an in-chart one. Keep them in sync.
 */

const ASPECT_DEFS: Record<AspectType, { angle: number; orb: number }> = {
  conjunction: { angle: 0, orb: 8 },
  sextile: { angle: 60, orb: 6 },
  square: { angle: 90, orb: 7 },
  trine: { angle: 120, orb: 7 },
  quincunx: { angle: 150, orb: 3 },
  opposition: { angle: 180, orb: 8 },
};

const ASPECT_BODIES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "Chiron",
] as const;

const LUMINARIES = new Set(["Sun", "Moon"]);
const LUMINARY_BONUS = 2;

export interface SynastryAspect {
  /** Body belonging to person A. */
  a: string;
  /** Body belonging to person B. */
  b: string;
  type: AspectType;
  /** Degrees away from exact. */
  orb: number;
  /** 5 = within a degree, 1 = barely in orb. Mirrors natal orb_strength(). */
  strength: 1 | 2 | 3 | 4 | 5;
}

/** Shortest angular distance between two ecliptic longitudes, 0-180. */
export function angularDifference(lon1: number, lon2: number): number {
  const diff = Math.abs(lon1 - lon2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function strengthFromOrb(orb: number): 1 | 2 | 3 | 4 | 5 {
  if (orb < 1) return 5;
  if (orb < 2) return 4;
  if (orb < 4) return 3;
  if (orb < 6) return 2;
  return 1;
}

/**
 * Aspect-eligible bodies plus the angles, which only exist when the birth time
 * is known. A chart with no birth time still produces planet-to-planet
 * synastry — just no Ascendant or MC contacts.
 */
function aspectPoints(chart: NatalChart): { name: string; lon: number }[] {
  const points: { name: string; lon: number }[] = chart.planets
    .filter((p: NatalPlanet) =>
      (ASPECT_BODIES as readonly string[]).includes(p.name),
    )
    .map((p) => ({ name: p.name, lon: p.lon }));

  if (chart.angles) {
    points.push({ name: "Ascendant", lon: chart.angles.ascendant.lon });
    points.push({ name: "MC", lon: chart.angles.mc.lon });
  }
  return points;
}

/**
 * Every aspect from person A's bodies to person B's bodies. Ordered tightest
 * orb first, so slicing the top N gives the aspects that actually matter.
 *
 * Unlike a natal chart this is not symmetric: A's Saturn on B's Sun is a
 * different statement from B's Saturn on A's Sun, so both directions are
 * computed and kept distinct.
 */
export function computeSynastry(
  chartA: NatalChart,
  chartB: NatalChart,
): SynastryAspect[] {
  const pointsA = aspectPoints(chartA);
  const pointsB = aspectPoints(chartB);
  const aspects: SynastryAspect[] = [];

  for (const a of pointsA) {
    for (const b of pointsB) {
      const separation = angularDifference(a.lon, b.lon);

      for (const [type, def] of Object.entries(ASPECT_DEFS) as [
        AspectType,
        { angle: number; orb: number },
      ][]) {
        const allowed =
          def.orb +
          (LUMINARIES.has(a.name) || LUMINARIES.has(b.name)
            ? LUMINARY_BONUS
            : 0);
        const orb = Math.abs(separation - def.angle);
        if (orb > allowed) continue;

        aspects.push({
          a: a.name,
          b: b.name,
          type,
          orb: Math.round(orb * 100) / 100,
          strength: strengthFromOrb(orb),
        });
      }
    }
  }

  return aspects.sort((x, y) => x.orb - y.orb);
}

/** Stable id for an aspect, used to key annotations and wheel selections. */
export function synastryAspectId(aspect: SynastryAspect): string {
  return `synastry:${aspect.a}-${aspect.type}-${aspect.b}`;
}
