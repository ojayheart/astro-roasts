# AstroRoast Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-gated, mobile-first `/admin` section so the operator can view roasts & buyers, see live Stripe revenue, resend roast emails, and regenerate stuck roasts from a phone.

**Architecture:** A new `app/admin/` route group plus `app/api/admin/*` route handlers, all guarded by a root `middleware.ts` that verifies a stateless HMAC-signed cookie. Roasts/buyers come from the existing Neon+Drizzle `db`; revenue comes live from Stripe via the existing `getStripe()`. Two write actions (resend, regenerate) reuse existing hardened helpers.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM (Neon HTTP), Stripe SDK v22, Inngest v4, Resend (via existing `lib/email.ts`), Node 25 test runner (`node --test`).

## Global Constraints

- **Node test runner:** tests are `*.test.ts` under `test/`, use `node:test` + `node:assert/strict`, import lib modules with explicit `.ts` extension (e.g. `../lib/admin-auth.ts`). Run with `npm test` (`node --test`). Node 25 strips TS types natively — no build step.
- **Path alias:** `@/*` → repo root (e.g. `@/lib/db`).
- **Lint/typecheck:** `npm run lint` runs `tsc --noEmit` — must pass clean.
- **Edge-safe auth:** `middleware.ts` runs in the Edge runtime. `lib/admin-auth.ts` MUST use only Web Crypto (`crypto.subtle`) + `TextEncoder` — no `node:crypto`, no `Buffer`.
- **Two server-only env vars:** `ADMIN_PASSWORD` (the secret typed at login) and `ADMIN_SECRET` (HMAC key). Read directly from `process.env`. Never expose to the client; never prefix `NEXT_PUBLIC_`.
- **Safe by default:** only two writes exist (resend, regenerate). No delete, no edit of buyer/birth data. Every write is `POST`, cookie-guarded, confirm-tapped in UI.
- **Branch:** all work on `feat/admin-panel`. Do NOT merge to `main` until manual phone verification (Task 10) passes.
- **Commit author:** commits use the repo's committer script: `~/.claude/scripts/committer "<message>" <file> [<file>...]` (sets author, blocks `git add .`).

---

### Task 1: Admin auth core (`lib/admin-auth.ts`)

Pure, Edge-safe HMAC token sign/verify + timing-safe string compare. This is the only fully unit-tested unit; everything downstream depends on it.

**Files:**

- Create: `lib/admin-auth.ts`
- Test: `test/admin-auth.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export const ADMIN_COOKIE = "admin_session"`
  - `export const SESSION_TTL_MS = 2_592_000_000` (30 days)
  - `export async function signAdminToken(expMs: number, secret: string): Promise<string>` — returns `"<expMs>.<base64url-hmac>"`.
  - `export async function verifyAdminToken(token: string | undefined, secret: string, nowMs: number): Promise<boolean>` — true iff signature valid AND `expMs > nowMs`.
  - `export function timingSafeEqualStr(a: string, b: string): boolean` — constant-time-ish equality.

- [ ] **Step 1: Write the failing test**

Create `test/admin-auth.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  signAdminToken,
  verifyAdminToken,
  timingSafeEqualStr,
  ADMIN_COOKIE,
  SESSION_TTL_MS,
} from "../lib/admin-auth.ts";

const SECRET = "test-secret-key";

test("signed token verifies with the same secret", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  assert.equal(await verifyAdminToken(token, SECRET, now), true);
});

test("token fails with a different secret", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  assert.equal(await verifyAdminToken(token, "wrong-secret", now), false);
});

test("expired token fails", async () => {
  const exp = 1_000_000;
  const token = await signAdminToken(exp, SECRET);
  assert.equal(await verifyAdminToken(token, SECRET, exp + 1), false);
});

test("tampered payload fails", async () => {
  const now = 1_000_000;
  const token = await signAdminToken(now + SESSION_TTL_MS, SECRET);
  const tampered = `${now + SESSION_TTL_MS + 999}.${token.split(".")[1]}`;
  assert.equal(await verifyAdminToken(tampered, SECRET, now), false);
});

test("undefined / malformed token fails", async () => {
  assert.equal(await verifyAdminToken(undefined, SECRET, 0), false);
  assert.equal(await verifyAdminToken("garbage", SECRET, 0), false);
  assert.equal(await verifyAdminToken("123.", SECRET, 0), false);
});

test("timingSafeEqualStr", () => {
  assert.equal(timingSafeEqualStr("abc", "abc"), true);
  assert.equal(timingSafeEqualStr("abc", "abd"), false);
  assert.equal(timingSafeEqualStr("abc", "abcd"), false);
});

test("constants", () => {
  assert.equal(ADMIN_COOKIE, "admin_session");
  assert.equal(SESSION_TTL_MS, 2_592_000_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/admin-auth.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/admin-auth.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all `admin-auth` tests green (existing `cleanup.test.ts` stays green).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run lint`
Expected: no errors.

```bash
~/.claude/scripts/committer "feat(admin): HMAC-signed session token core" lib/admin-auth.ts test/admin-auth.test.ts
```

---

### Task 2: Login + logout routes + env wiring

**Files:**

- Create: `app/api/admin/login/route.ts`
- Create: `app/api/admin/logout/route.ts`
- Modify: `.env.local` (add `ADMIN_PASSWORD`, `ADMIN_SECRET` — local only, do NOT commit)

**Interfaces:**

- Consumes: `signAdminToken`, `timingSafeEqualStr`, `ADMIN_COOKIE`, `SESSION_TTL_MS` from `@/lib/admin-auth`.
- Produces: `POST /api/admin/login` (body `{password}`) → 200 + sets `admin_session` cookie, or 401. `POST /api/admin/logout` → 200 + clears cookie.

- [ ] **Step 1: Add local env vars**

Back up first (Vercel CLI / env edits can clobber): `cp .env.local .env.local.backup`
Then append to `.env.local` (replace the example values with real secrets; generate the secret with `openssl rand -hex 32`):

```
ADMIN_PASSWORD=choose-a-strong-passphrase
ADMIN_SECRET=<output of: openssl rand -hex 32>
```

- [ ] **Step 2: Write the login route**

Create `app/api/admin/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  signAdminToken,
  timingSafeEqualStr,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminPassword || !adminSecret) {
    return NextResponse.json(
      { error: "Admin not configured" },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!password || !timingSafeEqualStr(password, adminPassword)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const expMs = Date.now() + SESSION_TTL_MS;
  const token = await signAdminToken(expMs, adminSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
```

- [ ] **Step 3: Write the logout route**

Create `app/api/admin/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

- [ ] **Step 4: Manual verify**

Run `npm run dev`. In another shell:

```bash
# wrong password → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/admin/login \
  -H 'content-type: application/json' -d '{"password":"nope"}'   # expect 401

# right password → 200 + Set-Cookie: admin_session
curl -s -i -X POST localhost:3000/api/admin/login \
  -H 'content-type: application/json' -d '{"password":"<your ADMIN_PASSWORD>"}' \
  | grep -iE 'HTTP/|set-cookie'   # expect 200 + admin_session=...
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): login + logout routes" app/api/admin/login/route.ts app/api/admin/logout/route.ts
```

(Do NOT commit `.env.local`.)

---

### Task 3: Middleware guard

**Files:**

- Create: `middleware.ts` (repo root)

**Interfaces:**

- Consumes: `verifyAdminToken`, `ADMIN_COOKIE` from `@/lib/admin-auth`.
- Produces: requests to `/admin/**` and `/api/admin/**` (except `/api/admin/login`) require a valid cookie. Invalid → API gets `401 JSON`, pages fall through to render (the page itself shows the login form — Task 8).

- [ ] **Step 1: Write the middleware**

Create `middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login/logout must be reachable without a session.
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SECRET?.trim() ?? "";
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const valid = secret
    ? await verifyAdminToken(token, secret, Date.now())
    : false;

  if (valid) return NextResponse.next();

  // API routes: hard 401. Pages: let the request through so the page can
  // render its own login form (avoids a redirect loop + keeps it one URL).
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}
```

- [ ] **Step 2: Manual verify**

With `npm run dev` running:

```bash
# no cookie → 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/admin/roasts   # expect 401

# with cookie jar from a login → 200 (route exists after Task 6; until then 401/404 is fine)
curl -s -c /tmp/admin.cookies -X POST localhost:3000/api/admin/login \
  -H 'content-type: application/json' -d '{"password":"<your ADMIN_PASSWORD>"}' >/dev/null
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/admin.cookies localhost:3000/api/admin/login -X POST \
  -H 'content-type: application/json' -d '{"password":"<your ADMIN_PASSWORD>"}'   # expect 200 (login exempt)
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): middleware guard for /admin and /api/admin" middleware.ts
```

---

### Task 4: Revenue summary (`lib/admin-stripe.ts`) + money route

The pure `summarizeRevenue` is unit-tested; the route is a thin Stripe fetch + call.

**Files:**

- Create: `lib/admin-stripe.ts`
- Create: `app/api/admin/money/route.ts`
- Test: `test/admin-stripe.test.ts`

**Interfaces:**

- Consumes: `getStripe` from `@/lib/stripe`.
- Produces:
  - `export type PaymentLike = { amount: number; currency: string; status: string; created: number; metadata: { roastId?: string } | null }`
  - `export type CurrencyTotal = { currency: string; last30d: number; allTime: number; count: number }`
  - `export type RecentPayment = { amount: number; currency: string; created: number; roastId: string | null; status: string }`
  - `export type RevenueSummary = { byCurrency: CurrencyTotal[]; recent: RecentPayment[] }`
  - `export function summarizeRevenue(payments: PaymentLike[], nowMs: number): RevenueSummary` — pure. Counts only `status === "succeeded"`. Amounts in minor units (cents). `recent` = up to 20 most-recent succeeded, newest first.
  - `export async function fetchRevenueSummary(): Promise<RevenueSummary>` — pulls `stripe.paymentIntents.list({ limit: 100 })`, maps to `PaymentLike`, calls `summarizeRevenue`.
  - `export async function fetchPaidAmountsByRoastId(): Promise<Map<string, { amount: number; currency: string }>>` — for the Buyers tab; built from the same succeeded payments keyed by `metadata.roastId`.

- [ ] **Step 1: Write the failing test**

Create `test/admin-stripe.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeRevenue } from "../lib/admin-stripe.ts";

const NOW = 2_000_000_000_000; // fixed "now" in ms
const day = 86_400_000;
const sec = (ms: number) => Math.floor(ms / 1000); // Stripe created is unix seconds

const payments = [
  {
    amount: 500,
    currency: "usd",
    status: "succeeded",
    created: sec(NOW - 5 * day),
    metadata: { roastId: "r1" },
  },
  {
    amount: 700,
    currency: "usd",
    status: "succeeded",
    created: sec(NOW - 40 * day),
    metadata: { roastId: "r2" },
  },
  {
    amount: 900,
    currency: "eur",
    status: "succeeded",
    created: sec(NOW - 1 * day),
    metadata: { roastId: "r3" },
  },
  {
    amount: 999,
    currency: "usd",
    status: "requires_payment_method",
    created: sec(NOW - 1 * day),
    metadata: null,
  },
];

test("totals exclude non-succeeded and group by currency", () => {
  const s = summarizeRevenue(payments, NOW);
  const usd = s.byCurrency.find((c) => c.currency === "usd");
  const eur = s.byCurrency.find((c) => c.currency === "eur");
  assert.equal(usd?.allTime, 1200); // 500 + 700, excludes the failed 999
  assert.equal(usd?.last30d, 500); // only the 5-day-old one
  assert.equal(usd?.count, 2);
  assert.equal(eur?.allTime, 900);
  assert.equal(eur?.last30d, 900);
});

test("recent is succeeded-only, newest first, with roastId", () => {
  const s = summarizeRevenue(payments, NOW);
  assert.equal(s.recent.length, 3);
  assert.equal(s.recent[0].roastId, "r3"); // newest succeeded
  assert.equal(s.recent[0].currency, "eur");
  assert.ok(s.recent.every((p) => p.status === "succeeded"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/admin-stripe.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin-stripe.ts`:

```ts
import { getStripe } from "@/lib/stripe";

export type PaymentLike = {
  amount: number;
  currency: string;
  status: string;
  created: number; // unix seconds (Stripe convention)
  metadata: { roastId?: string } | null;
};

export type CurrencyTotal = {
  currency: string;
  last30d: number;
  allTime: number;
  count: number;
};

export type RecentPayment = {
  amount: number;
  currency: string;
  created: number;
  roastId: string | null;
  status: string;
};

export type RevenueSummary = {
  byCurrency: CurrencyTotal[];
  recent: RecentPayment[];
};

const THIRTY_DAYS_MS = 2_592_000_000;

export function summarizeRevenue(
  payments: PaymentLike[],
  nowMs: number,
): RevenueSummary {
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const cutoff = nowMs - THIRTY_DAYS_MS;

  const totals = new Map<string, CurrencyTotal>();
  for (const p of succeeded) {
    const t = totals.get(p.currency) ?? {
      currency: p.currency,
      last30d: 0,
      allTime: 0,
      count: 0,
    };
    t.allTime += p.amount;
    t.count += 1;
    if (p.created * 1000 >= cutoff) t.last30d += p.amount;
    totals.set(p.currency, t);
  }

  const recent = succeeded
    .slice()
    .sort((a, b) => b.created - a.created)
    .slice(0, 20)
    .map((p) => ({
      amount: p.amount,
      currency: p.currency,
      created: p.created,
      roastId: p.metadata?.roastId ?? null,
      status: p.status,
    }));

  return {
    byCurrency: Array.from(totals.values()).sort(
      (a, b) => b.allTime - a.allTime,
    ),
    recent,
  };
}

async function listSucceededPayments(): Promise<PaymentLike[]> {
  const stripe = getStripe();
  const res = await stripe.paymentIntents.list({ limit: 100 });
  return res.data.map((pi) => ({
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status,
    created: pi.created,
    metadata: (pi.metadata as { roastId?: string } | null) ?? null,
  }));
}

export async function fetchRevenueSummary(): Promise<RevenueSummary> {
  const payments = await listSucceededPayments();
  return summarizeRevenue(payments, Date.now());
}

export async function fetchPaidAmountsByRoastId(): Promise<
  Map<string, { amount: number; currency: string }>
> {
  const payments = await listSucceededPayments();
  const map = new Map<string, { amount: number; currency: string }>();
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const roastId = p.metadata?.roastId;
    if (roastId && !map.has(roastId)) {
      map.set(roastId, { amount: p.amount, currency: p.currency });
    }
  }
  return map;
}
```

- [ ] **Step 4: Write the money route**

Create `app/api/admin/money/route.ts`:

```ts
import { NextResponse } from "next/server";
import { fetchRevenueSummary } from "@/lib/admin-stripe";

export async function GET() {
  try {
    const summary = await fetchRevenueSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 5: Run tests + manual verify**

Run: `npm test` (expect PASS, including the new revenue tests).
With dev running and a login cookie jar:

```bash
curl -s -b /tmp/admin.cookies localhost:3000/api/admin/money | head -c 400   # expect JSON byCurrency/recent
```

- [ ] **Step 6: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): live Stripe revenue summary + money route" lib/admin-stripe.ts test/admin-stripe.test.ts app/api/admin/money/route.ts
```

---

### Task 5: Roasts + Buyers data layer + routes

**Files:**

- Create: `lib/admin-data.ts`
- Create: `app/api/admin/roasts/route.ts`
- Create: `app/api/admin/buyers/route.ts`

**Interfaces:**

- Consumes: `db` from `@/lib/db`; `roasts`, `users` from `@/lib/db/schema`; `eq`, `and`, `desc` from `drizzle-orm`; `fetchPaidAmountsByRoastId` from `@/lib/admin-stripe`.
- Produces:
  - `export type RoastFilter = "all" | "unsent" | "errors" | "unpaid"`
  - `export type RoastListItem = { id: string; name: string; email: string | null; sunSign: string | null; moonSign: string | null; rising: string | null; status: string; paid: boolean; emailSent: boolean; createdAt: string }`
  - `export async function listRoasts(filter: RoastFilter): Promise<RoastListItem[]>` — newest first.
  - `export type RoastDetail = RoastListItem & { gender: string | null; dob: string; birthTime: string | null; birthCity: string; title: string | null; teaser: string | null; fullText: string | null; validationNotes: string | null }`
  - `export async function getRoastDetail(id: string): Promise<RoastDetail | null>`
  - `export type BuyerItem = { userId: string; name: string; email: string | null; firstPaidAt: string; roastIds: string[]; amount: number | null; currency: string | null }`
  - `export async function listBuyers(): Promise<BuyerItem[]>` — users with ≥1 paid roast, newest purchase first; `amount`/`currency` from Stripe map (null if unmatched).

- [ ] **Step 1: Write the data layer**

Create `lib/admin-data.ts`:

```ts
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { fetchPaidAmountsByRoastId } from "@/lib/admin-stripe";

export type RoastFilter = "all" | "unsent" | "errors" | "unpaid";

export type RoastListItem = {
  id: string;
  name: string;
  email: string | null;
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  status: string;
  paid: boolean;
  emailSent: boolean;
  createdAt: string;
};

const listColumns = {
  id: roasts.id,
  name: users.name,
  email: users.email,
  sunSign: roasts.sunSign,
  moonSign: roasts.moonSign,
  rising: roasts.rising,
  status: roasts.status,
  paid: roasts.paid,
  emailSent: roasts.emailSent,
  createdAt: roasts.createdAt,
};

function filterWhere(filter: RoastFilter) {
  switch (filter) {
    case "unsent":
      return and(eq(roasts.paid, true), eq(roasts.emailSent, false));
    case "errors":
      return eq(roasts.status, "error");
    case "unpaid":
      return eq(roasts.paid, false);
    case "all":
    default:
      return undefined;
  }
}

export async function listRoasts(
  filter: RoastFilter,
): Promise<RoastListItem[]> {
  const rows = await db
    .select(listColumns)
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(filterWhere(filter))
    .orderBy(desc(roasts.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type RoastDetail = RoastListItem & {
  gender: string | null;
  dob: string;
  birthTime: string | null;
  birthCity: string;
  title: string | null;
  teaser: string | null;
  fullText: string | null;
  validationNotes: string | null;
};

export async function getRoastDetail(id: string): Promise<RoastDetail | null> {
  const [row] = await db
    .select({
      ...listColumns,
      gender: users.gender,
      dob: users.dob,
      birthTime: users.birthTime,
      birthCity: users.birthCity,
      title: roasts.title,
      teaser: roasts.teaser,
      fullText: roasts.fullText,
      validationNotes: roasts.validationNotes,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.id, id))
    .limit(1);

  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export type BuyerItem = {
  userId: string;
  name: string;
  email: string | null;
  firstPaidAt: string;
  roastIds: string[];
  amount: number | null;
  currency: string | null;
};

export async function listBuyers(): Promise<BuyerItem[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      roastId: roasts.id,
      createdAt: roasts.createdAt,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.paid, true))
    .orderBy(desc(roasts.createdAt));

  const amounts = await fetchPaidAmountsByRoastId();

  const byUser = new Map<string, BuyerItem>();
  for (const r of rows) {
    const existing = byUser.get(r.userId);
    const matched = amounts.get(r.roastId);
    if (existing) {
      existing.roastIds.push(r.roastId);
      if (existing.amount === null && matched) {
        existing.amount = matched.amount;
        existing.currency = matched.currency;
      }
    } else {
      byUser.set(r.userId, {
        userId: r.userId,
        name: r.name,
        email: r.email,
        firstPaidAt: r.createdAt.toISOString(),
        roastIds: [r.roastId],
        amount: matched?.amount ?? null,
        currency: matched?.currency ?? null,
      });
    }
  }
  return Array.from(byUser.values());
}
```

- [ ] **Step 2: Write the roasts route**

Create `app/api/admin/roasts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { listRoasts, getRoastDetail, type RoastFilter } from "@/lib/admin-data";

const FILTERS: RoastFilter[] = ["all", "unsent", "errors", "unpaid"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const detail = await getRoastDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
  const raw = searchParams.get("filter") ?? "all";
  const filter: RoastFilter = FILTERS.includes(raw as RoastFilter)
    ? (raw as RoastFilter)
    : "all";
  return NextResponse.json({ filter, roasts: await listRoasts(filter) });
}
```

- [ ] **Step 3: Write the buyers route**

Create `app/api/admin/buyers/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listBuyers } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json({ buyers: await listBuyers() });
}
```

- [ ] **Step 4: Manual verify**

With dev running + cookie jar:

```bash
curl -s -b /tmp/admin.cookies "localhost:3000/api/admin/roasts?filter=unsent" | head -c 400
curl -s -b /tmp/admin.cookies "localhost:3000/api/admin/buyers" | head -c 400
```

Expect JSON with the unsent roasts / buyer list.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): roasts + buyers data layer and routes" lib/admin-data.ts app/api/admin/roasts/route.ts app/api/admin/buyers/route.ts
```

---

### Task 6: Write actions — resend + regenerate

**Files:**

- Create: `app/api/admin/resend/route.ts`
- Create: `app/api/admin/regenerate/route.ts`

**Interfaces:**

- Consumes: `sendRoastEmailIfReady` from `@/lib/send-roast-email-if-ready`; `db`, `roasts`, `users` schema; `inngest` from `@/inngest/client`; `eq`, `and` from `drizzle-orm`.
- Produces:
  - `POST /api/admin/resend` body `{ roastId }` → `{ results: [{ roastId, sent }] }`; body `{ filter: "unsent" }` → resends every `paid && !emailSent && status="ready"` roast, returns per-roast results.
  - `POST /api/admin/regenerate` body `{ roastId }` → resets the roast to `generating` and re-fires the `roast/generate` Inngest event; returns `{ ok, roastId }`. 404 if roast/user missing.

- [ ] **Step 1: Write the resend route**

Create `app/api/admin/resend/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { sendRoastEmailIfReady } from "@/lib/send-roast-email-if-ready";

export async function POST(req: NextRequest) {
  let body: { roastId?: string; filter?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let ids: string[] = [];
  if (body.roastId) {
    ids = [body.roastId];
  } else if (body.filter === "unsent") {
    const rows = await db
      .select({ id: roasts.id })
      .from(roasts)
      .where(
        and(
          eq(roasts.paid, true),
          eq(roasts.emailSent, false),
          eq(roasts.status, "ready"),
        ),
      );
    ids = rows.map((r) => r.id);
  } else {
    return NextResponse.json(
      { error: "Provide roastId or filter:'unsent'" },
      { status: 400 },
    );
  }

  const results: { roastId: string; sent: boolean }[] = [];
  for (const id of ids) {
    const sent = await sendRoastEmailIfReady(id);
    results.push({ roastId: id, sent });
  }
  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Write the regenerate route**

Create `app/api/admin/regenerate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts, users } from "@/lib/db/schema";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  let body: { roastId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.roastId) {
    return NextResponse.json({ error: "Missing roastId" }, { status: 400 });
  }

  const [row] = await db
    .select({
      roastId: roasts.id,
      userId: users.id,
      name: users.name,
      gender: users.gender,
      email: users.email,
      dob: users.dob,
      birthTime: users.birthTime,
      birthCity: users.birthCity,
    })
    .from(roasts)
    .innerJoin(users, eq(roasts.userId, users.id))
    .where(eq(roasts.id, body.roastId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }

  await db
    .update(roasts)
    .set({ status: "generating", stagePct: 0 })
    .where(eq(roasts.id, row.roastId));

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: row.roastId,
      userId: row.userId,
      name: row.name,
      gender: row.gender ?? "",
      email: row.email,
      date: row.dob,
      time: row.birthTime,
      city: row.birthCity,
    },
  });

  return NextResponse.json({ ok: true, roastId: row.roastId });
}
```

- [ ] **Step 3: Manual verify (read-only check; do NOT spam real buyers)**

With dev + cookie jar. Use a known test roast id (one of your own). Resend on an already-sent roast safely no-ops:

```bash
curl -s -b /tmp/admin.cookies -X POST localhost:3000/api/admin/resend \
  -H 'content-type: application/json' -d '{"roastId":"<a-test-roast-id>"}'   # expect {results:[{roastId,sent}]}
```

Skip live regenerate unless you have a safe test roast; the route shape is verified by `npm run lint`.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): resend + regenerate actions" app/api/admin/resend/route.ts app/api/admin/regenerate/route.ts
```

---

### Task 7: Admin shell — layout + login

**Files:**

- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/LoginForm.tsx`
- Create: `app/admin/admin.module.css`

**Interfaces:**

- Consumes: `ADMIN_COOKIE`, `verifyAdminToken` from `@/lib/admin-auth`; `cookies` from `next/headers`; `AdminDashboard` from `./AdminDashboard` (Task 8 — import is added in Task 8, see note).
- Produces: `/admin` renders `LoginForm` when no valid cookie, else (after Task 8) the dashboard.

- [ ] **Step 1: Write the CSS module**

Create `app/admin/admin.module.css`:

```css
.shell {
  min-height: 100dvh;
  background: #030303;
  color: #e5e5e5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 16px;
  max-width: 640px;
  margin: 0 auto;
}
.login {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 25dvh;
}
.input {
  padding: 14px;
  font-size: 16px;
  border-radius: 10px;
  border: 1px solid #333;
  background: #111;
  color: #fff;
}
.button {
  padding: 14px;
  font-size: 16px;
  border-radius: 10px;
  border: none;
  background: #e5b94e;
  color: #1a1a1a;
  font-weight: 600;
}
.button:disabled {
  opacity: 0.5;
}
.tabs {
  display: flex;
  gap: 8px;
  margin: 8px 0 16px;
}
.tab {
  flex: 1;
  padding: 10px;
  border-radius: 999px;
  border: 1px solid #333;
  background: #111;
  color: #aaa;
  font-size: 14px;
}
.tabActive {
  background: #e5b94e;
  color: #1a1a1a;
  border-color: #e5b94e;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #333;
  background: #111;
  color: #aaa;
  font-size: 13px;
}
.chipActive {
  background: #222;
  color: #fff;
  border-color: #e5b94e;
}
.row {
  padding: 12px;
  border-radius: 10px;
  background: #0e0e0e;
  border: 1px solid #1c1c1c;
  margin-bottom: 8px;
}
.rowTop {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-weight: 600;
}
.meta {
  color: #888;
  font-size: 13px;
  margin-top: 4px;
}
.dots {
  display: flex;
  gap: 6px;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #333;
}
.dotOn {
  background: #4caf50;
}
.dotWarn {
  background: #e5b94e;
}
.error {
  color: #ff6b6b;
  padding: 12px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.detailText {
  white-space: pre-wrap;
  line-height: 1.6;
  margin-top: 12px;
  color: #ccc;
}
.muted {
  color: #888;
  font-size: 13px;
}
```

- [ ] **Step 2: Write the layout**

Create `app/admin/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AstroRoast Admin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 3: Write the login form**

Create `app/admin/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError("Wrong password");
      setPassword("");
    }
  }

  return (
    <form className={styles.login} onSubmit={submit}>
      <input
        className={styles.input}
        type="password"
        inputMode="text"
        autoComplete="current-password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <button
        className={styles.button}
        type="submit"
        disabled={busy || !password}
      >
        {busy ? "…" : "Enter"}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
```

- [ ] **Step 4: Write the page (login-only for now; dashboard wired in Task 8)**

Create `app/admin/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import styles from "./admin.module.css";
import LoginForm from "./LoginForm";

export default async function AdminPage() {
  const secret = process.env.ADMIN_SECRET?.trim() ?? "";
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const authed = secret
    ? await verifyAdminToken(token, secret, Date.now())
    : false;

  return (
    <div className={styles.shell}>
      {authed ? (
        <div className={styles.muted}>Authed ✓ (dashboard in Task 8)</div>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Manual verify**

Run `npm run dev`, open `localhost:3000/admin` in a browser. Expect the password field. Enter the wrong password → "Wrong password". Enter the right one → page refreshes to "Authed ✓".

- [ ] **Step 6: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): mobile shell + password login" app/admin/layout.tsx app/admin/page.tsx app/admin/LoginForm.tsx app/admin/admin.module.css
```

---

### Task 8: Dashboard — tabs, lists, actions

**Files:**

- Create: `app/admin/AdminDashboard.tsx`
- Modify: `app/admin/page.tsx` (swap the "Authed ✓" placeholder for `<AdminDashboard />`)

**Interfaces:**

- Consumes: the routes from Tasks 4–6 via `fetch`; `admin.module.css`.
- Produces: the live admin UI.

- [ ] **Step 1: Write the dashboard component**

Create `app/admin/AdminDashboard.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./admin.module.css";

type Tab = "roasts" | "buyers" | "money";
type Filter = "all" | "unsent" | "errors" | "unpaid";

type RoastItem = {
  id: string;
  name: string;
  email: string | null;
  sunSign: string | null;
  moonSign: string | null;
  rising: string | null;
  status: string;
  paid: boolean;
  emailSent: boolean;
  createdAt: string;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function when(iso: string | number) {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("roasts");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  }

  return (
    <div className={styles.shell}>
      <div className={styles.rowTop}>
        <strong>AstroRoast Admin</strong>
        <button className={styles.chip} onClick={logout}>
          Log out
        </button>
      </div>
      <div className={styles.tabs}>
        {(["roasts", "buyers", "money"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "roasts" && <RoastsTab />}
      {tab === "buyers" && <BuyersTab />}
      {tab === "money" && <MoneyTab />}
    </div>
  );
}

function RoastsTab() {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<RoastItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/roasts?filter=${filter}`);
    const data = await res.json();
    setRows(data.roasts ?? []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resendAll() {
    if (!confirm("Resend the roast email to ALL unsent buyers?")) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filter: "unsent" }),
    });
    const data = await res.json();
    const sent = (data.results ?? []).filter(
      (r: { sent: boolean }) => r.sent,
    ).length;
    setMsg(`Sent ${sent} / ${data.results?.length ?? 0}`);
    setBusy(false);
    load();
  }

  const FILTERS: Filter[] = ["all", "unsent", "errors", "unpaid"];
  const labels: Record<Filter, string> = {
    all: "All",
    unsent: "Paid · not emailed",
    errors: "Errors",
    unpaid: "Unpaid",
  };

  return (
    <>
      <div className={styles.chips}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {labels[f]}
          </button>
        ))}
      </div>
      {filter === "unsent" && rows.length > 0 && (
        <button className={styles.button} onClick={resendAll} disabled={busy}>
          {busy ? "Sending…" : `Resend all (${rows.length})`}
        </button>
      )}
      {msg && <div className={styles.muted}>{msg}</div>}
      {rows.map((r) => (
        <div key={r.id} className={styles.row}>
          <div
            className={styles.rowTop}
            onClick={() => setOpen(open === r.id ? null : r.id)}
          >
            <div>
              <div className={styles.name}>{r.name}</div>
              <div className={styles.meta}>
                {[r.sunSign, r.moonSign, r.rising]
                  .filter(Boolean)
                  .join(" · ") || "—"}{" "}
                · {when(r.createdAt)}
              </div>
            </div>
            <div className={styles.dots}>
              <span
                className={`${styles.dot} ${r.paid ? styles.dotOn : ""}`}
                title="paid"
              />
              <span
                className={`${styles.dot} ${r.emailSent ? styles.dotOn : r.paid ? styles.dotWarn : ""}`}
                title="emailed"
              />
            </div>
          </div>
          {open === r.id && <RoastDetail id={r.id} onChange={load} />}
        </div>
      ))}
      {rows.length === 0 && <div className={styles.muted}>No roasts.</div>}
    </>
  );
}

function RoastDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/roasts?id=${id}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [id]);

  async function act(path: string, label: string) {
    if (!confirm(`${label} for this roast?`)) return;
    setBusy(true);
    setMsg("");
    const body = path === "resend" ? { roastId: id } : { roastId: id };
    const res = await fetch(`/api/admin/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `${label} ✓` : `Failed: ${data.error ?? res.status}`);
    onChange();
  }

  if (!detail) return <div className={styles.muted}>Loading…</div>;
  const d = detail as Record<string, string | null>;
  return (
    <div>
      <div className={styles.meta}>
        {d.email ?? "no email"} · {d.gender ?? "—"} · {d.dob}{" "}
        {d.birthTime ?? ""} · {d.birthCity}
      </div>
      <div className={styles.meta}>status: {d.status}</div>
      {d.title && (
        <div className={styles.detailText}>
          <strong>{d.title}</strong>
        </div>
      )}
      {d.fullText && <div className={styles.detailText}>{d.fullText}</div>}
      {d.validationNotes && (
        <div className={styles.muted}>QA: {d.validationNotes}</div>
      )}
      <div className={styles.actions}>
        <button
          className={styles.chip}
          disabled={busy}
          onClick={() => act("resend", "Resend email")}
        >
          Resend email
        </button>
        <button
          className={styles.chip}
          disabled={busy}
          onClick={() => act("regenerate", "Regenerate")}
        >
          Regenerate
        </button>
      </div>
      {msg && <div className={styles.muted}>{msg}</div>}
    </div>
  );
}

function BuyersTab() {
  const [rows, setRows] = useState<
    {
      userId: string;
      name: string;
      email: string | null;
      firstPaidAt: string;
      roastIds: string[];
      amount: number | null;
      currency: string | null;
    }[]
  >([]);
  useEffect(() => {
    fetch("/api/admin/buyers")
      .then((r) => r.json())
      .then((d) => setRows(d.buyers ?? []));
  }, []);
  return (
    <>
      {rows.map((b) => (
        <div key={b.userId} className={styles.row}>
          <div className={styles.name}>{b.name}</div>
          <div className={styles.meta}>
            {b.email ?? "no email"} · {when(b.firstPaidAt)} ·{" "}
            {b.amount != null && b.currency ? money(b.amount, b.currency) : "—"}{" "}
            · {b.roastIds.length} roast{b.roastIds.length > 1 ? "s" : ""}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className={styles.muted}>No buyers yet.</div>}
    </>
  );
}

function MoneyTab() {
  const [data, setData] = useState<
    | {
        byCurrency: {
          currency: string;
          last30d: number;
          allTime: number;
          count: number;
        }[];
        recent: {
          amount: number;
          currency: string;
          created: number;
          roastId: string | null;
          status: string;
        }[];
      }
    | { error: string }
    | null
  >(null);
  useEffect(() => {
    fetch("/api/admin/money")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className={styles.muted}>Loading…</div>;
  if ("error" in data)
    return <div className={styles.error}>Stripe error: {data.error}</div>;

  return (
    <>
      {data.byCurrency.map((c) => (
        <div key={c.currency} className={styles.row}>
          <div className={styles.name}>{c.currency.toUpperCase()}</div>
          <div className={styles.meta}>
            Last 30d: {money(c.last30d, c.currency)} · All-time:{" "}
            {money(c.allTime, c.currency)} · {c.count} sales
          </div>
        </div>
      ))}
      <div className={styles.muted} style={{ margin: "12px 0 6px" }}>
        Recent payments
      </div>
      {data.recent.map((p, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.rowTop}>
            <span>{money(p.amount, p.currency)}</span>
            <span className={styles.muted}>{when(p.created)}</span>
          </div>
        </div>
      ))}
      {data.byCurrency.length === 0 && (
        <div className={styles.muted}>No payments yet.</div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire the dashboard into the page**

In `app/admin/page.tsx`, add the import and replace the authed placeholder.

Replace:

```tsx
import LoginForm from "./LoginForm";
```

with:

```tsx
import LoginForm from "./LoginForm";
import AdminDashboard from "./AdminDashboard";
```

Replace:

```tsx
return (
  <div className={styles.shell}>
    {authed ? (
      <div className={styles.muted}>Authed ✓ (dashboard in Task 8)</div>
    ) : (
      <LoginForm />
    )}
  </div>
);
```

with:

```tsx
if (!authed) {
  return (
    <div className={styles.shell}>
      <LoginForm />
    </div>
  );
}
return <AdminDashboard />;
```

- [ ] **Step 3: Manual verify**

`npm run dev`, log in at `localhost:3000/admin`. Check: Roasts tab lists rows; tapping a row expands detail; filter chips work; "Paid · not emailed" shows the Resend-all button; Buyers tab lists buyers with amounts; Money tab shows currency totals + recent. Log out returns to the password field.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run lint` (expect clean).

```bash
~/.claude/scripts/committer "feat(admin): dashboard tabs, roast detail, resend/regenerate UI" app/admin/AdminDashboard.tsx app/admin/page.tsx
```

---

### Task 9: Preview deploy + phone verification

**Files:** none (deploy + config).

- [ ] **Step 1: Set production/preview env vars in Vercel**

Back up local env first: `cp .env.local .env.local.backup`. Add the two secrets to the Vercel project for Preview + Production (use the dashboard or REST API — note the CLI `link`/`env` bug from project memory). Names: `ADMIN_PASSWORD`, `ADMIN_SECRET`. Use the same values you put in `.env.local`.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/admin-panel
```

Vercel builds a preview. Grab the preview URL.

- [ ] **Step 3: Verify on your phone**

Open `<preview-url>/admin` on your phone. Confirm: login works; all three tabs load real data; add-to-home-screen works; a **single deliberate** resend to one of your own roasts arrives. Do NOT bulk-resend to real buyers from preview unless intended.

- [ ] **Step 4: Merge to main once happy**

```bash
git checkout main
git merge --no-ff feat/admin-panel
git push origin main
```

Production deploy goes live at `astroroast.com/admin`.

---

## Self-Review

**Spec coverage:**

- Password-gated `/admin` → Tasks 1–3, 7. ✓
- Roasts tab + "paid·not emailed" filter + resend-all → Tasks 5, 6, 8. ✓
- Buyers tab → Tasks 5, 8. ✓
- Money tab (Stripe live, currency-aware) → Task 4, 8. ✓
- Resend (single + bulk) reusing hardened helper → Task 6. ✓
- Regenerate via Inngest → Task 6. ✓
- Data split (Postgres roasts/buyers, Stripe money) → Tasks 4–5. ✓
- Edge-safe auth (Web Crypto) → Task 1. ✓
- Error handling (401, isolated Stripe failure, email no-op) → Tasks 3, 4, 6. ✓
- Testing (auth gate logic, revenue summary) → Tasks 1, 4. ✓ (Auth gate verified via unit-tested `verifyAdminToken` + manual middleware curl, consistent with the repo's no-route-test precedent.)
- Branch → preview → merge rollout → Task 9. ✓
- Out-of-scope items (magic link, edit data, delete, analytics) → not built. ✓

**Type consistency:** `RoastListItem`/`RoastDetail`/`BuyerItem`/`RevenueSummary` shapes produced in Tasks 4–5 match the `fetch` consumers in Task 8. `roast/generate` event payload in Task 6 matches `RoastGenerateEvent` in `inngest/client.ts` (`gender` coerced to `""` since the event type requires `string`). `ADMIN_COOKIE`/`verifyAdminToken`/`signAdminToken` signatures consistent across Tasks 1–3, 7.

**Placeholder scan:** no TBD/TODO; every code step has complete code. The only intentional throwaway is the "Authed ✓" placeholder in Task 7, explicitly replaced in Task 8 Step 2.
