/**
 * ManyChat API client — sends the teaser DM back to an Instagram subscriber
 * after the pipeline finishes a DM-sourced roast.
 *
 * Docs: https://api.manychat.com/swagger — POST /fb/sending/sendContent.
 * The subscriber has just messaged us (keyword trigger), so we're inside
 * the 24h messaging window and no message_tag is required.
 */

const MANYCHAT_API_URL = "https://api.manychat.com/fb/sending/sendContent";

export async function sendInstagramDm(
  subscriberId: string,
  texts: string[],
): Promise<void> {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) {
    throw new Error("MANYCHAT_API_TOKEN not set");
  }

  const res = await fetch(MANYCHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscriber_id: subscriberId,
      data: {
        version: "v2",
        content: {
          type: "instagram",
          messages: texts.map((text) => ({ type: "text", text })),
        },
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
  };

  if (!res.ok || body.status !== "success") {
    throw new Error(
      `ManyChat sendContent failed (${res.status}): ${body.message || JSON.stringify(body).slice(0, 300)}`,
    );
  }
}

/**
 * DM-sized teaser: title + opening hook, clipped to fit comfortably in an
 * Instagram text message (1000 char hard limit; stay well under).
 */
export function buildDmTeaser(input: {
  title: string | null;
  teaser: string;
  roastUrl: string;
}): string[] {
  const firstParagraph = input.teaser.split("\n\n")[0]?.trim() || "";
  const clipped =
    firstParagraph.length > 850
      ? `${firstParagraph.slice(0, 850).replace(/\s+\S*$/, "")}…`
      : firstParagraph;

  const opener = input.title ? `${input.title}\n\n${clipped}` : clipped;

  return [
    opener.slice(0, 990),
    `That's just the warm-up. The full roast goes several layers deeper 🔥\n\nRead it here: ${input.roastUrl}`,
  ];
}
