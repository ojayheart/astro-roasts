# Group Roast (Couple + Family) + Story Card Share — Design

Date: 2026-07-02
Status: Approved by Oliver (this session)

## Goal

Two growth features:

1. **Group roasts** — roast a couple ("roast us") or a family (3–6 people) inside the app, purchasable like solo roasts, and orderable through the Instagram DM funnel (direct IG webhook path).
2. **Story card share** — every finished roast (solo and group) generates a 1080×1920 story image with its single most savage line, shareable to Instagram Stories in one tap. This is the viral flywheel.

## Constraints

- Solo roast flow must not regress. Solo stays €5.
- Build on top of the **uncommitted** direct-IG-webhook work already in the repo (`app/api/webhooks/instagram/`, `lib/instagram-webhook.ts`, `igSenderId` branch in `inngest/pipeline.ts`). Do not clobber it.
- Schema changes applied to Neon via idempotent SQL scripts (project convention).
- Runner changes deploy to Hermes (`ops/hermes-roast-runner/` is the source of truth; scp after local verification).
- Vercel env vars set via REST API, not CLI (`vercel env add` crashes in 48.12.0).
- Voice rule: group prompt ports the `astro-roast-group` skill voice — funny-from-truth, no AI-slop phrasing.

## Pricing

- Solo: €5 (unchanged).
- Group: €8 for 2 people + €4 per extra head. Family of 4 = €16. Cap at 6 people.
- Group payments go through `/api/payment-intent` (already computes dynamic amounts per currency); amount derived from subject count server-side — never trusted from the client. The Stripe Checkout-session route (`/api/checkout`, fixed `STRIPE_PRICE_ID`) stays solo-only.

## Schema

Idempotent ALTERs / CREATEs:

- `roasts.kind` text NOT NULL default `'solo'` — `solo | couple | family`.
- `roasts.gold_line` text — the single most savage line, picked by the runner, used by the story card.
- `roasts.extra_placements` jsonb — array of `{name, sunSign, moonSign, rising, ...}` for persons 2..N. Person 1 keeps the existing per-sign columns.
- New table `roast_subjects`: `(id uuid pk, roast_id uuid fk, user_id uuid fk, position int)`, index on `roast_id`. Every subject (including person 1 at position 0, for uniformity of reads) is a `users` row. `roasts.user_id` remains the owner / person 1 / email recipient.

## Runner (`ops/hermes-roast-runner/`)

- `server.js`: accept payload `mode: "group"` with `people: [{name, gender, date, time, birthPlace}] (2..6)` and `relationship: "couple" | "family" | free text`. Solo payload shape unchanged; couple = group of 2 with `relationship: "couple"` — one group code path.
- Prompt: new group section in the runner SKILL.md, ported from the local `astro-roast-group` skill — individual reads per person, then the group-dynamic collision as the climax. Same `---CHART_START---`/`---ROAST_START---` marker protocol; charts per person are marked per subject.
- Gold line is NOT emitted by the runner (its creative call stays uncontaminated — documented design in `server.js`). Instead the pipeline picks it post-hoc with a cheap Haiku call (`lib/gold-line.ts`, pattern from `lib/chart-annotations.ts`); any failure → null → story card falls back to the teaser quote.
- Deploy: scp `server.js` + SKILL.md to Hermes, restart runner service.

## API + Pipeline

- `/api/generate`: accept optional `kind` (`couple | family`) + `people[]` (persons 2..N, same field shape as person 1). Validates count by kind (couple = exactly 2 total, family = 3–6 total). Creates one `users` row per person, `roast_subjects` rows, roast row with `kind`, fires the existing `roast/generate` event with the people array.
- `inngest/pipeline.ts`: when `kind !== 'solo'`, build group runner payload. Parse person-1 placements into existing columns, persons 2..N into `extra_placements`. `gold_line` is picked post-hoc by the pipeline's Haiku call (see Runner section — the runner emits no GOLDLINE field), for solo and group alike. Email + DM teaser steps unchanged. Merge carefully on top of the uncommitted `igSenderId` work.

## Web UI

- `BirthForm`: mode toggle "Just me / Us" always visible. "Us" reveals a second person fieldset (same fields, birth time optional per person).
- **Family gating**: "Roast my family" mode is visible only after the visitor has a completed roast — unlock check = existing localStorage roast-id pattern. Primary entry point = upsell CTA on the finished-roast page ("Now do your family. €4 a head.") linking to the form in family mode (3–6 person repeatable fieldset).
- Roast page / `TeaserView` / paywall: render group roasts — all names, big-3 row per person, group price on the paywall.

## DM Funnel (direct IG webhook)

- Extend the webhook parser with a group parser: numbered blocks `person 1: … person 2: …` (2–6 accepted), each block containing the same key:value fields as solo.
- Keywords: `ROAST US` → bot replies with the couple details template; `ROAST MY FAMILY` → family template. Filled reply → group generate flow, `source = 'instagram_dm'`, teaser DM'd back exactly as solo does.
- DM users skip the family visibility gate (they already roasted or arrived via a share).

## Story Card + ShareButton v2 (solo AND group)

- New route `app/roast/[id]/story-image/route.tsx` — `ImageResponse`, 1080×1920, same brand system as the existing OG image (Syne + DM Mono, void/ash/blood): `gold_line` huge, name(s), big 3 (person 1; group cards list names), footer `@astroroasted · DM ROAST · astroroast.com`.
- `ShareButton` v2: fetch the story PNG → `navigator.share({ files: [File] })` → native share sheet exposes "Add to Instagram Story" on iOS/Android. Fallbacks: no file-share support → download the image; fetch failure → current URL share.
- Roasts with no `gold_line` (all existing rows) fall back to the current `pullQuote(teaser)` logic so the card never 404s.

## Error handling

- Group runner failure = same retry/onFailure path as solo (status `error` / `rate_limited` on the roast row).
- Webhook group parse failure → bot replies with the template again (one retry hint), never silently drops.
- `/api/generate` rejects >6 people, mixed-kind mismatches, and oversize bodies (existing limits scale: `MAX_BODY_BYTES` raised proportionally for 6 subjects).

## Testing

- Unit: group DM parser (2, 3, 6 people, garbage input), runner output parser (GOLDLINE, multi-person placements), payment amount derivation from subject count.
- Manual e2e: one real couple roast via web (through payment), one via DM; one family roast via web; story-card share on a real phone.

## Out of scope

- ManyChat (webhook path replaces it for now).
- Gift/"roast someone else" solo variant.
- Referral credits for group participants.
