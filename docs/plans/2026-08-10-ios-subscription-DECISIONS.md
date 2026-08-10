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

## Round 6 (Phase 2: ops/hermes-roast-runner/transits.py)

**Both home-directory sources were present and read in full** —
`~/transits_offline_meaningful.py` (340 lines) and `~/transits_offline_calendar.py`
(467 lines). Neither was edited. `~/natal_chart.py` (the real path behind
`NATAL_CHART_PATH`, `server.js:22`) was read for the argument convention.

**Argument convention copied from `natal_chart.py` as invoked at `server.js:330-352`:**
`PYTHON_BIN <script> --json --name --year --month --day [--hour --minute] --lat --lon
--tz`, every value a separate argv entry, one JSON object on stdout. `transits.py` takes
exactly those natal flags plus `--hsys`, so the runner can build the argv the same way.

**The period is a separate flag set, because `--year`/`--month` are already the natal
year and month.** `--mode daily --date YYYY-MM-DD`; `--mode month --target-year
--target-month`; `--mode year --start YYYY-MM-DD`. Renaming the natal flags to match the
calendar script's `--natal-*` style would have broken symmetry with `natal_chart.py`,
which is the convention Ruling 4 points at.

**Natal input is per invocation.** `natal_points(chart)` takes a dict; the module-level
`NATAL` dict from the meaningful script is gone. `normalize_chart` coerces types so the
Python entry points accept the same loose JSON shape the runner already validates.

**Every invocation prints one top-level JSON object**, never the bare array both sources
printed. `daily` returns `{mode,name,date,tz,has_birth_time,natal,transits[]}`;
`month`/`year` return the same envelope with `start`,`end`,`events[]`. Failures print
`{"error":"transits_failed","detail":...}` on stdout and exit 1, so the runner's
`code !== 0` branch and its `JSON.parse` both stay valid.

**No angles without a birth time.** `Ascendant`/`Medium_Coeli` are omitted from `natal`
and from every target list when `--hour` is absent — the same rule the runner's own
prompt states at `server.js:142`. Noon is used for the planet positions in that case.

**Orb thresholds split by mode.** The calendar path keeps the source defaults (base 1.5,
Jupiter 2.0, soft 1.5). The daily path widens to base 3.0 / Moon 6.0, because the source
defaults were tuned for multi-month scans and would return an empty day most days.

**Transiter defaults split too:** daily scans all ten majors including the Moon; month
and year scan Jupiter/Saturn/Uranus/Neptune/Pluto only. Chiron is dropped from every
default because it needs external `.se1` files; it is still selectable via
`--transiters`, and `usable_transiters` probes each body once and skips what the
installed ephemeris cannot compute.

**Longitudes are cached per timestep instead of recomputed per aspect pair.** The
calendar source called `swe.calc_ut` inside the innermost aspect loop; sampling each
transiter once per step and doing the orb arithmetic on the cached list is the same maths
and turns a full year into ~1.2s. Bisection and peak refinement still call the ephemeris
directly, since those are off-grid times.

**Year is twelve months from `--start`, not a calendar year**, matching the plan's
rolling forecast, and samples at 12h rather than 6h — only slow bodies transit there.

**Offline:** `swe.set_ephe_path(os.getenv("SWEPHE_PATH",""))` and a
`FLG_SWIEPH → FLG_MOSEPH` fallback, exactly as the calendar source did. No network call
exists in the file.

**Tests are `test/transits.test.ts`**, node:test in the repository idiom, spawning
`process.env.ASTRO_PYTHON || "python3"` against the real script and asserting on a fixed
Wellington 1994-01-21 13:00 chart: natal Sun 300.715567° and Ascendant 19.62016°, the
Mars-trine-natal-Saturn hit on 2026-08-10 under 0.01° orb, Pluto conjunct natal Venus
inside 2026, ordering, peak-inside-interval, the no-birth-time rule, and that stdout is a
single object in both the success and failure paths. The whole file skips if `swisseph`
is not importable, so the suite stays green on a machine without it.

Measured: `npm run lint` exit 0 before and after. `npm test` 112 tests / 110 pass / 2
fail before, 117 / 115 / 2 after — +5 passing, all in `test/transits.test.ts`; the two
failures are the same pre-existing file-level throws.

## Blockers

None. Still deferred: the chart recompute on `PUT /api/me/birth` (round 5). Not verified
this round: nothing runs `transits.py` yet — wiring it into `server.js` belongs to
Phase 3, which is explicitly out of this round's scope.

## Round 7 (Phase 3, part 1: lib/roast-model.ts)

**Exported surface is four verbs plus three pure builders.** `complete(req, deps)` for the
latency-bound daily path, `submitBatch(items, deps)` / `batchStatus(id, deps)` /
`collectBatch(id, deps)` for monthly and yearly, and `resolveModel`, `providerFor`,
`buildVoiceBlock`, `buildAnthropicBody`, `buildOpenAIBody` exported so the request shape is
testable without a client at all. One module, one entry point per workload — no second
client bolted alongside it.

**Provider selection is `model.startsWith("claude-")`**, exactly as plan §7 words it, and
the model resolves `req.model → process.env.ROAST_MODEL → "claude-opus-5"`. §7's default
governs over §4's "Sonnet 5". A per-request model override exists because the bake-off in
§7 needs to run the same prompt through three models without touching the environment.

**Keys are read at call time, never at import.** `ANTHROPIC_API_KEY` and
`OPENROUTER_API_KEY` come from `process.env` inside the call and throw a named error when
absent; nothing is hardcoded and no key is logged. `OPENROUTER_BASE_URL` is overridable so
Kimi and Qwen can be routed to their native APIs (the §7 caveat about OpenRouter credit)
without a code change.

**The Anthropic SDK is a dynamic import.** `await import("@anthropic-ai/sdk")` inside
`anthropicClient` means the tests, which always inject a fake, never load the SDK and can
never open a socket.

**Fakes are injected through a `deps` argument, not module mocking.** `deps.anthropic`
takes an `AnthropicLike` — the four SDK methods this module actually calls, typed
structurally — and `deps.fetch` takes a `fetch` shape for the OpenRouter path. Both default
to the real thing, so production call sites pass nothing.

**The voice block is imported, never re-typed.** `buildVoiceBlock` returns
`ROAST_SYSTEM_PROMPT`, or `ROAST_SYSTEM_PROMPT_NO_BIRTHTIME` when `hasBirthTime: false`,
optionally with a `VOICE_PRESETS[preset]` section appended — all three come from
`lib/roast-prompt.ts` and `inngest/prompts.ts`. A test asserts identity against those
constants, so re-authoring the voice fails the suite.

**Cache control sits on the voice block alone.** Both bodies put the voice first with
`cache_control: {type: "ephemeral"}` and any per-request system text second and uncached —
the shared prefix is the only stable ~2k tokens, and marking the variable half would make
the prefix unstable and defeat the cache.

**Batch results key back by `custom_id` supplied by the caller** (`monthly:<userId>:<ym>`
in the intended usage), returned as a `{customId, text}` / `{customId, error}` list.
Anthropic does not guarantee result order, so nothing in this module relies on it, and a
per-item error becomes a value rather than throwing away the whole batch.

**A non-Anthropic `ROAST_MODEL` makes `submitBatch` throw.** OpenRouter has no batch
surface; failing loudly is better than silently issuing 1,000 serial calls at full price
while the caller believes it batched. The caller decides whether to fall back to `complete`.

**Relative `.ts` imports, not the `@/` alias**, because `npm test` is bare `node --test` and
cannot resolve the alias. `lib/location.ts`, `lib/me.ts` and `lib/admin-stripe.ts` already
import this way, so it is the existing idiom for a lib module that has to be unit-testable.

Measured: `npx tsc --noEmit --incremental false` exit 0. `npm test` 117 tests / 115 pass /
2 fail before, 131 / 129 / 2 after — +14 passing, all in `test/roast-model.test.ts`; the
two failures are the same pre-existing file-level throws.

## Blockers

None. Not done this round, by scope: no call site was changed — the `claude` CLI spawn at
`ops/hermes-roast-runner/server.js:188` still stands, the Inngest functions are untouched,
and no plan §3 route was created. Not verified: the module has never made a live provider
call, so request shapes are checked against the documented SDK surface and injected fakes
only. Still deferred: the chart recompute on `PUT /api/me/birth` (round 5).

---

# Round 8 — generation off the CLI, transits wired in

**Daily and forecast generation live Next-side, not in the runner.** Plan §4 puts the
three jobs on Inngest, and `lib/roast-model.ts` is a TypeScript module the plain-JS runner
cannot import. Rather than bolt a TS bridge (tsx/esbuild) onto `server.js`, the runner
keeps only what needs the VM's Swiss Ephemeris venv — a deterministic `POST /transits` —
and `lib/subscription-roast.ts` does the writing through `complete()` / `submitBatch()`.
No new bridge, no second completion client.

**The `claude` CLI spawn stays for the existing one-off web `/roast` (solo and group).**
Plan §4: "One-off web roasts can stay on the runner if you want; the subscription path
cannot." That path is agentic — Skill, Bash, WebSearch — and rewriting it would mean
rebuilding the natal/synastry pipeline and breaking `mode:"group"`, which this round is
explicitly barred from touching. No daily or forecast generation touches it.

**`POST /transits` mirrors `POST /chart`.** Same `validateChartInput`, same birth argument
convention lifted into `birthArgs()`, same spawn/parse path lifted into `runPythonJson()`,
so `natal_chart.py` and `transits.py` are invoked identically. Period arguments are
validated per mode (`--date`, `--target-year`/`--target-month`, `--start`). Timeouts: 30s
daily and month, 120s year — the year mode scans twelve months at a 12-hour step.

**`lib/transits.ts` takes a resolved `BirthInput`, not a `ChartSubject`.** `lib/compute-chart.ts`
imports `./location` without a file extension, which Node's type stripping cannot resolve,
so anything importing it is unusable under `node --test` — that is the standing failure in
`test/compute-chart.test.ts`, which this run must not repair. Keeping `transits.ts` and
`subscription-roast.ts` free of that import makes them unit-testable; `lib/birth-input.ts`
is the thin Next-side adapter that turns a stored subject into `BirthInput`.

**Output contract is labelled sections, not JSON.** `TITLE` / `GOLD` / `BODY` for daily and
`TITLE` / `HIGHLIGHTS` / `AVOID` / `BODY` for forecasts, mapping one-to-one onto the
`daily_roasts` and `forecasts` columns. Asking for prose inside a JSON string degrades the
voice; the runner already uses marker sections for the same reason.

**Constraint 13, both fixed rather than recorded.** `OPENROUTER_BASE_URL` is now read per
call via `openRouterBaseUrl()` instead of at module import, and an unknown `voicePreset`
falls back to `VOICE_PRESETS["cold-literary"]`, matching `inngest/prompts.ts:189`. An
absent preset still yields the base voice with no preset section.

**`ops/hermes-roast-runner/server.js` had to be committed despite being operator WIP.**
Its pre-existing uncommitted change is a whitespace-only prettier reformat: `git diff -w`
against HEAD shows no non-whitespace removal outside the functions this round rewrote
(`validateChartInput`'s wrapping, `handleChart`). The reformat is carried into the commit
verbatim; no operator edit is reverted, and no other WIP file is touched.

Measured: `npx tsc --noEmit --incremental false` exit 0 before and after. `npm test`
131 tests / 129 pass / 2 fail before, 141 / 139 / 2 after — +10 passing, all in
`test/subscription-roast.test.ts`; `swisseph` was importable in both runs and the two
failures are the same pre-existing file-level throws.

## Blockers

None. Not done this round, by scope: the plan §3 routes (`/api/daily`, `/api/forecast`,
`/api/duo`, `/api/duo/:id`, `/api/account`) and the Inngest hourly/monthly/yearly functions.
Not verified: no live provider call has ever been made — provider behaviour is checked
against injected fakes only. Verified live: the runner's `/transits` endpoint against the
real `transits.py` and a real chart. Still deferred: the chart recompute on
`PUT /api/me/birth` (round 5).

## Round 9 (Phase 4, part 1: GET /api/daily and GET /api/forecast)

**The gating and cache-or-generate flow lives in `lib/subscription-api.ts`, not the route
files.** Same split as `lib/me.ts`: the module never imports the db client, so the tests
exercise auth, the paywall, a cache hit and a cache miss against injected ports without
Neon and without a network call. The route files supply the real ports — `sessionUserId`,
`isSubscribed`, Drizzle reads and writes, and `generateDaily` / `generateForecast`.

**Unsubscribed is `402 subscription_required`, not 403.** The paywall is exactly what 402
means, and it gives the handset one status to branch on that is distinct from "your token
expired" (401) and from a route the user may not touch at all. The `/api/me*` handlers had
no precedent because none of them is gated.

**Unauthenticated is checked before the subscription and before any read.** A missing
session never touches `subscriptions` or `daily_roasts`; the tests assert this by throwing
from the ports that must not run.

**`?date=` is optional and resolves to the user's own calendar day.** `users.tz` through
`Intl.DateTimeFormat("en-CA")`, which yields `YYYY-MM-DD` directly. An unparseable tz falls
back to the UTC date rather than failing the request. Note this is the account timezone, not
`devices.tz` — the handset's timezone drives the push, the account's drives which day a
history request means.

**A malformed `?date=` is `400 invalid_date`, mirroring `/api/me/birth`'s `invalid_birth`.**
No date is not malformed; an absent parameter means today.

**`/api/forecast` accepts `?kind=year&period=YYYY` as well as the plan's `YYYY-MM`.** A year
window is twelve months from the start month, so `2026-03` gives `2026-03-01..2027-02-28`
and `2026` gives the calendar year. `kind` defaults to `month`; an unknown kind is
`400 invalid_period`. An absent `period` falls back to the user's current month.

**A missing row generates inline and persists before replying.** The unique constraints
(`user_id, for_date` and `user_id, kind, period_start`) are the idempotency guard, so both
writes are `onConflictDoUpdate` on that constraint — a concurrent cron write and a user
request converge on one row instead of erroring. Rows are written `status: "ready"`; the
schema default `generating` stays for rows the Inngest jobs open ahead of time.

**Generation that cannot run is `503 unavailable`.** `generateDaily` returns null when the
runner is unconfigured or `transits.py` fails; replying 503 keeps an empty roast out of the
table. Nothing is persisted in that branch.

**No voice preset is passed.** `users` has no preset column, so both routes take
`lib/roast-model.ts`'s base voice. Wiring a per-user preset is a schema change and out of
scope for this round.

Measured: `npx tsc --noEmit --incremental false` exit 0 before and after. `npm test`
141 tests / 139 pass / 2 fail before, 154 / 152 / 2 after — +13 passing, all in
`test/subscription-api.test.ts`; `swisseph` importable in both runs, and the two failures
are the same pre-existing file-level throws. `npx next build` registers both routes as
dynamic server routes (`ƒ /api/daily`, `ƒ /api/forecast`).

## Blockers

None. Not done this round, by scope: `/api/duo`, `/api/duo/:id`, `DELETE /api/account`, and
the Inngest hourly/monthly/yearly functions. Not verified: no live provider call and no live
database read — the routes' Drizzle queries type-check and build, but they have not been run
against Neon. Still deferred: the chart recompute on `PUT /api/me/birth` (round 5).
Constraint 15 (`server.js:16`'s `claude-opus-4-8` default) is still open and belongs to
whichever round revisits the runner.

## Round 10 (`/api/duo`, `/api/duo/:id`, `DELETE /api/account`)

**All three duo entry points are gated on `isSubscribed`, reads included.** Plan §3 only
annotates `/api/daily` with "gated to subscribers", but duos are a v1 subscription feature
and `lib/entitlement.ts` is the single authorisation source. Gating the reads as well as the
create keeps the surface consistent with `/api/daily` and `/api/forecast`: a lapsed
subscriber gets `402 subscription_required` rather than a silently degraded library. If the
app later wants a lapsed user to still see what they paid to generate, that is a one-line
change in `serveDuoList`/`serveDuo`.

**`DELETE /api/account` is auth-only, never entitlement-gated.** App Review requires the
in-app deletion path to work for anyone with an account, subscribed or not.

**A duo is the existing group path with a two-person cast.** `parseDuoRequest` builds the
partner from `{name, dob|date, birthTime|time, birthPlace|birthCity}` and hands
`["couple", [owner, partner]]` straight to `validateGroupRequest` from `lib/group.ts`;
`normalizeRelationship` supplies the relationship. The route inserts a `roasts` row with
`kind: "couple"`, the two `roast_subjects` rows, then sends `roast/generate` with
`people` — which `inngest/pipeline.ts:162` turns into `buildGroupRunnerPayload` and the
runner's `mode:"group"`. No synastry maths and no prompt text were written this round.

**Missing `gender` defaults to `"unspecified"`.** Plan §3's duo payload is
`(name, dob, birth place, relationship)` — no gender — but `validPerson` in `lib/group.ts`
requires a non-empty gender and the runner payload carries it. Defaulting keeps the plan's
field list sufficient without loosening the shared validator. The owner's own gender comes
from `users.gender`, with the same default when null.

**The partner becomes a real `users` row.** `duos.subject_id` is `NOT NULL REFERENCES
users(id)` (migration 0009), so there is no way to store a partner as loose JSON. The row is
created exactly the way `app/api/generate/route.ts` creates persons 2..N of a group roast:
no email, `lat/lon = 0`, `tz = "UTC"`, a random referral code.

**`POST /api/duo` replies `201` with the duo, not a bare job id.** Plan §3 says "→ job id";
the duo id _is_ the job handle, and the row it comes back in is the same shape
`GET /api/duo/:id` returns, so the client has one model instead of two. `201` because a row
was created; every other duo reply is `200`.

**In-flight duos use the daily/forecast convention exactly (constraint 16).** A duo whose
roast is not `ready` returns `200` with `status` from the roast row and `title`, `goldLine`
and `body` null — the same 200-with-null-content contract `/api/daily` and `/api/forecast`
use for a `generating` row. The client polls. No third shape was invented.

**`pass()` and an `Auth` type are now exported from `lib/subscription-api.ts`.** The duo
routes need the 401/402 gate but not the daily/forecast `subject` lookup, so `Gate` was split
into `Auth` (`userId` + `subscribed`) and `Gate = Auth & { subject }`. Reusing the round-9
plumbing rather than re-authoring the gate. No behaviour changed for daily or forecast.

**Account deletion is a hard delete in FK order, scoped by `PURGE_ORDER`.** The migration
declares no `ON DELETE CASCADE`, so the order is the contract: `referrals`, `duos`,
`roast_subjects`, `connections`, `daily_roasts`, `forecasts`, `devices`, `subscriptions`,
`sessions`, `magic_links`, `roasts`, `users`. Everything referencing `roasts(id)`
(`roast_subjects`, `connections`, `duos`) goes before `roasts`; everything referencing
`users(id)` goes before `users`. The order is pinned by a unit test, not by comment.

**`referrals` is an update, not a delete.** `users.referred_by` points at the account being
removed from _other people's_ rows, so it is set to null first. Deleting those referred users
would delete strangers' accounts.

**The cascade also takes duo placeholder users, and only those.** `subjectIds` selects
subjects of the caller's duos whose `users.email IS NULL` — the rows this API invented and
nobody can log into. A subject with an email is somebody's real account and is left alone,
so the duo row goes but the person stays. Roasts owned by the caller take their
`roast_subjects` and `connections` with them even when a co-subject is a stranger.

**`magic_links` is keyed by email, not user id.** The purge reads the emails of the ids being
deleted first, then deletes the links. Nothing else in the schema is email-keyed.

**Reply is `200 {deleted: true, rows: {...counts}}`.** Counts come from `.returning()` row
lengths, so the response reports what actually went, which is the only cheap evidence a
client or an operator gets that the cascade reached every table.

**Constraint 15 stays open and is recorded, not chased.** `ops/hermes-roast-runner/server.js:16`
still defaults `ROAST_MODEL` to `claude-opus-4-8` for the runner's own CLI path, while
`lib/roast-model.ts` defaults to `claude-opus-5` per plan §7. They are two different
processes reading the same env var name; in deployment the var is set explicitly. Changing
the runner default is a runner change and was out of this round's scope.

**Constraint 13 stays as recorded in round 7.** `lib/roast-model.ts` reads
`OPENROUTER_BASE_URL` at module import and `buildVoiceBlock` falls back the way round 7
documented. Nothing in this round touches that file.

Measured: `npx tsc --noEmit --incremental false` exit 0 before and after. `npm test`
154 tests / 152 pass / 2 fail before, 166 / 164 / 2 after — +12 passing, all in
`test/duo-api.test.ts` and `test/account-api.test.ts`; `swisseph` importable in both runs,
and the two failures are the same pre-existing file-level throws at
`test/chart-annotations.test.ts:1:1` and `test/compute-chart.test.ts:1:1`.

## Blockers (round 10)

None. Not done this round, by scope: the Inngest hourly daily fan-out, the monthly job and
the yearly job. Not verified: no live database read or write has happened — the duo and
account queries type-check but have never run against Neon, so the cascade's real row counts
and the `alias()` joins are unproven at runtime; no live provider call has been made; the
group generation path was not run end to end. Still deferred: the chart recompute on
`PUT /api/me/birth` (round 5).

## Round 11 — the three scheduled jobs, and constraint 17

**The fan-out is two functions, not one.** `daily-roast-fan-out` runs on `cron 0 * * * *`,
selects the cohort and sends one `daily/generate` event per user; `generate-daily-roast`
consumes those. That is Inngest's own fan-out idiom and it buys per-user retry — a single
user whose city fails to geocode does not fail the hour for everyone else. Both are
registered on `app/api/inngest/route.ts`, the repo's only serve handler, alongside
`generate-roast` and `generate-chart-annotations`, on the same client from `inngest/client.ts`.

**The notify hour comes from `devices`, per Ruling 2.** `notifyDevices()` reads every
handset row and `dueDevices()` compares `notify_hour` against the handset's local hour
computed with `Intl.DateTimeFormat(..., { hourCycle: "h23" })`. It is not a SQL predicate
because offsets are not whole hours — Kathmandu is +5:45, Chatham +12:45 — so "which
notify_hour is due at 20:00 UTC" is nearly the whole 0–23 range and the filter would not
narrow anything. Comparing in JS is one small read per hour and is exact for half-hour and
quarter-hour zones. If the device table outgrows a single read, the fix is a paged select,
not a smarter predicate.

**One push per account.** Two handsets on the same user due in the same hour dedupe to one
cohort entry, and the roast date is `localDate(device.tz)` — the handset's calendar day, not
UTC's. An unresolvable timezone yields `null` and the device is skipped rather than pushed at
the wrong hour.

**Entitlement is checked twice.** Once when the cohort is built and again inside
`generate-daily-roast`, both through `isSubscribed`. The cron can fire twice and a
subscription can lapse between selection and generation. The per-user function also skips
when a `ready` row already exists for that date, so a double fire costs a read, not a
completion.

**Monthly and yearly are one factory, two crons.** `forecastBatchJob(id, cron, periodFor)`
builds both, so `0 2 1 * *` (monthly, per plan §4) and `0 3 1 1 *` (yearly, 1 January) share
one body. Each builds its cohort from `activeSubscribers()`, submits through
`submitForecastBatch` → `lib/roast-model.ts`'s Batch API path, polls `batchStatus` on a
`step.sleep("10m")` loop capped at 24 polls, then writes rows via `applyForecastResults`.
`custom_id` is the user id, so results key back by identity and never by list order.

**Per-user yearly anniversaries are not built.** Plan §4 says "1 Jan + per-user
anniversary". Only the 1 January cron exists. The anniversary variant needs a second cohort
rule (birthday-relative windows) and a `forecasts` key that is not the calendar year, which
is a schema question this migration did not answer. Recorded as deferred, not dropped.

**`lib/subscription-store.ts` is new, and the two routes now use it.** The daily and forecast
upserts existed only inline in `app/api/daily/route.ts` and `app/api/forecast/route.ts`. The
jobs need the same writes, and two copies of an `onConflictDoUpdate` against the same unique
key is exactly the divergence the plan's idempotency guard is meant to prevent. The routes
were refactored onto it rather than the job duplicating them; behaviour and response shapes
are unchanged, `next build` compiles both routes.

**Constraint 17a — the purge cannot be a transaction here.** `lib/db.ts` builds the client
with `drizzle-orm/neon-http`, and that driver's session throws
`No transactions support in neon-http driver` (node_modules/drizzle-orm/neon-http/session.js:152).
`db.transaction` is therefore not available without swapping the driver, which is a
deployment-wide change well outside this task. Instead the ordering was made recoverable:
`roasts` moved earlier and `magic_links`/`sessions` moved to the last two steps before
`users`. Every step is idempotent, so the consequence of a mid-sequence failure is a
partially purged account whose owner still holds a valid session and can simply call
`DELETE /api/account` again; only a failure inside the final `sessions`/`users` pair needs an
operator, and at that point everything else is already gone. `test/account-api.test.ts`
asserts that ordering.

**Constraint 17b — the duo handoff is normalised now, not recorded.** `parseDuoRequest` runs
`normalizeBirthLocation` over each person's `birthPlace`, the same normalisation
`app/api/generate/route.ts:156` applies before it writes users and dispatches to Inngest.

**Constraint 13 is closed on the second half.** `buildVoiceBlock` already falls back to
`VOICE_PRESETS["cold-literary"]` for an unknown preset, matching `inngest/prompts.ts:189`.
`OPENROUTER_BASE_URL` is read inside `openRouterBaseUrl()` — per call, not at module import —
in the file as it stands today (`lib/roast-model.ts:19-21`). Nothing left open there.

Measured: `npm run lint` exit 0 before and after. `npm test` 166 tests / 164 pass / 2 fail
before, 183 / 181 / 2 after — +17 passing in `test/daily-schedule.test.ts`,
`test/forecast-jobs.test.ts` and one added case in `test/account-api.test.ts`; `swisseph`
importable in both runs (the 1.16 s `year` transit case ran), and the two failures are the
same pre-existing file-level throws at `test/chart-annotations.test.ts:1:1` and
`test/compute-chart.test.ts:1:1`. `npx next build` compiled cleanly.

## Blockers (round 11)

None. Not verified: no live database read or write has happened, so `notifyDevices`,
`activeSubscribers` and both upserts are type-checked and build-compiled but never executed
against Neon; no live provider call has been made, so the Batch submit/poll/collect loop is
exercised only against injected fakes in `test/roast-model.test.ts`; APNs push is out of
scope for phases 1–4 and the fan-out stops at writing `daily_roasts`. Still deferred: the
chart recompute on `PUT /api/me/birth` (round 5), and the per-user yearly anniversary run.
Still recorded-not-fixed: constraint 15 (`server.js:16` defaults `ROAST_MODEL` to
`claude-opus-4-8` for the runner's own CLI path).

## Round 12 — the forecast re-bill guard

**The unique constraint was never a guard.** `saveForecast`
(`lib/subscription-store.ts`) is an `onConflictDoUpdate` on
`(user_id, kind, period_start)`, so a replayed cron does not hit a rejection — it overwrites
the row it already paid for, silently. The same is true of `saveDaily`. Any guard therefore
has to be a read, and it has to run before the batch is assembled: in
`inngest/subscription.ts` the `build-jobs` step precedes `submit-batch`, and `submit-batch`
is where the money goes.

**Port shape: `served: (period) => Promise<string[]>`, one call per cohort.** The alternative
was a per-user `isServed(userId, period)` in the same style as the existing `transits` port,
but that is one query per subscriber for a check that a single indexed read answers for the
whole cohort. `buildForecastJobs` turns the list into a `Set` and skips before it asks for
transits, so a served user costs neither a transit computation nor a batch item. The DB half
is `servedForecastUsers` in `lib/subscription-store.ts`, which keeps the builder free of the
db client exactly as `subscribers` and `transits` already do.

**Status set: `ready` and `generating`, named once in `lib/subscription-api.ts`.**
`SERVED_STATUSES` and `alreadyServed()` live next to the other shared daily/forecast pure
helpers, and both the batch guard and the daily job read them. `error` is deliberately not in
the set — a failed generation should be retried on the next run, and it was never delivered.
The daily path previously compared `existing?.status === "ready"` only, so a job replayed
while a generation was still in flight paid twice; it now uses the same predicate.

**The daily job moved into `lib/daily-schedule.ts` as `runDailyJob`.** It was an inline
closure inside `step.run` in `inngest/subscription.ts`, which cannot be tested without the db
client. It is now a ports-injected function beside `dailyCohort`, in the same db-free style,
and the Inngest handler supplies the real ports. Return payloads are byte-identical to before
(`{userId, skipped}` / `{userId, date, status}`), so nothing downstream of the step changes.

**No SQL.** `servedForecastUsers` is a plain select over the existing `forecasts` table on
`(kind, period_start, status)`. `drizzle/0010_*` is still free.

Measured: `npm run lint` exit 0. `npm test` 183 tests / 181 pass / 2 fail before,
191 / 189 / 2 after — +8 in `test/forecast-jobs.test.ts` and `test/daily-schedule.test.ts`,
0 skipped, and the two failures are the same pre-existing file-level throws at
`test/chart-annotations.test.ts:1:1` and `test/compute-chart.test.ts:1:1`.

Not verified: no live Neon read, so `servedForecastUsers` is type-checked and covered only
by the in-memory equivalent of its filter in `test/forecast-jobs.test.ts`, never executed
against the real table.
