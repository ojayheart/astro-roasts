/**
 * 3-step Inngest roast generation pipeline.
 *
 * Step 1: Generate chart + roast via headless Claude Code on Hermes.
 * Step 2: Parse, save, email.
 */

import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { inngest } from "./client";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";
import {
  buildRoastRunnerPayload,
  buildGroupRunnerPayload,
  extractChartPlacements,
  extractGroupCharts,
  extractMarkedSection,
  extractRoastBlock,
} from "@/lib/roast-runner";
import { sendInstagramDm, buildDmTeaser } from "@/lib/manychat";
import { sendInstagramDm as sendInstagramGraphDm } from "@/lib/instagram";
import { pickGoldLine } from "@/lib/gold-line";

const ROAST_RUNNER_URL = process.env.ROAST_RUNNER_URL;
const ROAST_RUNNER_SECRET = process.env.ROAST_RUNNER_SECRET;

if (!ROAST_RUNNER_URL || !ROAST_RUNNER_SECRET) {
  console.warn(
    "ROAST_RUNNER_URL or ROAST_RUNNER_SECRET missing — roast generation will fail.",
  );
}

/**
 * Parse the structured roast output (---ROAST_START--- markers).
 * Falls back to plain prose if markers missing.
 */
function parseRoastOutput(raw: string): {
  title: string;
  teaser: string;
  fullText: string;
  callouts: string;
} {
  const hasStructured =
    raw.includes("---ROAST_START---") && raw.includes("---ROAST_END---");

  if (hasStructured) {
    const content = raw
      .split("---ROAST_START---")[1]
      .split("---ROAST_END---")[0]
      .trim();

    const titleMatch = content.match(/TITLE:\s*(.*?)(?:\n|$)/);
    const teaserMatch = content.match(/TEASER:\s*([\s\S]*?)(?=\nFULL:)/);
    const fullMatch = content.match(/FULL:\s*([\s\S]*?)(?=\nCALLOUTS:)/);
    const calloutsMatch = content.match(/CALLOUTS:\s*([\s\S]*?)$/);

    return {
      title: titleMatch?.[1]?.trim() || "",
      teaser: teaserMatch?.[1]?.trim() || "",
      fullText: fullMatch?.[1]?.trim() || "",
      callouts: calloutsMatch?.[1]?.trim() || "",
    };
  }

  const mainText = raw.split("---CALLOUTS---")[0].trim();
  const calloutsRaw = raw.split("---CALLOUTS---")[1]?.trim() || "";
  const paragraphs = mainText.split("\n\n");

  return {
    title: "",
    teaser:
      paragraphs.length > 3
        ? paragraphs.slice(0, 3).join("\n\n")
        : paragraphs[0] || "",
    fullText: mainText,
    callouts: calloutsRaw,
  };
}

class RateLimitError extends Error {
  constructor(public detail: string) {
    super("rate_limited");
  }
}

export const generateRoast = inngest.createFunction(
  {
    id: "generate-roast",
    retries: 2,
    triggers: [{ event: "roast/generate" }],
    onFailure: async ({ event, error }) => {
      const roastId = (
        event.data as { event?: { data?: { roastId?: string } } }
      )?.event?.data?.roastId;
      if (!roastId) return;

      const status =
        error?.name === "RateLimitError" ? "rate_limited" : "error";
      await db.update(roasts).set({ status }).where(eq(roasts.id, roastId));

      Sentry.withScope((scope) => {
        scope.setTag("subsystem", "inngest");
        scope.setTag("inngest.event", "roast/generate");
        scope.setContext("roast", { roastId, status });
        Sentry.captureException(error);
      });
    },
  },
  async ({ event, step }) => {
    const {
      roastId,
      name,
      gender,
      email,
      date,
      time,
      city,
      mcSubscriberId,
      igSenderId,
      kind,
      relationship,
      people,
    } = event.data;

    const hasBirthTime = !!time;
    const isGroup = kind === "couple" || kind === "family";

    // ─── Step 1: Generate Chart + Roast via Hermes Runner ──────────────
    const runnerOutput = await step.run("generate-roast", async () => {
      if (!ROAST_RUNNER_URL || !ROAST_RUNNER_SECRET) {
        throw new Error("Roast runner not configured");
      }

      const res = await fetch(`${ROAST_RUNNER_URL}/roast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ROAST_RUNNER_SECRET}`,
        },
        body: JSON.stringify(
          isGroup
            ? buildGroupRunnerPayload({ roastId, relationship, people })
            : buildRoastRunnerPayload({
                roastId,
                name,
                gender,
                date,
                time,
                birthPlace: city,
              }),
        ),
      });

      const body = (await res.json().catch(() => ({}))) as {
        output?: string;
        roast?: string;
        chartData?: string;
        charts?: string[];
        error?: string;
        detail?: string;
      };

      if (res.status === 503 && body.error === "rate_limited") {
        const err = new RateLimitError(body.detail || "");
        err.name = "RateLimitError";
        throw err;
      }

      const output = body.output || body.roast || "";

      if (!res.ok || !output) {
        Sentry.withScope((scope) => {
          scope.setTag("subsystem", "hermes-runner");
          scope.setContext("hermes_runner", {
            roastId,
            status: res.status,
            error: body.error,
            detail: body.detail?.slice(0, 500),
          });
          Sentry.captureMessage(`Roast runner non-ok (${res.status})`, "error");
        });
        throw new Error(
          `Roast runner failed (${res.status}): ${body.error || "unknown"} ${body.detail || ""}`,
        );
      }

      const chartData = body.chartData || extractMarkedSection(output, "CHART");
      const roastOutput = extractRoastBlock(output);
      if (!chartData) {
        Sentry.withScope((scope) => {
          scope.setTag("subsystem", "hermes-runner");
          scope.setContext("hermes_runner", {
            roastId,
            outputPreview: output.slice(0, 500),
          });
          Sentry.captureMessage("Roast runner returned no chart data", "error");
        });
        throw new Error("Roast runner did not return chart data");
      }

      const charts: string[] =
        isGroup && Array.isArray(body.charts) && body.charts.length
          ? body.charts
          : isGroup
            ? extractGroupCharts(output, people.length)
            : [];

      const placements = extractChartPlacements(
        isGroup ? charts[0] || "" : chartData,
      );
      const extraPlacements = isGroup
        ? charts.slice(1).map((c, i) => {
            const p = extractChartPlacements(c);
            return {
              name: people[i + 1].name,
              sunSign: p.sunSign,
              moonSign: p.moonSign,
              rising: p.rising,
            };
          })
        : undefined;

      await db
        .update(roasts)
        .set({
          chartData,
          draft: roastOutput,
          ...placements,
          ...(extraPlacements ? { extraPlacements } : {}),
        })
        .where(eq(roasts.id, roastId));

      return {
        chartData,
        roastOutput,
      };
    });

    // ─── Step 2: Parse + Save + Email ──────────────────────────────────
    const saved = await step.run("save-and-email", async () => {
      const { title, teaser, fullText, callouts } = parseRoastOutput(
        runnerOutput.roastOutput,
      );

      const finalTeaser =
        teaser ||
        (() => {
          const paragraphs = fullText.split("\n\n");
          return paragraphs.length > 3
            ? paragraphs.slice(0, 3).join("\n\n")
            : paragraphs[0] || "";
        })();

      const goldLine = fullText ? await pickGoldLine(fullText) : null;

      await db
        .update(roasts)
        .set({
          title,
          teaser: finalTeaser,
          fullText,
          callouts,
          goldLine,
          status: "ready",
        })
        .where(eq(roasts.id, roastId));

      // Gated on paid=true via shared helper. If payment landed first, the
      // webhook already sent and emailSent is true (no-op). If payment lands
      // later, the webhook will send.
      try {
        await sendRoastEmailIfReady(roastId);
      } catch (emailErr) {
        console.error("Email send failed (pipeline):", emailErr);
        Sentry.withScope((scope) => {
          scope.setTag("subsystem", "email");
          scope.setTag("source", "pipeline");
          scope.setContext("email", { roastId });
          Sentry.captureException(emailErr);
        });
      }

      return { title, teaser: finalTeaser };
    });

    // ─── Step 3: DM teaser back (Instagram DM funnel only) ─────────────
    if (igSenderId) {
      await step.run("send-instagram-graph-dm", async () => {
        const roastUrl = `https://astroroast.com/roast/${roastId}`;
        try {
          await sendInstagramGraphDm({
            recipientId: igSenderId,
            texts: buildDmTeaser({
              title: saved.title || null,
              teaser: saved.teaser,
              roastUrl,
            }),
          });
        } catch (dmErr) {
          console.error("Instagram Graph DM send failed:", dmErr);
          Sentry.withScope((scope) => {
            scope.setTag("subsystem", "instagram-graph");
            scope.setContext("instagram_graph", { roastId, igSenderId });
            Sentry.captureException(dmErr);
          });
          throw dmErr;
        }
      });
    } else if (mcSubscriberId) {
      await step.run("send-instagram-dm", async () => {
        const roastUrl = `https://astroroast.com/roast/${roastId}`;
        try {
          await sendInstagramDm(
            mcSubscriberId,
            buildDmTeaser({
              title: saved.title || null,
              teaser: saved.teaser,
              roastUrl,
            }),
          );
        } catch (dmErr) {
          console.error("ManyChat DM send failed:", dmErr);
          Sentry.withScope((scope) => {
            scope.setTag("subsystem", "manychat");
            scope.setContext("manychat", { roastId, mcSubscriberId });
            Sentry.captureException(dmErr);
          });
          throw dmErr; // let Inngest retry the DM step
        }
      });
    }

    return { roastId, status: "ready", hasBirthTime };
  },
);
