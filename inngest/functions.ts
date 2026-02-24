import { inngest } from "./client";
import { roastAgent } from "./roast-agent";
import { setRoast, getRoast } from "@/lib/kv";
import { buildRoastUserPrompt } from "@/lib/roast-prompt";
import type { RoastSection } from "@/lib/types";

function parseRoastOutput(text: string): {
  teaser: string;
  sections: RoastSection[];
} {
  // Extract teaser
  const teaserMatch = text.match(
    /---TEASER_START---([\s\S]*?)---TEASER_END---/,
  );
  const teaser = teaserMatch ? teaserMatch[1].trim() : "";

  // Extract sections
  const sectionRegex = /---SECTION_START---([\s\S]*?)---SECTION_END---/g;
  const sections: RoastSection[] = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/TITLE:\s*(.+)/);
    const contentMatch = block.match(/CONTENT:\s*([\s\S]*?)(?=CALLOUT:|$)/);
    const calloutMatch = block.match(/CALLOUT:\s*(.+)/);

    if (titleMatch && contentMatch) {
      sections.push({
        title: titleMatch[1].trim(),
        content: contentMatch[1].trim(),
        callout: calloutMatch ? calloutMatch[1].trim() : undefined,
      });
    }
  }

  return { teaser, sections };
}

export const generateRoast = inngest.createFunction(
  { id: "generate-roast", retries: 2 },
  { event: "roast/generate" },
  async ({ event, step }) => {
    const { roastId, name, year, month, day, hour, minute, lat, lon, tz } =
      event.data;

    // Step 1: Calculate natal chart via Python API
    const chartData = await step.run("calculate-chart", async () => {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

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
        throw new Error(`Chart API error: ${res.status}`);
      }

      return res.json();
    });

    // Step 2: Generate roast via AgentKit agent
    const roastResult = await step.run("generate-roast-text", async () => {
      const prompt = buildRoastUserPrompt(name, chartData.formatted_output);
      const result = await roastAgent.run(prompt);
      // Extract text from agent output
      const text = result.output
        .map((msg) => {
          if (msg.type !== "text") return "";
          const content = (
            msg as { content: string | Array<{ type: string; text?: string }> }
          ).content;
          if (typeof content === "string") return content;
          if (Array.isArray(content)) {
            return content
              .filter((b) => b.type === "text")
              .map((b) => b.text || "")
              .join("");
          }
          return "";
        })
        .join("\n");
      return text;
    });

    // Step 3: Parse + store in KV
    await step.run("store-roast", async () => {
      const parsed = parseRoastOutput(roastResult);
      await setRoast(roastId, {
        status: "ready",
        name,
        sunSign: chartData.sun_sign,
        moonSign: chartData.moon_sign,
        rising: chartData.rising_sign,
        mercury: chartData.mercury_sign,
        venus: chartData.venus_sign,
        mars: chartData.mars_sign,
        jupiter: chartData.jupiter_sign,
        saturn: chartData.saturn_sign,
        teaser: parsed.teaser,
        sections: parsed.sections,
        paid: false,
        createdAt: Date.now(),
      });
    });
  },
);

export const processPayment = inngest.createFunction(
  { id: "process-payment" },
  { event: "payment/completed" },
  async ({ event, step }) => {
    const { roastId } = event.data;
    await step.run("mark-paid", async () => {
      const roast = await getRoast(roastId);
      if (roast) {
        await setRoast(roastId, { ...roast, paid: true });
      }
    });
  },
);
