import { normalizeBirthLocation } from "./location.ts";

/**
 * Request parsing and response shaping for /api/me*, kept free of the db
 * client so the tests can exercise it without Neon.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TZ_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;

export type BirthInput = {
  dob: string;
  birthTime: string | null;
  birthCity: string;
};

export function parseBirthInput(body: unknown): BirthInput | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const dob = typeof b.date === "string" ? b.date.trim() : "";
  if (!DATE_RE.test(dob) || Number.isNaN(Date.parse(dob))) return null;

  const place = typeof b.birthPlace === "string" ? b.birthPlace.trim() : "";
  if (!place || place.length > 160) return null;

  const time = typeof b.time === "string" ? b.time.trim() : "";
  if (time && !TIME_RE.test(time)) return null;

  return {
    dob,
    birthTime: time || null,
    birthCity: normalizeBirthLocation(place),
  };
}

export type DeviceInput = {
  apnsToken: string;
  tz: string;
  notifyHour: number;
  build: string | null;
};

export function parseDeviceInput(body: unknown): DeviceInput | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const apnsToken = typeof b.apnsToken === "string" ? b.apnsToken.trim() : "";
  if (!/^[A-Za-z0-9._-]{16,255}$/.test(apnsToken)) return null;

  const tz = typeof b.tz === "string" ? b.tz.trim() : "";
  if (!TZ_RE.test(tz)) return null;

  // The schema defaults notify_hour to 8; an absent field means the same.
  const raw = b.notifyHour ?? 8;
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw < 0 ||
    raw > 23
  ) {
    return null;
  }

  const build = typeof b.build === "string" ? b.build.trim() : "";
  if (build.length > 40) return null;

  return { apnsToken, tz, notifyHour: raw, build: build || null };
}

export type PlacementRow = {
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  mercurySign: string | null;
  venusSign: string | null;
  marsSign: string | null;
  jupiterSign: string | null;
  saturnSign: string | null;
};

export function placementsFrom(
  row: PlacementRow | null | undefined,
): PlacementRow | null {
  if (!row) return null;
  const values = [
    row.sunSign,
    row.moonSign,
    row.rising,
    row.mercurySign,
    row.venusSign,
    row.marsSign,
    row.jupiterSign,
    row.saturnSign,
  ];
  if (values.every((v) => !v)) return null;
  return {
    sunSign: row.sunSign,
    moonSign: row.moonSign,
    rising: row.rising,
    mercurySign: row.mercurySign,
    venusSign: row.venusSign,
    marsSign: row.marsSign,
    jupiterSign: row.jupiterSign,
    saturnSign: row.saturnSign,
  };
}

export type MeUser = {
  id: string;
  name: string;
  email: string | null;
  dob: string;
  birthTime: string | null;
  birthCity: string;
  tz: string;
  onboardedAt: Date | string | null;
};

export function buildMePayload(
  user: MeUser,
  placements: PlacementRow | null,
  subscribed: boolean,
) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      dob: user.dob,
      birthTime: user.birthTime,
      birthCity: user.birthCity,
      tz: user.tz,
      onboardedAt: user.onboardedAt
        ? new Date(user.onboardedAt).toISOString()
        : null,
    },
    placements,
    subscription: { subscribed },
  };
}
