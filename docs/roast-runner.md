# Astro Roast on Codex

The Hermes runner's `/roast`, `/chart-annotations`, and `/dm-agent` endpoints use
Codex CLI with `gpt-6-astra` and **high** reasoning. It authenticates with the
runner service account's ChatGPT login; the cancelled Claude subscription is
no longer used by these endpoints. Existing roast voice and chart calculations
are preserved. The separate metered iOS subscription backend is unchanged.

## Runtime

- Service: `roast-runner`, user `roast`, working directory `/opt/roast-runner`.
- Codex CLI: `@openai/codex@0.153.4`; `codex login status` must succeed as `roast`.
- Auth: `/home/roast/.codex/auth.json`, owner `roast`, mode `0600`. Never commit it.
- Voice: `/home/roast/.agents/skills/astro-roast/SKILL.md` and
  `astro-roast-group/SKILL.md`. `ROAST_SKILLS_DIR` can override that parent directory.
- Calculators: `/home/roast/natal_chart.py`, `/home/roast/synastry_offline.py`,
  and the existing `/opt/roast-runner/venv/bin/python3` environment.
- Model overrides: `ROAST_CODEX_MODEL`, `DM_CODEX_MODEL`, `ANNOTATION_CODEX_MODEL`.
  Old Claude model environment variables do not affect these calls.
- `CODEX_BIN` optionally sets an explicit CLI path.
- Health: `GET /health` returns `provider: "codex"`, `model: "gpt-6-astra"`.

Each invocation has a temporary workspace, ignores user Codex configuration,
and is ephemeral. Prompts go over stdin. The runner reads only the CLI's final
answer file, so progress messages and tool logs cannot contaminate output.
Chart-writing calls have shell and web search; annotation and DM calls have
neither. Child processes do not inherit the service's secret environment.
Timeouts, launch failures and missing/empty final answers fail closed.

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

1. Run `node --test test/codex-runner.test.ts test/chart-annotations-runner.test.ts`,
   `npm test`, and `npm run lint`.
2. Verify the deployed server before copying. Hermes also has live `/enrich-agent`
   and `/transits` endpoints not yet on main. Apply the focused `server.js` diff
   to that deployed file; do not overwrite it with main's older server. Preserve
   the legacy Claude helper used by the separate enrichment endpoint.
3. Back up the live `server.js` before replacing it. Deploy `codex.js` alongside it.
4. Start a temporary systemd service with the same user and environment on port
   8788. Test `/roast` with synthetic birth data and no `roastId`, then verify chart
   markers, parsed prose, group charts and annotation JSON. This does not create
   customer records or send messages.
5. Replace the live server, restart `roast-runner`, check `/health`, and test the
   authenticated endpoints. Stop the temporary service.

Rollback: restore the backed-up server and restart `roast-runner`. Claude calls
will still require a valid Claude subscription; rolling back code cannot restore it.

## Ubuntu 24.04 sandbox setup

Install `bubblewrap`, `apparmor-profiles`, and `apparmor-utils`. Copy
`/usr/share/apparmor/extra-profiles/bwrap-userns-restrict` to
`/etc/apparmor.d/bwrap-userns-restrict`, then load it with
`apparmor_parser -r /etc/apparmor.d/bwrap-userns-restrict`.
This is the [official Codex setup](https://learn.chatgpt.com/docs/sandboxing#prerequisites)
for Ubuntu 24.04; keep the global user-namespace restriction enabled.
Validate as the `roast` user with `bwrap --ro-bind / / --unshare-user -- /bin/echo OK`.
A CLI text response alone does not prove the chart calculator can execute.
The runner checks Sun and Moon degree rows before accepting generated output.

Use a separate device login on Hermes (`runuser -u roast -- codex login --device-auth`).
The initially copied desktop login was revoked; a fresh service-account login
succeeded. Do not routinely overwrite it with desktop credentials.

## Validation on 2026-09-07

- `npm run lint`: passed.
- `node --import tsx --test test/*.test.ts`: all 109 tests passed.
- Plain `npm test`: 99 passed, two existing test-file load failures from
  extensionless imports in `lib/chart-annotations.ts` and `lib/compute-chart.ts`.
  The TypeScript loader resolves those imports; this migration does not change them.
- Authenticated Astra-high annotation and DM endpoint checks passed on the canary.
- Complete canary solo roast: HTTP 200, 1516 prose words, calculated chart, 175s;
  no houses/angles mentioned for unknown birth time.
- Complete canary couple roast: HTTP 200, 1170 words, two calculated charts, 195s.
  Tightened the group output contract afterward to exclude technical calculation
  notes, geocoding and citations from the customer-facing roast prose.
- Production switched to the tested Codex adapter and patched server. Backups:
  `/opt/roast-runner/server.js.pre-codex-20260907` and
  `/opt/roast-runner/chart-annotations.js.pre-codex-20260907`.
- Final public-endpoint couple roast after that prompt change: HTTP 200, 1139
  words, two valid charts, 181s; no technical metadata or source links in prose.
  Public chart-annotation request also returned HTTP 200 in 12s.

## Loading-page status

Codex generation can take longer than three minutes. The browser must keep
polling while the server reports `generating`; elapsed foreground time and
transient network errors must not turn a running job into a failed roast.
`lib/roast-polling.ts` pauses reads in hidden tabs, avoids overlapping requests,
and stops on server-confirmed `ready` or `error`, or component cleanup.
Individual status requests are aborted after 15 seconds and retried; this is
not a generation deadline. Late responses from aborted requests are ignored.
The pipeline failure handler can only change a `generating` roast, so a delivery
failure after saving cannot turn a completed roast into an error page.
Regression coverage: `node --test test/roast-polling.test.ts`.
