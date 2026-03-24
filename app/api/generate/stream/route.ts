import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getCityData } from "@/lib/cities";
import { db } from "@/lib/db";
import { users, roasts } from "@/lib/db/schema";
import { sendRoastEmail } from "@/lib/email";
import {
  ROAST_SYSTEM_PROMPT,
  ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
  buildRoastUserPrompt,
} from "@/lib/roast-prompt";

export const maxDuration = 120; // 2 min for Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const { name, email, date, time, city } = await req.json();

    if (!name || !date || !city) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const cityData = getCityData(city);
    if (!cityData) {
      return new Response(JSON.stringify({ error: "City not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hasBirthTime = !!time;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = hasBirthTime ? time.split(":").map(Number) : [12, 0];

    // Calculate chart via Python API
    const origin = new URL(req.url).origin;
    const chartRes = await fetch(`${origin}/api/chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        year,
        month,
        day,
        hour,
        minute,
        lat: cityData.lat,
        lon: cityData.lon,
        tz: cityData.tz,
      }),
    });

    if (!chartRes.ok) {
      const err = await chartRes.text();
      return new Response(
        JSON.stringify({ error: `Chart calculation failed: ${err}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const chartData = await chartRes.json();

    // Prepare Claude stream
    const anthropic = new Anthropic();
    const systemPrompt = hasBirthTime
      ? ROAST_SYSTEM_PROMPT
      : ROAST_SYSTEM_PROMPT_NO_BIRTHTIME;
    const userPrompt = buildRoastUserPrompt(
      name,
      chartData.formatted_output,
      hasBirthTime,
    );

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Stream to client while accumulating server-side
    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        // First chunk: chart metadata for UI
        const meta = JSON.stringify({
          type: "meta",
          sunSign: chartData.sun_sign,
          moonSign: chartData.moon_sign,
          rising: chartData.rising_sign,
        });
        controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

        // Stream roast text chunks
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            const chunk = JSON.stringify({
              type: "text",
              text: event.delta.text,
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        }

        // Stream complete — save to Postgres
        try {
          // Parse roast text and callouts
          const mainText = fullText.split("---CALLOUTS---")[0].trim();
          const calloutsRaw = fullText.split("---CALLOUTS---")[1]?.trim() || "";
          const paragraphs = mainText.split("\n\n");
          const teaser =
            paragraphs.length > 3
              ? paragraphs.slice(0, 3).join("\n\n")
              : paragraphs[0] || "";

          // Create user
          const referralCode = crypto.randomUUID().slice(0, 8);
          const userRows = (await db
            .insert(users)
            .values({
              name,
              email: email || null,
              dob: date,
              birthTime: time || null,
              birthCity: city,
              lat: cityData.lat,
              lon: cityData.lon,
              tz: cityData.tz,
              referralCode,
            })
            .returning()) as (typeof users.$inferSelect)[];
          const user = userRows[0];

          // Create roast
          const roastRows = (await db
            .insert(roasts)
            .values({
              userId: user.id,
              teaser,
              fullText: mainText,
              callouts: calloutsRaw,
              sunSign: chartData.sun_sign,
              moonSign: chartData.moon_sign,
              rising: chartData.rising_sign,
              mercurySign: chartData.mercury_sign,
              venusSign: chartData.venus_sign,
              marsSign: chartData.mars_sign,
              jupiterSign: chartData.jupiter_sign,
              saturnSign: chartData.saturn_sign,
              chartData: chartData.formatted_output,
              paid: false,
              emailSent: false,
            })
            .returning()) as (typeof roasts.$inferSelect)[];
          const roast = roastRows[0];

          // Send email (non-blocking, non-fatal)
          if (email) {
            try {
              await sendRoastEmail(email, name, mainText, roast.id);
              await db
                .update(roasts)
                .set({ emailSent: true })
                .where(eq(roasts.id, roast.id));
            } catch (emailErr) {
              console.error("Email send failed:", emailErr);
            }
          }

          // Send roastId to client
          const done = JSON.stringify({ type: "done", roastId: roast.id });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
        } catch (saveErr) {
          console.error("Save error:", saveErr);
          const errMsg = JSON.stringify({
            type: "error",
            error: "Failed to save roast. Please try again.",
          });
          controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
        }

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
