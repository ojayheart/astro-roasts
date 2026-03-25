/**
 * 5-step Inngest roast generation pipeline.
 *
 * Step 1: Calculate natal chart via /api/chart
 * Step 2: Analyze chart — humor profile, voice preset, metaphor palette
 * Step 3: Write first draft using analysis brief
 * Step 4: Validate + rewrite (max 2 passes)
 * Step 5: Parse output, save final content, send email
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { sendRoastEmail } from "@/lib/email";
import {
  ANALYSIS_SYSTEM_PROMPT,
  VALIDATION_SYSTEM_PROMPT,
  buildDraftSystemPrompt,
  buildDraftSystemPromptNoBirthtime,
  buildAnalysisUserPrompt,
  buildDraftUserPrompt,
  buildValidationUserPrompt,
} from "./prompts";

const MODEL = "claude-sonnet-4-6";

/**
 * Parse JSON from a Claude response, handling potential markdown wrapping.
 */
function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse JSON from response");
  }
}

/**
 * Extract text content from an Anthropic message response.
 */
function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

/**
 * Parse the structured roast output format (---ROAST_START--- markers).
 * Falls back to legacy ---CALLOUTS--- format if structured markers are missing.
 */
function parseRoastOutput(raw: string): {
  title: string;
  teaser: string;
  fullText: string;
  callouts: string;
} {
  const hasStructuredFormat =
    raw.includes("---ROAST_START---") && raw.includes("---ROAST_END---");

  if (hasStructuredFormat) {
    const content = raw
      .split("---ROAST_START---")[1]
      .split("---ROAST_END---")[0]
      .trim();

    const titleMatch = content.match(/TITLE:\s*(.*?)(?:\n|$)/);
    const teaserMatch = content.match(/TEASER:\s*([\s\S]*?)(?=\nFULL:)/);
    const fullMatch = content.match(/FULL:\s*([\s\S]*?)(?=\nCALLOUTS:)/);
    const calloutsMatch = content.match(/CALLOUTS:\s*([\s\S]*?)$/);

    const title = titleMatch?.[1]?.trim() || "";
    const teaser = teaserMatch?.[1]?.trim() || "";
    const fullText = fullMatch?.[1]?.trim() || "";
    const callouts = calloutsMatch?.[1]?.trim() || "";

    return { title, teaser, fullText, callouts };
  }

  // Fallback: treat as plain prose with optional ---CALLOUTS--- marker
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

// ─── The Pipeline ────────────────────────────────────────────────────────────

export const generateRoast = inngest.createFunction(
  {
    id: "generate-roast",
    retries: 2,
    triggers: [{ event: "roast/generate" }],
    onFailure: async ({ event }) => {
      // On total failure, mark the roast as errored
      const roastId = (
        event.data as { event?: { data?: { roastId?: string } } }
      )?.event?.data?.roastId;
      if (roastId) {
        await db
          .update(roasts)
          .set({ status: "error" })
          .where(eq(roasts.id, roastId));
      }
    },
  },
  async ({ event, step }) => {
    const { roastId, userId, name, email, date, time, lat, lon, tz, city } =
      event.data;

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
        const err = await res.text();
        throw new Error(`Chart calculation failed: ${err}`);
      }

      const data = await res.json();

      // Save chart data + sign placements to the roast row
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

    // ─── Step 2: Analysis (Humor Profile + Voice + Metaphor Palette) ──
    const analysis = await step.run("analyze-chart", async () => {
      const anthropic = new Anthropic();

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildAnalysisUserPrompt(
              name,
              chartData.formatted_output,
              hasBirthTime,
            ),
          },
        ],
      });

      const text = extractText(response);
      const analysisJson = parseJsonResponse(text);

      // Persist analysis to the roast row
      await db
        .update(roasts)
        .set({ analysis: analysisJson })
        .where(eq(roasts.id, roastId));

      return analysisJson as {
        spine: string[];
        centralParadox: string;
        humorProfile: {
          voice: string;
          burnRatio: string;
          crueltyCeiling: number;
          warmthFloor: number;
          secondPersonDensity: string;
          specificity: number;
          escalationDepth: number;
          encryptionLevel: number;
          pratchettReversals: number;
          emphasisStyle: string;
          astroJargon: number;
          pronouns: string;
        };
        metaphorPalette: {
          centralTension: string;
          throughline: string;
          probableWorld: string;
          publicMask: string;
          privateMachinery: string;
        };
      };
    });

    // ─── Step 3: First Draft ──────────────────────────────────────────
    const draft = await step.run("write-draft", async () => {
      const anthropic = new Anthropic();
      const voicePreset = analysis.humorProfile?.voice || "cold-literary";

      const systemPrompt = hasBirthTime
        ? buildDraftSystemPrompt(voicePreset)
        : buildDraftSystemPromptNoBirthtime(voicePreset);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: buildDraftUserPrompt(
              name,
              chartData.formatted_output,
              JSON.stringify(analysis, null, 2),
              hasBirthTime,
            ),
          },
        ],
      });

      const text = extractText(response);

      // Save first draft
      await db
        .update(roasts)
        .set({ draft: text })
        .where(eq(roasts.id, roastId));

      return text;
    });

    // ─── Step 4: Validation + Rewrite (max 2 passes) ─────────────────
    const finalRoast = await step.run("validate-and-rewrite", async () => {
      const anthropic = new Anthropic();
      let currentDraft = draft;
      let validationNotes = "";

      for (let pass = 0; pass < 2; pass++) {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 6000,
          system: VALIDATION_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildValidationUserPrompt(
                name,
                chartData.formatted_output,
                JSON.stringify(analysis, null, 2),
                currentDraft,
              ),
            },
          ],
        });

        const text = extractText(response);

        let validationResult: {
          scores: { dimension: string; score: number; notes: string }[];
          lowestDimension: string;
          needsRewrite: boolean;
          rewriteNotes: string;
          finalRoast: string;
        };

        try {
          validationResult = parseJsonResponse(text) as typeof validationResult;
        } catch {
          // Can't parse validation — use current draft as-is
          validationNotes += `Pass ${pass + 1}: Failed to parse validation response. Using current draft.\n`;
          break;
        }

        const scores = validationResult.scores || [];
        const allAbove3 = scores.every((s: { score: number }) => s.score >= 3);

        validationNotes += `Pass ${pass + 1}: ${scores.map((s: { dimension: string; score: number }) => `${s.dimension}=${s.score}`).join(", ")}`;

        if (validationResult.needsRewrite && validationResult.finalRoast) {
          validationNotes += ` | Rewrote: ${validationResult.lowestDimension} (${validationResult.rewriteNotes})`;
          currentDraft = validationResult.finalRoast;
        }

        validationNotes += "\n";

        if (allAbove3 || !validationResult.needsRewrite) {
          // All dimensions pass or no rewrite needed — use finalRoast if available
          if (validationResult.finalRoast) {
            currentDraft = validationResult.finalRoast;
          }
          break;
        }
      }

      // Save validation notes
      await db
        .update(roasts)
        .set({ validationNotes })
        .where(eq(roasts.id, roastId));

      return currentDraft;
    });

    // ─── Step 5: Save Final Content + Send Email ─────────────────────
    await step.run("save-and-email", async () => {
      const { title, teaser, fullText, callouts } =
        parseRoastOutput(finalRoast);

      // If no separate teaser was extracted, derive from full text
      const finalTeaser =
        teaser ||
        (() => {
          const paragraphs = fullText.split("\n\n");
          return paragraphs.length > 3
            ? paragraphs.slice(0, 3).join("\n\n")
            : paragraphs[0] || "";
        })();

      // Update roast row with final parsed content
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

      // Send email if the user provided one
      if (email) {
        try {
          await sendRoastEmail(email, name, fullText, roastId);
          await db
            .update(roasts)
            .set({ emailSent: true })
            .where(eq(roasts.id, roastId));
        } catch (emailErr) {
          console.error("Email send failed:", emailErr);
          // Non-fatal — the roast is still saved and accessible
        }
      }
    });

    return { roastId, status: "ready" };
  },
);
