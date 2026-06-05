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
