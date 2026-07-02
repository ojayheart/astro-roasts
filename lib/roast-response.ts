import type { RoastData } from "./types";

type RoastUser = {
  name: string;
};

type RoastRecord = {
  id: string;
  status: string;
  paid: boolean;
  user: RoastUser | RoastUser[];
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  mercurySign: string | null;
  venusSign: string | null;
  marsSign: string | null;
  jupiterSign: string | null;
  saturnSign: string | null;
  teaser: string | null;
  fullText: string | null;
  callouts: string | null;
  createdAt?: Date;
  stagePct?: number | null;
  kind?: string;
  extraPlacements?: unknown;
  subjects?: { position: number; user: { name: string } }[];
};

function splitCallouts(callouts: string | null): string[] {
  return callouts
    ? callouts
        .split("|")
        .map((callout) => callout.trim())
        .filter(Boolean)
    : [];
}

function buildUnpaidTeaser(roast: RoastRecord): string {
  const teaserParagraphs = 5;
  const sourceText = roast.fullText || roast.teaser || "";
  const paragraphs = sourceText.split("\n\n").filter((p) => p.trim());

  if (paragraphs.length >= teaserParagraphs) {
    return `${paragraphs.slice(0, teaserParagraphs).join("\n\n")} -`;
  }

  return sourceText;
}

export function getRoastUser(roast: Pick<RoastRecord, "user">): RoastUser {
  return Array.isArray(roast.user) ? roast.user[0] : roast.user;
}

export function buildRoastPayload(roast: RoastRecord): RoastData {
  const user = getRoastUser(roast);
  const payload = {
    id: roast.id,
    status: roast.status as "generating" | "ready" | "error",
    paid: roast.paid,
    name: user.name,
    sunSign: roast.sunSign || "",
    moonSign: roast.moonSign || "",
    rising: roast.rising || "",
    teaser: roast.paid ? roast.teaser || "" : buildUnpaidTeaser(roast),
    createdAt: roast.createdAt?.toISOString(),
    stagePct: roast.stagePct ?? 0,
    kind: (roast.kind as RoastData["kind"]) ?? "solo",
    subjectNames: roast.subjects?.length
      ? [...roast.subjects]
          .sort((a, b) => a.position - b.position)
          .map((s) => s.user.name)
      : [user.name],
    extraPlacements:
      (roast.extraPlacements as RoastData["extraPlacements"]) ?? undefined,
    amountMinorUnits:
      roast.kind === "couple" || roast.kind === "family"
        ? 800 + 400 * Math.max((roast.subjects?.length ?? 2) - 2, 0)
        : 500,
  };

  if (!roast.paid) {
    return payload;
  }

  return {
    ...payload,
    mercurySign: roast.mercurySign || "",
    venusSign: roast.venusSign || "",
    marsSign: roast.marsSign || "",
    jupiterSign: roast.jupiterSign || "",
    saturnSign: roast.saturnSign || "",
    fullText: roast.fullText || "",
    callouts: splitCallouts(roast.callouts),
  };
}
