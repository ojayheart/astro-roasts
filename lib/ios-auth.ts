import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Email sign-in for the iOS app, with no new tables.
 *
 * - A 6-digit code is derived from HMAC(secret, email + 10-minute window). It is emailed to the address, so only the owner can read it.
 *   The current and previous window are accepted (10-20 minutes). Guessing is limited per email and per IP by the routes.
 * - A successful check returns a signed session token (HS256, one year) naming the email. Every account request carries it as a Bearer token.
 * - "Account" = the email. Its roasts are the roasts whose owner (users.email) is that address.
 */

export const CODE_WINDOW_MS = 10 * 60 * 1000;
export const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

function secret(): string {
  const s = process.env.IOS_AUTH_SECRET?.trim();
  if (!s || s.length < 24) throw new Error("IOS_AUTH_SECRET is not configured");
  return s;
}

export function codeFor(email: string, window: number, key = secret()): string {
  const mac = createHmac("sha256", key).update(`code|${email}|${window}`).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function currentCode(email: string, now = Date.now(), key?: string): string {
  return codeFor(email, Math.floor(now / CODE_WINDOW_MS), key);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkCode(email: string, code: unknown, now = Date.now(), key?: string): boolean {
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return false;
  const w = Math.floor(now / CODE_WINDOW_MS);
  const c = code.trim();
  // evaluate both windows so timing doesn't reveal which one matched
  const a = safeEqual(codeFor(email, w, key), c);
  const b = safeEqual(codeFor(email, w - 1, key), c);
  return a || b;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(email: string, now = Date.now(), key = secret()): string {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ sub: email, iat: Math.floor(now / 1000), exp: Math.floor((now + TOKEN_TTL_MS) / 1000), v: 1 }));
  const sig = createHmac("sha256", key).update(`${head}.${body}`).digest();
  return `${head}.${body}.${b64u(sig)}`;
}

export function verifyToken(token: string, now = Date.now(), key?: string): { email: string } | null {
  try {
    const k = key ?? secret();
    const [head, body, sig] = token.split(".");
    if (!head || !body || !sig) return null;
    const expected = createHmac("sha256", k).update(`${head}.${body}`).digest();
    if (!safeEqual(b64u(expected), sig)) return null;
    const h = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
    if (h.alg !== "HS256") return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!p.sub || !p.exp || p.exp * 1000 < now) return null;
    return normalizeEmail(p.sub) ? { email: p.sub } : null;
  } catch {
    return null;
  }
}

/** Reads "Authorization: Bearer <token>" and returns the account email, or null. */
export function accountFromRequest(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? (verifyToken(m[1].trim())?.email ?? null) : null;
}
