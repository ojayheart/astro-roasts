/**
 * Create, list and read duos for /api/duo. A duo is the existing group-roast
 * path with a two-person cast — validation, relationship normalisation and the
 * runner payload all come from lib/group.ts and lib/roast-runner.ts. Kept free
 * of the db client so the tests can exercise every branch without Neon.
 */

import {
  normalizeRelationship,
  validateGroupRequest,
  type PersonInput,
} from "./group.ts";
import { normalizeBirthLocation } from "./location.ts";
import { pass, type Auth, type Reply } from "./subscription-api.ts";

export type DuoRow = {
  id: string;
  relationship: string;
  createdAt: string;
  subjectName: string;
  status: string;
  title: string | null;
  goldLine: string | null;
};

export type DuoDetail = DuoRow & { body: string | null };

export type DuoRequest = { relationship: string; people: PersonInput[] };

export type DuoCreatePorts = Auth & {
  owner: (userId: string) => Promise<PersonInput | null>;
  create: (input: {
    ownerId: string;
    relationship: string;
    people: PersonInput[];
  }) => Promise<{ duo: DuoRow; roastId: string }>;
  dispatch: (input: {
    roastId: string;
    ownerId: string;
    relationship: string;
    people: PersonInput[];
  }) => Promise<void>;
};

export type DuoListPorts = Auth & {
  list: (ownerId: string) => Promise<DuoRow[]>;
};

export type DuoReadPorts = Auth & {
  find: (ownerId: string, id: string) => Promise<DuoDetail | null>;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** `{ name, dob, birthPlace, relationship }` → the couple the group path takes. */
export function parseDuoRequest(
  raw: unknown,
  owner: PersonInput,
): DuoRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const partner = {
    name: str(r.name),
    gender: str(r.gender) || "unspecified",
    date: str(r.dob) || str(r.date),
    time: str(r.birthTime) || str(r.time) || null,
    birthPlace: str(r.birthPlace) || str(r.birthCity),
  };

  const validated = validateGroupRequest("couple", [owner, partner]);
  if (!validated.ok) return null;

  return {
    relationship: normalizeRelationship(r.relationship, "couple"),
    // Same normalisation point as app/api/generate/route.ts — the runner and
    // the city lookup both key on the collapsed string.
    people: validated.people.map((person) => ({
      ...person,
      birthPlace: normalizeBirthLocation(person.birthPlace),
    })),
  };
}

function duoBody(row: DuoRow | DuoDetail) {
  return {
    duo: {
      id: row.id,
      relationship: row.relationship,
      subjectName: row.subjectName,
      createdAt: row.createdAt,
      status: row.status,
      title: row.title,
      goldLine: row.goldLine,
      ...("body" in row ? { body: row.body } : {}),
    },
  };
}

export async function serveCreateDuo(
  ports: DuoCreatePorts,
  raw: unknown,
): Promise<Reply> {
  const gate = await pass(ports);
  if (!("userId" in gate)) return gate;

  const owner = await ports.owner(gate.userId);
  if (!owner) return { status: 404, body: { error: "not_found" } };

  const parsed = parseDuoRequest(raw, owner);
  if (!parsed) return { status: 400, body: { error: "invalid_person" } };

  const { duo, roastId } = await ports.create({
    ownerId: gate.userId,
    relationship: parsed.relationship,
    people: parsed.people,
  });
  await ports.dispatch({
    roastId,
    ownerId: gate.userId,
    relationship: parsed.relationship,
    people: parsed.people,
  });

  return { status: 201, body: duoBody(duo) };
}

export async function serveDuoList(ports: DuoListPorts): Promise<Reply> {
  const gate = await pass(ports);
  if (!("userId" in gate)) return gate;

  const rows = await ports.list(gate.userId);
  return { status: 200, body: { duos: rows } };
}

export async function serveDuo(
  ports: DuoReadPorts,
  id: string,
): Promise<Reply> {
  const gate = await pass(ports);
  if (!("userId" in gate)) return gate;

  const row = await ports.find(gate.userId, id);
  if (!row) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: duoBody(row) };
}
