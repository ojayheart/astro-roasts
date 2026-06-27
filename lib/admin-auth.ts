import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Self-contained admin auth: a single shared password (ADMIN_PASSWORD) gates the
// /admin panel. On login we mint an HMAC-signed, time-stamped session token and
// store it in an httpOnly cookie. There is no user table for admins — this is a
// single-operator console, so a shared secret is the right amount of machinery.

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

// The HMAC key. Falls back to ADMIN_PASSWORD so a single env var is enough, but
// ADMIN_SESSION_SECRET can be set to rotate sessions without changing the
// password (or vice versa).
function getSecret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function adminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

// Constant-time comparison of the submitted password against ADMIN_PASSWORD.
export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch; guard first. Leaking length is
  // acceptable here and unavoidable without hashing both sides.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// Token format: "<issuedMs>.<nonce>.<hexHmac>". The nonce keeps tokens unique;
// the timestamp drives expiry independent of the cookie's own Max-Age.
export function createSessionToken(): string {
  const issued = Date.now().toString();
  const nonce = randomBytes(12).toString("hex");
  const payload = `${issued}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!getSecret()) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issued, nonce, signature] = parts;

  const expected = sign(`${issued}.${nonce}`);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expBuf)) return false;

  const issuedMs = Number(issued);
  if (!Number.isFinite(issuedMs)) return false;
  if (Date.now() - issuedMs > ADMIN_COOKIE_MAX_AGE * 1000) return false;

  return true;
}

// Read the cookie in a server component / route handler and return whether the
// caller is an authenticated admin.
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
}
