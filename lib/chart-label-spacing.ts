/** Place labels around a circle; chart longitudes themselves are never modified. */
export function spaceChartLabels(
  planets: { name: string; lon: number }[],
  spacing = 7.5,
): Map<string, number> {
  if (!planets.length) return new Map();
  const sorted = planets
    .map((p) => ({ ...p, lon: ((p.lon % 360) + 360) % 360 }))
    .sort((a, b) => a.lon - b.lon);
  const gap = Math.min(spacing, 360 / sorted.length);
  let cut = 0,
    largest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const next = (i + 1) % sorted.length;
    const d =
      next === 0
        ? sorted[0].lon + 360 - sorted[i].lon
        : sorted[next].lon - sorted[i].lon;
    if (d > largest) {
      largest = d;
      cut = next;
    }
  }
  const ordered = [...sorted.slice(cut), ...sorted.slice(0, cut)];
  const raw = ordered.map(
    (p, i) => p.lon + (i >= sorted.length - cut ? 360 : 0),
  );
  const positions = raw.map((p, i) => (i === 0 ? p : 0));
  for (let i = 1; i < positions.length; i++)
    positions[i] = Math.max(raw[i], positions[i - 1] + gap);
  // Keep the closing gap as well as internal gaps, even for synthetic dense charts.
  for (let pass = 0; pass < positions.length; pass++) {
    positions[0] = Math.max(positions[0], positions.at(-1)! - 360 + gap);
    for (let i = 1; i < positions.length; i++)
      positions[i] = Math.max(positions[i], positions[i - 1] + gap);
  }
  const shift =
    positions.reduce((sum, p, i) => sum + p - raw[i], 0) / positions.length;
  return new Map(
    ordered.map((p, i) => [
      p.name,
      (((positions[i] - shift) % 360) + 360) % 360,
    ]),
  );
}
