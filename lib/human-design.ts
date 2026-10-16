import type { NatalChart } from "./types";
export type DesignChart = {
  type: string;
  authority: string;
  profile: string;
  definition: string;
  birthUTC: string;
  designUTC: string;
  personality: Record<string, { gate: number; line: number }>;
  design: Record<string, { gate: number; line: number }>;
};
export async function calculateDesign(
  birth: NatalChart["birth"],
): Promise<DesignChart> {
  if (!birth.timeKnown || !birth.utc || !/(Z|[+-]\d\d:\d\d)$/.test(birth.utc))
    throw new Error("A known birth time is needed for Human Design.");
  const date = new Date(birth.utc);
  if (!Number.isFinite(date.getTime()))
    throw new Error("The birth instant is invalid.");
  const { default: engine } = await import("./vendor/hd-engine.js");
  return engine.build(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    "+00:00",
  ) as unknown as DesignChart;
}
