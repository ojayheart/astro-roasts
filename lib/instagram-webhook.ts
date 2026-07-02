export type InstagramWebhookMessage = {
  senderId: string;
  recipientId: string | null;
  text: string;
  mid: string | null;
};

export type ParsedInstagramRoastRequest = {
  name: string;
  gender: string;
  date: string;
  time: string | null;
  birthPlace: string;
};

export function verifyInstagramWebhookChallenge(
  searchParams: URLSearchParams,
  expectedToken: string | undefined,
): { ok: true; challenge: string } | { ok: false } {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    !expectedToken ||
    mode !== "subscribe" ||
    token !== expectedToken ||
    !challenge
  ) {
    return { ok: false };
  }

  return { ok: true, challenge };
}

export function extractInstagramTextMessages(
  payload: unknown,
): InstagramWebhookMessage[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const entries = Array.isArray((payload as { entry?: unknown }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];

  const messages: InstagramWebhookMessage[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const messaging = Array.isArray(
      (entry as { messaging?: unknown }).messaging,
    )
      ? (entry as { messaging: unknown[] }).messaging
      : [];

    for (const event of messaging) {
      if (!event || typeof event !== "object") continue;
      const senderId = stringAt(event, ["sender", "id"]);
      const text = stringAt(event, ["message", "text"]);
      const isEcho = Boolean(
        (event as { message?: { is_echo?: unknown } }).message?.is_echo,
      );
      if (!senderId || !text || isEcho) continue;

      messages.push({
        senderId,
        recipientId: stringAt(event, ["recipient", "id"]),
        text: text.trim(),
        mid: stringAt(event, ["message", "mid"]),
      });
    }
  }

  return messages;
}

export function parseInstagramRoastRequest(
  text: string,
): ParsedInstagramRoastRequest | null {
  const fields = parseKeyValueFields(text);
  const name = pick(fields, ["name"]);
  const date = pick(fields, ["dob", "date", "birth date", "date of birth"]);
  const birthPlace = pick(fields, [
    "birthplace",
    "birth place",
    "place",
    "city",
    "birth city",
    "location",
  ]);
  const time = pick(fields, ["time", "birth time", "time of birth"]);
  const gender = pick(fields, ["gender"]) || "person";

  if (!name || !date || !birthPlace) {
    return null;
  }

  const cleanName = compact(name);
  const cleanDate = compact(date);
  const cleanPlace = compact(birthPlace);
  const cleanGender = compact(gender);
  const cleanTime = time ? compact(time) : null;

  if (
    cleanName.length > 80 ||
    cleanDate.length > 60 ||
    cleanPlace.length > 160 ||
    cleanGender.length > 60 ||
    (cleanTime && cleanTime.length > 40)
  ) {
    return null;
  }

  return {
    name: cleanName,
    gender: cleanGender,
    date: cleanDate,
    time: cleanTime,
    birthPlace: cleanPlace,
  };
}

function stringAt(value: unknown, path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

function parseKeyValueFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  const normalized = text.replace(/\r\n/g, "\n");
  const chunks = normalized
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const match = chunk.match(/^([A-Za-z][A-Za-z ]{1,24})\s*[:=-]\s*(.+)$/);
    if (!match) continue;
    fields.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  return fields;
}

function pick(fields: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields.get(key);
    if (value) return value;
  }
  return null;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function detectGroupKeyword(text: string): "couple" | "family" | null {
  const clean = text
    .trim()
    .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
    .toLowerCase();
  if (clean === "roast us") return "couple";
  if (clean === "roast my family" || clean === "roast family") return "family";
  return null;
}

export const GROUP_TEMPLATE_MESSAGES: Record<"couple" | "family", string[]> = {
  couple: [
    `both of you. one message, this exact shape:

person 1:
name: …
dob: 1994-01-21
place: city, country
time: 13:00 (optional)
gender: …

person 2:
name: …
dob: …
place: …

send it and the chart does the rest.`,
  ],
  family: [
    `the whole household. one message, 3 to 6 people, this exact shape:

person 1:
name: …
dob: 1994-01-21
place: city, country
time: 13:00 (optional)
gender: …

person 2:
name: …
dob: …
place: …

person 3:
name: …
dob: …
place: …

add person 4-6 the same way. send it. nobody is safe.`,
  ],
};

export function parseInstagramGroupRequest(text: string): {
  relationship: "couple" | "family";
  people: ParsedInstagramRoastRequest[];
} | null {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/(?=^\s*person\s*\d+\s*:)/im)
    .map((b) => b.replace(/^\s*person\s*\d+\s*:/im, "").trim())
    .filter(Boolean);

  if (
    blocks.length &&
    !/^name\s*[:=-]/im.test(blocks[0]) &&
    !parseInstagramRoastRequest(blocks[0])
  ) {
    blocks.shift();
  }

  if (blocks.length < 2 || blocks.length > 6) return null;

  const people: ParsedInstagramRoastRequest[] = [];
  for (const block of blocks) {
    const person = parseInstagramRoastRequest(block);
    if (!person) return null;
    people.push(person);
  }
  return {
    relationship: people.length === 2 ? "couple" : "family",
    people,
  };
}
