import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { roasts, users, roastSubjects } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";
import { normalizeBirthLocation } from "@/lib/location";
import {
  extractInstagramTextMessages,
  parseInstagramRoastRequest,
  verifyInstagramWebhookChallenge,
  parseInstagramGroupRequest,
  SOLO_TEMPLATE_MESSAGES,
  verifyInstagramWebhookSignature,
  type ParsedInstagramRoastRequest,
} from "@/lib/instagram-webhook";
import { sendInstagramDm } from "@/lib/instagram";
import { fetchConversationHistory, runDmAgent } from "@/lib/dm-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;

export async function GET(req: NextRequest) {
  const verified = verifyInstagramWebhookChallenge(
    req.nextUrl.searchParams,
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  );

  if (!verified.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new NextResponse(verified.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const rawBody = await req.text();
    if (
      !verifyInstagramWebhookSignature(
        rawBody,
        req.headers.get("x-hub-signature-256"),
        process.env.INSTAGRAM_APP_SECRET,
      )
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const payload = JSON.parse(rawBody) as unknown;
    const messages = extractInstagramTextMessages(payload);

    for (const message of messages) {
      // Deterministic fast paths: a complete structured submission skips the
      // agent entirely (exact + free).
      const group = parseInstagramGroupRequest(message.text);
      if (group) {
        await handleGroupDmRequest(group, message.senderId);
        continue;
      }
      const request = parseInstagramRoastRequest(message.text);
      if (request && !/person\s*\d+\s*:/i.test(message.text)) {
        await handleSoloDmRequest(request, message.senderId);
        continue;
      }

      // Everything else — keywords, banter, half-details, malformed blocks —
      // gets a real agent turn in the astroroasted voice.
      await handleAgentTurn(message.senderId, message.text);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Instagram webhook error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/instagram");
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * One agent turn: thread history → Hermes-run Claude → reply or generate.
 * Any failure falls back to the solo template — a delivered DM never dies
 * silently.
 */
async function handleAgentTurn(senderId: string, text: string) {
  try {
    const history = await fetchConversationHistory(senderId);
    const action = await runDmAgent({ history, latestText: text });

    if (action?.action === "reply") {
      await sendInstagramDm({
        recipientId: senderId,
        texts: action.messages,
      });
      return;
    }

    if (action?.action === "generate_solo") {
      const created = await handleSoloDmRequest(
        { ...action.person, gender: action.person.gender },
        senderId,
      );
      await sendInstagramDm({
        recipientId: senderId,
        texts: [
          created
            ? action.confirmMessage
            : "already cooking one for you. patience.",
        ],
      });
      return;
    }

    if (action?.action === "generate_group") {
      const created = await handleGroupDmRequest(
        { relationship: action.relationship, people: action.people },
        senderId,
      );
      await sendInstagramDm({
        recipientId: senderId,
        texts: [
          created
            ? action.confirmMessage
            : "already cooking one for you. patience.",
        ],
      });
      return;
    }

    // Agent unavailable (runner down / rate-limited / bad output) — template
    // fallback beats silence.
    await sendInstagramDm({
      recipientId: senderId,
      texts: SOLO_TEMPLATE_MESSAGES,
    });
  } catch (error) {
    console.error("Agent turn failed:", error);
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/webhooks/instagram");
      scope.setTag("subsystem", "dm-agent");
      Sentry.captureException(error);
    });
  }
}

/** Returns true when a new roast was created (false = one already generating). */
async function handleSoloDmRequest(
  request: ParsedInstagramRoastRequest,
  senderId: string,
): Promise<boolean> {
  const existing = await db.query.roasts.findFirst({
    where: (r, { and: dbAnd, eq: dbEq }) =>
      dbAnd(
        dbEq(r.source, "instagram_dm"),
        dbEq(r.mcSubscriberId, senderId),
        dbEq(r.status, "generating"),
      ),
  });
  if (existing) return false;

  const normalizedBirthPlace = normalizeBirthLocation(request.birthPlace);

  const userRows = (await db
    .insert(users)
    .values({
      name: request.name,
      gender: request.gender,
      email: null,
      dob: request.date,
      birthTime: request.time,
      birthCity: normalizedBirthPlace,
      lat: 0,
      lon: 0,
      tz: "UTC",
      referralCode: crypto.randomUUID().slice(0, 8),
    })
    .returning()) as (typeof users.$inferSelect)[];
  const user = userRows[0];

  const roastRows = (await db
    .insert(roasts)
    .values({
      userId: user.id,
      status: "generating",
      paid: false,
      emailSent: false,
      source: "instagram_dm",
      mcSubscriberId: senderId,
    })
    .returning()) as (typeof roasts.$inferSelect)[];
  const roast = roastRows[0];

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: roast.id,
      userId: user.id,
      name: request.name,
      gender: request.gender,
      email: null,
      date: request.date,
      time: request.time,
      city: normalizedBirthPlace,
      igSenderId: senderId,
    },
  });
  return true;
}

async function handleGroupDmRequest(
  group: {
    relationship: "couple" | "family";
    people: ParsedInstagramRoastRequest[];
  },
  senderId: string,
): Promise<boolean> {
  const existing = await db.query.roasts.findFirst({
    where: (r, { and: dbAnd, eq: dbEq }) =>
      dbAnd(
        dbEq(r.source, "instagram_dm"),
        dbEq(r.mcSubscriberId, senderId),
        dbEq(r.status, "generating"),
      ),
  });
  if (existing) return false;

  const kind = group.relationship;
  const people = group.people.map((p) => ({
    name: p.name,
    gender: p.gender,
    date: p.date,
    time: p.time,
    birthPlace: normalizeBirthLocation(p.birthPlace),
  }));

  const userRows = (await db
    .insert(users)
    .values(
      people.map((person) => ({
        name: person.name,
        gender: person.gender,
        email: null,
        dob: person.date,
        birthTime: person.time,
        birthCity: person.birthPlace,
        lat: 0,
        lon: 0,
        tz: "UTC",
        referralCode: crypto.randomUUID().slice(0, 8),
      })),
    )
    .returning()) as (typeof users.$inferSelect)[];
  const userIds = userRows.map((u) => u.id);

  const roastRows = (await db
    .insert(roasts)
    .values({
      userId: userIds[0],
      kind,
      status: "generating",
      paid: false,
      emailSent: false,
      source: "instagram_dm",
      mcSubscriberId: senderId,
    })
    .returning()) as (typeof roasts.$inferSelect)[];
  const roast = roastRows[0];

  await db.insert(roastSubjects).values(
    userIds.map((userId, position) => ({
      roastId: roast.id,
      userId,
      position,
    })),
  );

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: roast.id,
      userId: userIds[0],
      kind,
      relationship: kind,
      people,
      email: null,
      igSenderId: senderId,
    },
  });
  return true;
}
