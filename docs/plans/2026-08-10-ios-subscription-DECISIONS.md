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

## Blockers

None this round.
