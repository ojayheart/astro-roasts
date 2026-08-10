import { parseBirthTime, resolveCoordinates } from "./compute-chart";
import type { ChartSubject } from "./compute-chart";
import type { BirthInput } from "./transits";

/** Stored subject → the birth arguments transits.py and natal_chart.py take. */
export async function birthInputFor(
  subject: ChartSubject,
): Promise<BirthInput | null> {
  const [year, month, day] = subject.dob.split("-").map(Number);
  if (!year || !month || !day) return null;

  const coords = await resolveCoordinates(subject.birthCity);
  if (!coords) return null;

  const { hour, minute } = parseBirthTime(subject.birthTime);
  return {
    name: subject.name,
    year,
    month,
    day,
    hour,
    minute,
    lat: coords.lat,
    lon: coords.lon,
    tz: coords.tz,
  };
}
