import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { duos, roasts, users } from "@/lib/db/schema";
import { isSubscribed } from "@/lib/entitlement";
import { sessionUserId } from "@/lib/session";
import { serveDuo, type DuoReadPorts } from "@/lib/duo-api";

export const runtime = "nodejs";

const subjects = alias(users, "duo_subject");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One duo, scoped to its owner. Still generating reads as null content. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ports: DuoReadPorts = {
    userId: () => sessionUserId(req),
    subscribed: isSubscribed,

    find: async (ownerId, duoId) => {
      if (!UUID_RE.test(duoId)) return null;
      const [row] = await db
        .select({
          id: duos.id,
          relationship: duos.relationship,
          createdAt: duos.createdAt,
          subjectName: subjects.name,
          status: roasts.status,
          title: roasts.title,
          goldLine: roasts.goldLine,
          body: roasts.fullText,
        })
        .from(duos)
        .innerJoin(subjects, eq(subjects.id, duos.subjectId))
        .leftJoin(roasts, eq(roasts.id, duos.roastId))
        .where(and(eq(duos.id, duoId), eq(duos.ownerId, ownerId)))
        .limit(1);

      if (!row) return null;
      const ready = row.status === "ready";
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        status: row.status ?? "generating",
        title: ready ? row.title : null,
        goldLine: ready ? row.goldLine : null,
        body: ready ? row.body : null,
      };
    },
  };

  try {
    const { status, body } = await serveDuo(ports, id);
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/duo/[id]");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
