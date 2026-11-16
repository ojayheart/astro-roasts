# Astro Roast on Claude (Fable 5.2)

The Hermes runner's `/roast`, `/chart-annotations`, and `/dm-agent` endpoints use
the Claude Code CLI (`claude -p`) with `claude-fable-5-2`. It authenticates with
the runner service account's Claude subscription login (OAuth), not an API key.
The roast writer runs at medium effort (`ROAST_CLAUDE_EFFORT` overrides it); DM
replies and chart annotations run at low effort. Roast voice and chart calculations are unchanged. `/enrich-agent`
(a second tenant) shares the adapter and keeps its own model setting.

History: the runner used Codex `gpt-6-astra` from 2026-09-07. Its ChatGPT login
expired and every roast failed from 2026-10-23 until the 2026-11-14 switch.

## Runtime

- Service: `roast-runner`, user `roast`, working directory `/opt/roast-runner`.
- Claude CLI: `@anthropic-ai/claude-code` 2.1.325 or newer (Fable 5.2 needs it).
- Auth: `runuser -u roast -- claude auth login --claudeai` on Hermes. The login is
  stored in `/home/roast/.claude/` and refreshes itself. Check it with
  `claude auth status`. Do not set `CLAUDE_CODE_OAUTH_TOKEN` in
  `/opt/roast-runner/.env`: a stale value overrides the login.
- Voice: `/home/roast/.agents/skills/astro-roast/SKILL.md` and
  `astro-roast-group/SKILL.md`. `ROAST_SKILLS_DIR` can override that parent directory.
- Calculators: `/home/roast/natal_chart.py`, `/home/roast/synastry_offline.py`,
  and the existing `/opt/roast-runner/venv/bin/python3` environment.
- Model overrides: `ROAST_CLAUDE_MODEL`, `DM_CLAUDE_MODEL`, `ANNOTATION_CLAUDE_MODEL`.
  The old `ROAST_MODEL` and `*_CODEX_MODEL` variables do not affect these calls.
- `CLAUDE_BIN` optionally sets an explicit CLI path.
- Health: `GET /health` returns `provider: "claude"`, `model: "claude-fable-5-2"`.

Each invocation has a temporary workspace, ignores host settings, memory files,
skills and MCP servers, and keeps no session. Prompts go over stdin. The runner
reads only the final `result` of the CLI's JSON output, so tool logs cannot
contaminate a roast. The roast writer has `Bash` and `WebSearch` only on the
tool path (see Time to delivery); on the precalculated path, and for annotation, DM
and enrichment calls have no tools at all (`--tools ""`). Child processes do not
inherit the service's secret environment. There is no OS sandbox around the
writer's shell (Codex had one): it runs as the unprivileged `roast` user.
Timeouts, launch failures, error results and empty answers fail closed.

## Time to delivery (2026-11-16)

The model's thinking and writing time is most of a roast. Two changes cut it:

- **Precalculated charts.** When the request carries a resolved birthplace
  (`coords`, or `evidence.birth` for a known birth time), the runner runs
  `natal_chart.py` and `synastry_offline.py` itself and puts the output in the
  prompt. The writer then has no tools, makes no lookup turns and does not copy
  the chart back out. The web pipeline resolves the place in its
  `resolve-birthplaces` step. If a place cannot be resolved, or a calculator
  fails, the old tool path runs (`Bash`, `WebSearch`). The response field
  `fastPath` says which path ran.
- **Medium effort.** Same voice and length at about 60% of the time.

Measured on Hermes, same synthetic people:

| Roast | Before | After |
|---|---|---|
| Solo, birth time known | 109 s | 49 s |
| Solo, no birth time | — | 66 s |
| Couple | 118 s | 50 s |
| Solo, tool path (no resolved place) | 109 s | 68 s |

To return to high effort, set `ROAST_CLAUDE_EFFORT=high` in
`/opt/roast-runner/.env` and restart the service.

## Verify and deploy

### Blended roast evidence (2026-09-14)

New solo and group jobs calculate Human Design before the writer runs:
`lib/roast-evidence.ts` resolves the natal birth instant through `/chart`, then
uses the same HD engine as the interactive chart. Evidence travels with each
person, including resolved coordinates/timezone and all HD activations. Inngest
caches this step across writer retries. Unknown birth times omit HD; failed
known-time calculations retry instead of silently dropping the second system.

`ops/hermes-roast-runner/roast-evidence.js` adds the current product writing policy
after the voice skill: synthesize behavioural tensions, keep technical mechanics
in raw chart blocks, and default to no system terminology in the roast. Group
roasts retain each person's evidence and the existing synastry calculation.
Deploy this module alongside the focused server import/system-prompt change
before deploying the web pipeline. Older callers without evidence get the new
writing direction with astrology only. Existing saved roasts are not rewritten.

Validation: deterministic Wellington sample resolves to 1994-01-21T00:00Z and
the expected Manifesting Generator / 5/1 chart. Unit and HTTP integration tests
verify evidence transport, group ordering, unknown-time handling and the output
envelope. The initial 2026-09-14 solo/group live-model canaries stopped before
writing with `codex_authentication_failed: sign in again on Hermes`. At Oliver's
explicit request, the current desktop ChatGPT CLI login was transferred privately
to the roast account after backing up its auth file; owner/mode remain roast/0600.
Both production samples then returned HTTP 200 (solo 162s, group 169s), with
calculated charts and no system jargon in the prose. The solo sample exposed a
skill-template conflict; the writing policy now explicitly forbids internal
TITLE/TEASER/FULL/CALLOUTS fields inside the roast markers.
The final production solo check passed in 162s: 1,548 words, valid calculated
chart, no internal fields and no system jargon. The authentication blocker is
resolved. These synthetic checks used no roast ID and sent no customer messages.

### Deployment checks

1. Run `npm test` and `npm run lint`.
2. `ops/hermes-roast-runner/` is the source of truth and matches the deployed
   server as of 2026-11-14 (including `/enrich-agent` and `/transits`). Diff the
   live files against the repo before copying, in case of a VM-only patch.
3. Back up the live `server.js`, then copy `server.js`, `claude.js`,
   `chart-annotations.js`, `roast-evidence.js` and `enrich-agent.js`.
4. Start a temporary instance as `roast` with the same environment on port 8788.
   Test `/roast` with synthetic birth data and no `roastId`, then verify chart
   markers and prose. This creates no customer records and sends no messages.
5. Restart `roast-runner`, check `/health`, and test the authenticated endpoints.

Rollback: restore the backed-up server and restart `roast-runner`. The Codex
adapter is in git history (`ops/hermes-roast-runner/codex.js` before this change)
and needs a fresh `codex login --device-auth` as `roast`.

## Loading-page status

Generation can take several minutes. The browser must keep
polling while the server reports `generating`; elapsed foreground time and
transient network errors must not turn a running job into a failed roast.
`lib/roast-polling.ts` pauses reads in hidden tabs, avoids overlapping requests,
and stops on server-confirmed `ready` or `error`, or component cleanup.
Individual status requests are aborted after 15 seconds and retried; this is
not a generation deadline. Late responses from aborted requests are ignored.
The pipeline failure handler can only change a `generating` roast, so a delivery
failure after saving cannot turn a completed roast into an error page.
Regression coverage: `node --test test/roast-polling.test.ts`.
