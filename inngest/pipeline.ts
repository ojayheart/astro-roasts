/**
 * 3-step Inngest roast generation pipeline.
 *
 * Step 1: Calculate natal chart via /api/chart
 * Step 2: Generate roast via headless `claude -p` on hermes runner
 * Step 3: Parse, save, email
 */

import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmail } from "@/lib/email";

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
    },
  },
  async ({ event, step }) => {
    const { roastId, name, email, date, time, lat, lon, tz } = event.data;

    const hasBirthTime = !!time;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = hasBirthTime
      ? time!.split(":").map(Number)
      : [12, 0];

    // ─── Step 1: Calculate Chart ───────────────────────────────────────
    const chartData = await step.run("calculate-chart", async () => {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const res = await fetch(`${baseUrl}/api/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          year,
          month,
          day,
          hour,
          minute,
          lat,
          lon,
          tz,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chart calculation failed: ${await res.text()}`);
      }

      const data = await res.json();

      await db
        .update(roasts)
        .set({
          chartData: data.formatted_output,
          sunSign: data.sun_sign,
          moonSign: data.moon_sign,
          rising: data.rising_sign,
          mercurySign: data.mercury_sign,
          venusSign: data.venus_sign,
          marsSign: data.mars_sign,
          jupiterSign: data.jupiter_sign,
          saturnSign: data.saturn_sign,
        })
        .where(eq(roasts.id, roastId));

      return data;
    });

    // ─── Step 2: Generate Roast via Hermes Runner ──────────────────────
    const rawRoast = await step.run("generate-roast", async () => {
      if (!ROAST_RUNNER_URL || !ROAST_RUNNER_SECRET) {
        throw new Error("Roast runner not configured");
      }

      const res = await fetch(`${ROAST_RUNNER_URL}/roast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ROAST_RUNNER_SECRET}`,
        },
        body: JSON.stringify({
          name,
          chartData: chartData.formatted_output,
          hasBirthTime,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        roast?: string;
        error?: string;
        detail?: string;
      };

      if (res.status === 503 && body.error === "rate_limited") {
        const err = new RateLimitError(body.detail || "");
        err.name = "RateLimitError";
        throw err;
      }

      if (!res.ok || !body.roast) {
        throw new Error(
          `Roast runner failed (${res.status}): ${body.error || "unknown"} ${body.detail || ""}`,
        );
      }

      await db
        .update(roasts)
        .set({ draft: body.roast })
        .where(eq(roasts.id, roastId));

      return body.roast;
    });

    // ─── Step 3: Parse + Save + Email ──────────────────────────────────
    await step.run("save-and-email", async () => {
      const { title, teaser, fullText, callouts } = parseRoastOutput(rawRoast);

      const finalTeaser =
        teaser ||
        (() => {
          const paragraphs = fullText.split("\n\n");
          return paragraphs.length > 3
            ? paragraphs.slice(0, 3).join("\n\n")
            : paragraphs[0] || "";
        })();

      await db
        .update(roasts)
        .set({
          title,
          teaser: finalTeaser,
          fullText,
          callouts,
          status: "ready",
        })
        .where(eq(roasts.id, roastId));

      if (email) {
        try {
          await sendRoastEmail(email, name, fullText, roastId);
          await db
            .update(roasts)
            .set({ emailSent: true })
            .where(eq(roasts.id, roastId));
        } catch (emailErr) {
          console.error("Email send failed:", emailErr);
        }
      }
    });

    return { roastId, status: "ready" };
  },
);
