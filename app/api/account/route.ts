import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  dailyRoasts,
  devices,
  duos,
  forecasts,
  magicLinks,
  roastSubjects,
  roasts,
  sessions,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { sessionUserId } from "@/lib/session";
import {
  serveDeleteAccount,
  type AccountPorts,
  type PurgeStep,
} from "@/lib/account-api";

export const runtime = "nodejs";
export const maxDuration = 60;

function ownedRoastIds(ids: string[]) {
  return db
    .select({ id: roasts.id })
    .from(roasts)
    .where(inArray(roasts.userId, ids));
}

async function purge(step: PurgeStep, ids: string[]): Promise<number> {
  switch (step) {
    case "referrals":
      return (
        await db
          .update(users)
          .set({ referredBy: null })
          .where(inArray(users.referredBy, ids))
          .returning({ id: users.id })
      ).length;
    case "duos":
      return (
        await db
          .delete(duos)
          .where(or(inArray(duos.ownerId, ids), inArray(duos.subjectId, ids)))
          .returning({ id: duos.id })
      ).length;
    case "roast_subjects":
      return (
        await db
          .delete(roastSubjects)
          .where(
            or(
              inArray(roastSubjects.userId, ids),
              inArray(roastSubjects.roastId, ownedRoastIds(ids)),
            ),
          )
          .returning({ id: roastSubjects.id })
      ).length;
    case "connections":
      return (
        await db
          .delete(connections)
          .where(
            or(
              inArray(connections.buyerId, ids),
              inArray(connections.friendId, ids),
              inArray(connections.roastId, ownedRoastIds(ids)),
            ),
          )
          .returning({ id: connections.id })
      ).length;
    case "daily_roasts":
      return (
        await db
          .delete(dailyRoasts)
          .where(inArray(dailyRoasts.userId, ids))
          .returning({ id: dailyRoasts.id })
      ).length;
    case "forecasts":
      return (
        await db
          .delete(forecasts)
          .where(inArray(forecasts.userId, ids))
          .returning({ id: forecasts.id })
      ).length;
    case "devices":
      return (
        await db
          .delete(devices)
          .where(inArray(devices.userId, ids))
          .returning({ id: devices.id })
      ).length;
    case "subscriptions":
      return (
        await db
          .delete(subscriptions)
          .where(inArray(subscriptions.userId, ids))
          .returning({ id: subscriptions.id })
      ).length;
    case "sessions":
      return (
        await db
          .delete(sessions)
          .where(inArray(sessions.userId, ids))
          .returning({ id: sessions.id })
      ).length;
    case "magic_links": {
      const emails = (
        await db
          .select({ email: users.email })
          .from(users)
          .where(inArray(users.id, ids))
      )
        .map((row) => row.email)
        .filter((email): email is string => !!email);
      if (!emails.length) return 0;
      return (
        await db
          .delete(magicLinks)
          .where(inArray(magicLinks.email, emails))
          .returning({ id: magicLinks.id })
      ).length;
    }
    case "roasts":
      return (
        await db
          .delete(roasts)
          .where(inArray(roasts.userId, ids))
          .returning({ id: roasts.id })
      ).length;
    case "users":
      return (
        await db
          .delete(users)
          .where(inArray(users.id, ids))
          .returning({ id: users.id })
      ).length;
  }
}

/** Full account and data deletion — App Review requires it in-app. */
export async function DELETE(req: NextRequest) {
  const ports: AccountPorts = {
    userId: () => sessionUserId(req),

    subjectIds: async (ownerId) => {
      const rows = await db
        .select({ id: users.id })
        .from(duos)
        .innerJoin(users, eq(users.id, duos.subjectId))
        .where(and(eq(duos.ownerId, ownerId), isNull(users.email)));
      return rows.map((row) => row.id);
    },

    purge,
  };

  try {
    const { status, body } = await serveDeleteAccount(ports);
    return NextResponse.json(body, { status });
  } catch (err) {
    Sentry.withScope((scope) => {
      scope.setTag("route", "/api/account");
      Sentry.captureException(err);
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
