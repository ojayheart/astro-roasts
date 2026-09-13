import { computeChart, type ChartSubject } from "./compute-chart.ts";
import { calculateDesign } from "./human-design.ts";

/** Calculated on the server, never inferred by the writer from a type label. */
export async function prepareRoastEvidence(
  subject: ChartSubject,
  calculateNatal = computeChart,
  calculateHD = calculateDesign,
) {
  if (!subject.birthTime) return { status: "unknown-time" as const };
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(subject.birthTime)) {
    throw new Error("Invalid birth time for roast calculations");
  }
  const natal = await calculateNatal(subject);
  if (!natal?.birth.timeKnown) {
    throw new Error("Could not calculate birth instant for roast evidence");
  }
  const humanDesign = await calculateHD(natal.birth);
  return { status: "calculated" as const, birth: natal.birth, humanDesign };
}

export type RoastEvidence = Awaited<ReturnType<typeof prepareRoastEvidence>>;
