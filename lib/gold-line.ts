import Anthropic from "@anthropic-ai/sdk";

export function sanitizeGoldLine(
  line: string,
  fullText: string,
): string | null {
  const trimmed = line.trim().replace(/^["'""]+|["'""]+$/g, "");
  if (!trimmed || trimmed.length > 200) return null;
  return fullText.includes(trimmed) ? trimmed : null;
}

// Cheap post-hoc pick. Never blocks the pipeline: any failure → null and the
// story card falls back to the teaser quote.
export async function pickGoldLine(fullText: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const MAX_CHARS = 24_000;
    const text =
      fullText.length <= MAX_CHARS
        ? fullText
        : `${fullText.slice(0, 12_000)}\n[…]\n${fullText.slice(-12_000)}`;
    const message = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Below is a comedic astrology roast. Return the single most savage, funniest line that stands alone out of context — copied VERBATIM, one line, nothing else. Max ~25 words.\n\n${text}`,
          },
        ],
      },
      { timeout: 15_000 },
    );
    const responseText =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return sanitizeGoldLine(responseText, fullText);
  } catch (err) {
    console.error("gold_line_failed", String(err).slice(0, 200));
    return null;
  }
}
