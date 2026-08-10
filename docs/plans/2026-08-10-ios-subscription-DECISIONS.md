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
