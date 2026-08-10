# iOS subscription backend — decisions log

Autonomous run, no operator. Every self-made call and every blocker lands here.

## Round 2 (migration)

**Decisions file lives here, not `.lh-harness/DECISIONS.md`.** The executor's operating
rules mark `/Users/oliverhart/Developer/astro-roasts/.lh-harness` as harness-owned and
off limits — never read, list, or modify. That directory also holds run logs, so
committing it would put harness state into the repo. Decisions therefore go to a
tracked docs path alongside the plan they belong to.

**Migration slot is `drizzle/0009_subscriptions.sql`.** Verified first-hand: `drizzle/`
holds 0000–0008, highest is `0008_add_subject_charts.sql`, 0009 was free. No existing
migration renumbered, rewritten, or reformatted.

**Migration is written but NOT applied.** The file header says so. Applying against Neon
is a human step; no database connection was opened at any point.

**Plan §8 is stale in two places, superseded by the task's rulings.**

- §8 phase 1 says "Migration 0006" — 0006 is occupied by `0006_add_unlocked_via.sql`.
  0009 governs.
- §8 phase 1's exit gate is "Migration applied to Neon" — superseded; the gate for this
  run is that the SQL exists and parses offline.

**Plan §4 names "Sonnet 5" in the job topology diagram; §7 sets the default to
`claude-opus-5`.** §7 wins — it is the costed decision with a live-verified price table
and an explicit "Default: Opus 5". `ROAST_MODEL` stays an env var either way.

**SQL style follows the repo, not the plan's snippet.** Existing `drizzle/*.sql` use
uppercase keywords, `IF NOT EXISTS` on every object, and a leading comment explaining
why the change exists. The plan's §2 snippet is lowercase; column names, types,
defaults, indexes and unique constraints are reproduced exactly, only the keyword case
and the `IF NOT EXISTS` guards differ.

**`notify_hour` typed `integer`, not `int`.** Same type; `integer` is what
`lib/db/schema.ts` and the existing migrations spell.

**`users.tz` not added** — already present at `lib/db/schema.ts:27` as
`text("tz").notNull()`. `devices.tz` is a distinct column by design (account timezone vs
handset timezone; the daily push follows the handset).

**Offline parse verification used `pglast` (libpg_query, the real Postgres grammar) in a
throwaway venv at `/tmp/.sqlparse-venv`.** Not added to project dependencies. Result: 11
statements — 5 `CreateStmt`, 4 `IndexStmt`, 2 `AlterTableStmt`, both of the latter
`AT_AddColumn` with `missing_ok`. No ALTER of an existing column, no DROP.

## Round 3 (Drizzle mirror of 0009)

Decisions carrier stays at this docs path. `.lh-harness/` is harness-owned — never read,
listed, or written by this run.

**Baseline re-measured, not assumed.** Before editing: `npm run lint` exit 0; `npm test`
95 tests / 93 pass / 2 fail (`test/chart-annotations.test.ts:1:1`,
`test/compute-chart.test.ts:1:1`). After editing: identical. Neither failing file was
touched.

**`timestamptz` → `timestamp(name, { withTimezone: true })`.** The SQL is authoritative
and every new timestamp column is `timestamptz`. Existing columns in the file use bare
`timestamp(...)`; those are left alone rather than retro-fitted, so the file now carries
both spellings — deliberate, each matching the SQL that created its table.

**`date` → drizzle `date(...)`, default string mode.** `for_date`, `period_start` and
`period_end` are calendar dates with no zone; the string mode round-trips `YYYY-MM-DD`
without a UTC-midnight shift, which matters because the daily roast is keyed on the
user's local date.

**`jsonb` → `jsonb(...)` untyped.** Matches how `chartJson`, `analysis` and
`extraPlacements` are already declared on `roasts` — no `$type<>()` generic anywhere in
this file.

**Composite uniques use unnamed `unique().on(...)`.** The SQL writes bare
`UNIQUE (user_id, for_date)` and `UNIQUE (user_id, kind, period_start)`, so Postgres
names them `*_key` while Drizzle would emit `*_unique`. The constraint columns and
semantics match exactly; only the generated identifier differs, and nothing in the code
references it by name. Naming them explicitly would have to guess Postgres' own
convention, which is the more surprising option.

**Single-column uniques inline.** `subscriptions.original_txn_id`,
`devices.apns_token`, `users.apple_sub` use `.unique()` on the column, matching
`referralCode` and `sessions.token` in this file.

**Index constants keep the SQL's names verbatim** — `subscriptions_user_idx`,
`subscriptions_status_idx`, `devices_user_idx`, `duos_owner_idx` — passed as the first
argument to `index(...)` exactly as the existing tables do.

**`relations(...)` added for all five tables.** The file already declares relations for
every table it has, so omitting them would be the divergence. `duos` has two FKs to
`users`, so `owner`/`subject` carry `relationName`, mirroring how `connections` handles
its `buyer`/`friend` pair.

**Only two columns added to `users`** — `appleSub` and `onboardedAt`, placed before
`createdAt` so the created-at stays last as it is on every other table. `tz` untouched at
line 27.

**`roastId` on `duos` is nullable with no `.notNull()`** — the SQL writes
`roast_id uuid REFERENCES roasts(id)` with no NOT NULL, because a duo exists before its
roast finishes generating.

**No `onDelete` behaviour anywhere.** The SQL declares plain `REFERENCES` with no
`ON DELETE` clause on any of the nine new foreign keys, so the mirror uses bare
`.references(() => ...)`, matching both the SQL and every existing FK in the file.

## Blockers

None this round.

# Round 4 — `lib/entitlement.ts`

**The rule lives in a db-free module, `lib/entitlement-rule.ts`.** `node --test` runs the
TypeScript directly and cannot resolve the `@/` alias, and `lib/db/index.ts` calls
`neon(process.env.DATABASE_URL!)` at import time, so anything importing the db handle is
untestable without a live connection. The predicate, the status list and the row shape sit
in a module with no imports; `lib/entitlement.ts` imports the status list from it so the
query and the test share one source of truth. No mocking framework was introduced — the
repo has none.

**The predicate is expressed in SQL, not in JS.** `isSubscribed` builds
`and(eq(user_id), inArray(status, SUBSCRIBED_STATUSES), gt(expires_at, now))` with
`.limit(1)` and returns whether a row came back, matching `lib/admin-data.ts`, which also
composes its filters with drizzle operators rather than filtering after the fetch.

**A null `expires_at` is not entitlement.** `expiresAt` is nullable in
`0009_subscriptions.sql`; in SQL `NULL > now()` is NULL, so such a row is already excluded
by `gt`. `isSubscribedRow` returns false for null to match, rather than treating an absent
expiry as "never expires". A subscription with no known expiry is an unverified one.

**`expires_at` strictly greater than now.** Equality fails, per the plan's
`expires_at > now()`.

**`isSubscribedRow` accepts a string timestamp as well as a `Date`.** Neon's HTTP driver
can hand back timestamps as strings depending on the parser in play, and the coercion is
one `new Date(...)`; the alternative is a silent false for a live subscriber.

**`hasActiveSubscription(rows)` exists alongside the single-row predicate** so the no-row
case is expressible in a test and so later callers holding a fetched row set can apply the
same rule without a second query.

**Test file is `test/entitlement.test.ts`**, matching the `<module>.test.ts` naming of
every other file in `test/`, with a fixed `NOW` like `test/admin-stripe.test.ts` does.

Measured: `npm test` 95 tests / 93 pass / 2 fail before, 102 / 100 / 2 after — the two
failures are the same pre-existing file-level throws in `test/chart-annotations.test.ts`
and `test/compute-chart.test.ts`. `npm run lint` exits 0.

## Blockers

None this round.

## Round 5 (account routes: /api/me, /api/me/birth, /api/me/device)

**Route paths are `app/api/me/route.ts`, `app/api/me/birth/route.ts`,
`app/api/me/device/route.ts`.** The App Router paths map one-to-one onto the plan §3
table and match the existing `app/api/<name>/route.ts` layout; nothing in the repo says
otherwise.

**There is no user session helper in the repo, so `lib/session.ts` was written against
the existing `sessions` table** rather than inventing a second identity source.
`lib/admin-auth.ts` is an HMAC cookie for the admin console and authorises no user, and
nothing else reads `sessions`. Transport is `Authorization: Bearer <sessions.token>`,
which is what plan §3 means by "the app stores the token in the Keychain" and matches the
bearer idiom already used by `/api/roast-progress` and `/api/manychat-intake`.

**Pure logic split into `lib/session-token.ts` and `lib/me.ts`**, the same shape as
`lib/entitlement-rule.ts`, so the tests never construct a db client. `lib/me.ts` imports
`./location.ts` with the extension because that is how `lib/location.ts` imports
`./cities.ts` and it keeps the file loadable under `node --test`.

**Unauthorised is `401 {"error":"unauthorized"}`**, following the lowercase snake error
codes in `/api/redeem-code` (`invalid_roast`, `not_found`, `rate_limited`). Missing,
unknown and expired tokens are all the same 401 — an expired session is not a different
fact to a caller.

**`GET /api/me` reads placements off the user's most recent roast**, selecting the
`sun_sign`…`saturn_sign` columns ordered by `created_at desc`. Those are the only stored
placements; recomputing a chart on a launch call would put a runner round-trip in the hot
path. All-null placements collapse to `null` rather than an object of nulls.

**`PUT /api/me/birth` persists only; it does not trigger a natal recompute.** The plan
notes the recompute, but the recompute target (daily transits) does not exist until
Phase 2/3, and the obvious alternative — clearing `roasts.chart_json` — would blank the
wheel on a paid roast. The route resolves the city through `resolveBirthLocation`, the
same helper the web flow uses, so an unknown city stores 0/0/UTC exactly as
`/api/generate` does rather than rejecting the correction.

**`PUT /api/me/device` upserts on `devices.apns_token`**, the table's unique column.
Keying on the token means a reinstall that reuses it updates in place, and a handset
handed to another account reassigns its `user_id` instead of leaving a stale row pushing
to the wrong person. `notify_hour` defaults to 8 when absent, mirroring the schema
default; `devices.tz` is written from the request and never from `users.tz` (Ruling 2).

**Validation is deliberately narrow:** `date` as `YYYY-MM-DD`, `time` as `HH:MM` or
absent, `birthPlace` ≤160 chars (the same cap `/api/generate` uses), APNs token 16–255
chars of `[A-Za-z0-9._-]`, tz ≤64 chars of `[A-Za-z0-9_+-/]`, `notifyHour` an integer
0–23, `build` ≤40 chars.

Measured: `npm run lint` exit 0. `npm test` 102 tests / 100 pass / 2 fail before,
112 / 110 / 2 after — +10 passing, all in `test/me.test.ts` and
`test/session-token.test.ts`; the two failures are the same pre-existing file-level
throws.

## Blockers

None. Not verifiable this round: the handlers were never executed against a database,
because `0009_subscriptions.sql` has not been applied to Neon (a human step) and opening
a live connection is out of bounds. The composed `isSubscribed` query and every new
Drizzle query type-check against the committed schema; runtime behaviour against real
rows is unproven.
