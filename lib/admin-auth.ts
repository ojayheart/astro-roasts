export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_MS = 2_592_000_000; // 30 days

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64url(new Uint8Array(sig));
}

// Constant-time-ish string compare. Returns false immediately on length
// mismatch (signature length is fixed, so this leaks nothing useful), then
// XOR-accumulates over all characters so equal-length inputs take equal time.
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signAdminToken(
  expMs: number,
  secret: string,
): Promise<string> {
  const payload = String(expMs);
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyAdminToken(
  token: string | undefined,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!sig) return false;
  const expMs = Number(payload);
  if (!Number.isFinite(expMs)) return false;
  const expected = await hmac(payload, secret);
  if (!timingSafeEqualStr(sig, expected)) return false;
  return expMs > nowMs;
}
