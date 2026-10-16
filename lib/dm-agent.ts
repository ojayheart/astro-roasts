/**
 * DM agent — an actual in-voice conversational turn for Instagram DMs.
 *
 * Any message that isn't a complete structured submission goes through here:
 * Claude gets the recent conversation and either banters (in the astroroasted
 * voice) while collecting birth details, or — once it has enough — returns a
 * generate action that the webhook turns into a real roast run.
 */

import { validateGroupRequest, type PersonInput } from "./group";

const DEFAULT_GRAPH_VERSION = "v23.0";

export type DmTurn = { role: "user" | "assistant"; text: string };

export type AgentAction =
  | { action: "reply"; messages: string[] }
  | { action: "generate_solo"; person: PersonInput; confirmMessage: string }
  | {
      action: "generate_group";
      relationship: string;
      people: PersonInput[];
      confirmMessage: string;
    };

/**
 * Pull the recent thread with one user so the agent has context.
 * Best-effort: any failure returns [] and the agent works from the
 * latest message alone.
 */
export async function fetchConversationHistory(
  senderIgsid: string,
): Promise<DmTurn[]> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const graphVersion =
    process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
  if (!accessToken || !igUserId) return [];

  try {
    const url =
      `https://graph.instagram.com/${graphVersion}/me/conversations` +
      `?user_id=${encodeURIComponent(senderIgsid)}` +
      `&fields=${encodeURIComponent("messages.limit(12){from,message,created_time}")}` +
      `&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: Array<{
        messages?: {
          data?: Array<{ from?: { id?: string }; message?: string }>;
        };
      }>;
    };
    const raw = body.data?.[0]?.messages?.data ?? [];
    // Graph returns newest-first; the agent wants chronological order.
    return raw
      .filter((m) => typeof m.message === "string" && m.message.trim())
      .reverse()
      .map((m) => ({
        role:
          m.from?.id === igUserId ? ("assistant" as const) : ("user" as const),
        text: (m.message as string).trim(),
      }));
  } catch {
    return [];
  }
}

function normalizePerson(raw: unknown): PersonInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const date = typeof r.date === "string" ? r.date.trim() : "";
  const birthPlace =
    typeof r.birthPlace === "string" ? r.birthPlace.trim() : "";
  if (!name || !date || !birthPlace) return null;
  return {
    name,
    gender:
      typeof r.gender === "string" && r.gender.trim()
        ? r.gender.trim()
        : "person",
    date,
    time: typeof r.time === "string" && r.time.trim() ? r.time.trim() : null,
    birthPlace,
  };
}

/**
 * Validate the raw tool output into a safe AgentAction. Pure — unit-tested.
 * Returns null when the model produced something unusable (caller falls back).
 */
export function validateAgentAction(raw: unknown): AgentAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (r.action === "reply") {
    const messages = Array.isArray(r.messages)
      ? r.messages
          .filter((m): m is string => typeof m === "string" && !!m.trim())
          .map((m) => m.trim())
          .slice(0, 2)
      : [];
    return messages.length ? { action: "reply", messages } : null;
  }

  const confirmMessage =
    typeof r.confirmMessage === "string" && r.confirmMessage.trim()
      ? r.confirmMessage.trim()
      : "locked. pulling the chart now — give it a couple of minutes.";

  if (r.action === "generate_solo") {
    const person = normalizePerson(r.person);
    if (!person) return null;
    // Reuse the group validator's field limits via a 2-person round trip is
    // overkill; enforce the same caps directly.
    if (
      person.name.length > 80 ||
      person.gender.length > 60 ||
      person.date.length > 60 ||
      person.birthPlace.length > 160 ||
      (person.time && person.time.length > 40)
    ) {
      return null;
    }
    return { action: "generate_solo", person, confirmMessage };
  }

  if (r.action === "generate_group") {
    const people = Array.isArray(r.people)
      ? r.people.map(normalizePerson).filter((p): p is PersonInput => !!p)
      : [];
    const relationship = people.length === 2 ? "couple" : "family";
    const validated = validateGroupRequest(relationship, people);
    if (!validated.ok) return null;
    return {
      action: "generate_group",
      relationship,
      people: validated.people,
      confirmMessage,
    };
  }

  return null;
}

/**
 * One agent turn, executed on the Hermes runner (Claude subscription via the
 * claude CLI — no per-token API cost). Returns null on any failure — the
 * caller falls back to a static template so the user never gets silence.
 */
export async function runDmAgent(input: {
  history: DmTurn[];
  latestText: string;
}): Promise<AgentAction | null> {
  const runnerUrl = process.env.ROAST_RUNNER_URL;
  const runnerSecret = process.env.ROAST_RUNNER_SECRET;
  if (!runnerUrl || !runnerSecret) return null;
  try {
    const res = await fetch(`${runnerUrl}/dm-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runnerSecret}`,
      },
      body: JSON.stringify({
        history: input.history,
        latestText: input.latestText,
      }),
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      console.error("dm_agent_runner_non_ok", res.status);
      return null;
    }
    const body = (await res.json()) as { action?: unknown };
    return validateAgentAction(body.action);
  } catch (err) {
    console.error("dm_agent_failed", String(err).slice(0, 300));
    return null;
  }
}
