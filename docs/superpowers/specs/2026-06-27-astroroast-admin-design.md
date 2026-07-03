# AstroRoast Admin — Design

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/admin-panel`

## Goal

A mobile-first admin section at `/admin` so Oliver can run AstroRoast from his phone:
view roasts & buyers, resend roast emails (esp. the unsent buyers), see live revenue,
and replay/regenerate stuck roasts. Add-to-home-screen → feels like an app.

## Constraints

- **No new infra.** Reuse what the app already has: Neon Postgres (Drizzle, `lib/db`),
  Stripe SDK (`stripe` ^22.2.0), `lib/email.ts` (`sendRoastEmail`), Inngest pipeline.
- **Single-operator tool.** One user (Oliver). No multi-user roles, no audit trail in v1.
- **Mobile-first.** Thumb-reachable controls, single page with tabs, large tap targets.
- **Safe by default.** Read-mostly. The only writes are resend-email and regenerate,
  each behind an explicit confirm tap. No delete, no editing buyer/birth data.
- **Rollout:** build on `feat/admin-panel`, test on Vercel preview from phone, then merge
  to `main` / production once approved.

## Architecture

```
app/
  admin/
    layout.tsx          # mobile shell, viewport, no-index meta
    page.tsx            # login OR dashboard (server component; reads cookie)
    AdminTabs.tsx       # client: Roasts | Buyers | Money tab switcher
    LoginForm.tsx       # client: password field -> POST /api/admin/login
  api/admin/
    login/route.ts      # POST: verify ADMIN_PASSWORD -> set signed cookie
    logout/route.ts     # POST: clear cookie
    roasts/route.ts     # GET: list (filters), GET ?id= : detail
    buyers/route.ts     # GET: users with >=1 paid roast + amounts
    money/route.ts      # GET: Stripe totals + recent payments
    resend/route.ts     # POST {roastId} | {filter:"unsent"} : sendRoastEmail
    regenerate/route.ts # POST {roastId}: re-fire Inngest pipeline event
middleware.ts           # guard /admin/** and /api/admin/** (cookie check)
lib/admin-auth.ts       # signCookie / verifyCookie (HMAC), getAdminSession()
```

### Auth

- Two env vars: `ADMIN_PASSWORD` (the secret you type) and `ADMIN_SECRET` (HMAC key for the
  cookie). Both stored in Vercel env + macOS keychain.
- `POST /api/admin/login` constant-time-compares the submitted password against
  `ADMIN_PASSWORD`. On match, sets `admin_session` cookie: httpOnly, secure, sameSite=lax,
  30-day expiry. Cookie value = `payload.HMAC(payload, ADMIN_SECRET)` where payload is an
  expiry timestamp — no DB row needed (stateless).
- `middleware.ts` verifies the cookie HMAC + expiry for every `/admin/**` and
  `/api/admin/**` request. Page routes without a valid cookie render the login form;
  API routes return `401`. `/api/admin/login` itself is exempt.
- `lib/admin-auth.ts` owns sign/verify so middleware and route handlers share one
  implementation. Uses Web Crypto (`crypto.subtle`) so it runs in the Edge middleware runtime.

### Data sources (clean split)

- **Roasts + Buyers → Postgres** via existing Drizzle `db`. Roasts list joins `users` for
  name/email. Buyers = users having `>=1` roast with `paid = true`.
- **Money → Stripe** (source of truth for money; currency-aware, reflects refunds). One
  `stripe.paymentIntents.list` / `charges.list` call per Money-tab load, summed server-side.
  Roast counts shown alongside come from Postgres.

## Screens

Single page, three tabs (client-side switch, data fetched per tab):

### Roasts

- Reverse-chron list. Each row: name · sun/moon/rising · `status` badge
  (generating/ready/error) · `paid` dot · `emailSent` dot · relative time.
- Filter chips: **All** · **Paid · not emailed** · **Errors** · **Unpaid**.
  The "Paid · not emailed" chip is the unsent-buyers view and shows a **Resend all** button.
- Tap a row → detail: full birth info (dob, time, city), teaser, full text, title,
  `validationNotes`, timestamps. Detail has per-roast **Resend email** and (if `status=error`
  or stuck) **Regenerate** buttons.

### Buyers

- Users with at least one paid roast: name · email · first purchase date · amount (from the
  matching Stripe payment where resolvable, else base price). Tap → their roast(s).

### Money

- **Last 30 days** total, **all-time** total (Stripe, grouped by currency).
- Recent payments list: amount · currency · buyer email · date · status.
- Postgres counters: total roasts, paid, unsent (`paid && !emailSent`).

## Actions (writes)

All are `POST /api/admin/*`, cookie-guarded, each fronted by a confirm tap in the UI, each
returns a result toast (success / failure with message).

- **Resend email** — `resend/route.ts`. Body `{roastId}` resends one; body
  `{filter:"unsent"}` iterates every `paid && !emailSent` roast and calls `sendRoastEmail`,
  flipping `emailSent=true` only on a real send (per hardened `lib/email.ts`). Returns
  per-roast results.
- **Regenerate / replay** — `regenerate/route.ts`. Body `{roastId}` re-fires the Inngest
  pipeline event for that roast (same event shape `app/api/generate` uses). For stuck/`error`
  roasts. Returns the event id.

No other writes in v1.

## Error handling

- Missing/invalid cookie → 401 (api) or login form (page).
- Stripe call fails → Money tab shows an inline error, other tabs unaffected (isolated fetch).
- `sendRoastEmail` with no `RESEND_API_KEY` → no-op + warn, never throws (already hardened);
  resend reports "not sent (email not configured)" rather than a false success.
- Regenerate on a non-existent / already-ready roast → 409 with a clear message.

## Testing

Lightweight integration checks (no full e2e):

1. **Auth gate** — request `/api/admin/roasts` with no cookie → 401; with a freshly signed
   valid cookie → 200. Tampered cookie → 401.
2. **Roasts query** — seeded/real DB returns rows with the expected shape and the
   "paid && !emailSent" filter selects only those.
3. **Resend no-op** — with `RESEND_API_KEY` unset, resend returns "not sent" and does NOT
   flip `emailSent`.

## Out of scope (v1)

- Phase-2 user-facing dashboard (separate effort).
- Magic-link admin login, multi-user roles, audit log.
- Editing copy/testimonials, editing buyer/birth data, deleting roasts.
- Analytics charts / cohort views. Money tab is totals + recent list only.

## Open risks

- **Edge runtime crypto:** middleware runs on Edge — sign/verify must use Web Crypto, not
  Node `crypto`. Mitigated by `lib/admin-auth.ts` using `crypto.subtle`.
- **Stripe ↔ buyer matching:** linking a Stripe payment to a specific roast/buyer may be
  imperfect if metadata is sparse. Buyers tab falls back to base price when no Stripe match;
  Money tab totals are still exact (summed straight from Stripe).
