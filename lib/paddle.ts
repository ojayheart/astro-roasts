import crypto from "crypto";

interface VerifyPaddleTransactionInput {
  rawBody: string;
  signature: string;
  secret: string;
  expectedPriceId?: string;
  nowSeconds?: number;
}

type VerifyPaddleTransactionResult =
  | { ok: true; roastId: string }
  | { ok: false; error?: string };

type PaddlePayload = {
  event_type?: string;
  data?: {
    custom_data?: {
      roastId?: unknown;
    };
    items?: {
      price?: {
        id?: unknown;
      };
    }[];
  };
};

function parsePaddleSignature(signature: string): Record<string, string> {
  return Object.fromEntries(
    signature.split(";").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    }),
  );
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyPaddleTransaction({
  rawBody,
  signature,
  secret,
  expectedPriceId,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifyPaddleTransactionInput): VerifyPaddleTransactionResult {
  const parts = parsePaddleSignature(signature);
  const timestamp = Number(parts.ts);

  if (!parts.ts || !parts.h1 || !Number.isFinite(timestamp)) {
    return { ok: false, error: "Malformed signature" };
  }

  if (Math.abs(nowSeconds - timestamp) > 5 * 60) {
    return { ok: false, error: "Stale signature" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${parts.ts}:${rawBody}`)
    .digest("hex");

  if (!safeEqualHex(parts.h1, expectedSignature)) {
    return { ok: false, error: "Invalid signature" };
  }

  const payload = JSON.parse(rawBody) as PaddlePayload;

  if (payload.event_type !== "transaction.completed") {
    return { ok: false, error: "Unsupported event" };
  }

  const roastId = payload.data?.custom_data?.roastId;
  if (typeof roastId !== "string" || !roastId) {
    return { ok: false, error: "Missing roast id" };
  }

  if (expectedPriceId) {
    const items = Array.isArray(payload.data?.items) ? payload.data.items : [];
    const hasExpectedPrice = items.some(
      (item) => item?.price?.id === expectedPriceId,
    );

    if (!hasExpectedPrice) {
      return { ok: false, error: "Unexpected price" };
    }
  }

  return { ok: true, roastId };
}
