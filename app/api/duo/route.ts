import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { duos, roastSubjects, roasts, users } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { normalizeBirthLocation } from "@/lib/location";
import {
  serveCreateDuo,
  serveDuoList,
  type DuoCreatePorts,
  type DuoListPorts,
  type DuoRow,
} from "@/lib/duo-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const subjects = alias(users, "duo_subject");

function duoPorts(req: NextRequest): DuoCreatePorts & DuoListPorts {
  return {
    userId: () => sessionUserId(req),
    subscribed: isSubscribed,

    owner: async (userId) => {
      const row = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          name: true,
          gender: true,
          dob: true,
          birthTime: true,
          birthCity: true,
        },
      });
      if (!row) return null;
      return {
        name: row.name,
        gender: row.gender ?? "unspecified",
        date: row.dob,
        time: row.birthTime,
        birthPlace: row.birthCity,
      };
    },

    create: async ({ ownerId, relationship, people }) => {
      const partner = people[1];
      const [subject] = await db
        .insert(users)
        .values({
          name: partner.name,
          gender: partner.gender,
          dob: partner.date,
          birthTime: partner.time,
          birthCity: normalizeBirthLocation(partner.birthPlace),
          lat: 0,
          lon: 0,
          tz: "UTC",
          referralCode: crypto.randomUUID().slice(0, 8),
        })
        .returning({ id: users.id, name: users.name });

      const [roast] = await db
        .insert(roasts)
        .values({
          userId: ownerId,
          kind: "couple",
          relationship,
          status: "generating",
        })
        .returning({ id: roasts.id, status: roasts.status });

      await db.insert(roastSubjects).values([
        { roastId: roast.id, userId: ownerId, position: 0 },
        { roastId: roast.id, userId: subject.id, position: 1 },
      ]);

      const [duo] = await db
        .insert(duos)
        .values({
          ownerId,
          subjectId: subject.id,
          relationship,
          roastId: roast.id,
        })
        .returning({
          id: duos.id,
          relationship: duos.relationship,
          createdAt: duos.createdAt,
        });

      const row: DuoRow = {
        id: duo.id,
        relationship: duo.relationship,
        createdAt: duo.createdAt.toISOString(),
        subjectName: subject.name,
        status: roast.status,
        title: null,
        goldLine: null,
      };
      return { duo: row, roastId: roast.id };
    },

    dispatch: async ({ roastId, ownerId, relationship, people }) => {
      await inngest.send({
        name: "roast/generate",
        data: {
          roastId,
          userId: ownerId,
          kind: "couple",
          relationship,
          people,
          email: null,
        },
      });
    },

    list: async (ownerId) => {
      const rows = await db
        .select({
          id: duos.id,
          relationship: duos.relationship,
          createdAt: duos.createdAt,
          subjectName: subjects.name,
          status: roasts.status,
          title: roasts.title,
          goldLine: roasts.goldLine,
        })
        .from(duos)
        .innerJoin(subjects, eq(subjects.id, duos.subjectId))
        .leftJoin(roasts, eq(roasts.id, duos.roastId))
        .where(eq(duos.ownerId, ownerId))
        .orderBy(desc(duos.createdAt));

      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        status: row.status ?? "generating",
      }));
    },
  };
}

/** Create a duo — partner birth details in, group-roast job out. */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const { status, body } = await serveCreateDuo(duoPorts(req), raw);
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "POST /api/duo");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/** The caller's duos, newest first. */
export async function GET(req: NextRequest) {
  try {
    const { status, body } = await serveDuoList(duoPorts(req));
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "GET /api/duo");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
