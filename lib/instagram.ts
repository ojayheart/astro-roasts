const DEFAULT_GRAPH_VERSION = "v23.0";

export async function sendInstagramDm(input: {
  recipientId: string;
  texts: string[];
}): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const graphVersion =
    process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;

  if (!accessToken) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  }
  if (!igUserId) {
    throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID not set");
  }

  for (const text of input.texts) {
    const res = await fetch(
      `https://graph.instagram.com/${graphVersion}/${igUserId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: input.recipientId },
          message: { text },
          messaging_type: "RESPONSE",
        }),
      },
    );

    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; type?: string };
    };

    if (!res.ok) {
      const message = body.error?.message || JSON.stringify(body).slice(0, 300);
      throw new Error(`Instagram send failed (${res.status}): ${message}`);
    }
  }
}
