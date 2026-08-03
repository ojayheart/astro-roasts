# Inngest

Two background functions, both served from `app/api/inngest/route.ts`:

| Function                     | Event            | What it does                                                |
| ---------------------------- | ---------------- | ----------------------------------------------------------- |
| `generate-roast`             | `roast/generate` | Chart + roast via the Hermes runner, then email/DM delivery |
| `generate-chart-annotations` | `roast/annotate` | Witty per-element lines for the interactive natal wheel     |

## Sync after adding or renaming a function

**A Vercel deploy does not register new functions with Inngest Cloud.** Events
for an unregistered function are accepted and silently dropped — no error, no
Sentry issue, no runner traffic. It looks exactly like broken code.

After any deploy that adds, renames, or removes a function:

```bash
curl -X PUT https://astroroast.com/api/inngest
```

`{"modified":true}` means the sync was needed. `{"modified":false}` means it was
already current. Safe to run any time; idempotent.

This cost ~15 minutes of debugging on 3 Aug 2026 when the backfill for
`roast/annotate` sat dead with every event returning HTTP 200.

## Chart annotations are async on purpose

The runner needs ~100s to write all ~59 lines for a full natal chart, so this
cannot live in a request. It used to: `/api/chart-annotations` called the runner
inline, the runner killed `claude -p` at 50s, and every paid roast from 14 Jul
to 3 Aug 2026 got a 500 and facts-only lines.

Chunking does not fix it. The Claude subscription **serializes concurrent
`claude -p` calls** — three chunks fired at once finished at 47s, 61s, and 85s,
stacked rather than overlapping. The runner still chunks (20 elements each), but
for line quality and blast radius, not speed: a chunk that dies costs its own
elements instead of all 59. `generate-chart-annotations` runs at
`concurrency: { limit: 1 }` for the same reason — parallel runs would time each
other out and starve the roast pipeline.

`queueChartAnnotationsIfReady()` is the only trigger, called from the pipeline
and from every path that flips `paid`. It re-checks all gates, so double-sends
are free. `/api/chart-annotations` only reads the cache and falls back to
deterministic facts, so the wheel is always interactive and upgrades on the next
load once the lines land.
