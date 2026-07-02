export type RoastKind = "solo" | "couple" | "family";

export type PersonInput = {
  name: string;
  gender: string;
  date: string;
  time: string | null;
  birthPlace: string;
};

export type ExtraPlacement = {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string | null;
};

// €8 for two, €4 per extra head, all supported currencies use the same
// number in minor units (matches the solo AMOUNT_BY_CURRENCY convention).
export function groupAmountMinorUnits(peopleCount: number): number {
  return 800 + 400 * (peopleCount - 2);
}

const KIND_BOUNDS: Record<string, { min: number; max: number }> = {
  couple: { min: 2, max: 2 },
  family: { min: 3, max: 6 },
};

function validPerson(raw: unknown): PersonInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const gender = typeof r.gender === "string" ? r.gender.trim() : "";
  const date = typeof r.date === "string" ? r.date.trim() : "";
  const birthPlace =
    typeof r.birthPlace === "string" ? r.birthPlace.trim() : "";
  const time =
    typeof r.time === "string" && r.time.trim() ? r.time.trim() : null;
  if (!name || !gender || !date || !birthPlace) return null;
  if (
    name.length > 80 ||
    gender.length > 60 ||
    date.length > 60 ||
    birthPlace.length > 160 ||
    (time && time.length > 40)
  ) {
    return null;
  }
  return { name, gender, date, time, birthPlace };
}

export function validateGroupRequest(
  kind: unknown,
  people: unknown,
):
  | { ok: true; kind: RoastKind; people: PersonInput[] }
  | { ok: false; error: string } {
  if (typeof kind !== "string" || !(kind in KIND_BOUNDS)) {
    return { ok: false, error: "Invalid kind" };
  }
  const bounds = KIND_BOUNDS[kind];
  if (!Array.isArray(people)) {
    return { ok: false, error: "people must be an array" };
  }
  if (people.length < bounds.min || people.length > bounds.max) {
    return {
      ok: false,
      error: `${kind} needs ${bounds.min}${bounds.min === bounds.max ? "" : `-${bounds.max}`} people`,
    };
  }
  const parsed: PersonInput[] = [];
  for (const raw of people) {
    const person = validPerson(raw);
    if (!person) return { ok: false, error: "Invalid person fields" };
    parsed.push(person);
  }
  return { ok: true, kind: kind as RoastKind, people: parsed };
}
