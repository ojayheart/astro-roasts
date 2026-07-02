# Group Roast (Couple + Family) + Story Card Share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couple (2) and family (3–6) roasts purchasable on web and orderable via Instagram DM, plus a 1080×1920 story-card share on every finished roast.

**Architecture:** Group subjects are ordinary `users` rows linked through a new `roast_subjects` table; the Hermes runner gets a `mode:"group"` path that invokes the `astro-roast-group` skill; the Inngest pipeline branches on `kind` and stores person-2..N placements as jsonb. Story card = a second `ImageResponse` route + file-based `navigator.share`.

**Tech Stack:** Next.js 16 (App Router), Drizzle + Neon, Inngest 4, Stripe PaymentIntents, node:test, plain-node runner on Hermes.

**Spec:** `docs/superpowers/specs/2026-07-02-group-roast-story-card-design.md`

## Global Constraints

- Solo flow must not regress. Solo price stays 500 minor units.
- Group price: `800 + 400 × (peopleCount − 2)` minor units, all currencies. Cap 6 people.
- `roasts.kind` values: `solo | couple | family`.
- Repo has UNCOMMITTED WIP (IG webhook, `igSenderId` pipeline branch). Build on top; never revert it.
- Schema changes to Neon via idempotent SQL run with `node -e` (project convention). Also update `lib/db/schema.ts` to match.
- Tests: `npm test` (`node --test`, files in `test/*.test.ts`). Type check: `npm run lint` (tsc).
- Commits: `~/.claude/scripts/committer "msg" file1 file2` (explicit files, conventional commits). Branch: `feat/admin-panel` (current).
- Runner source of truth: `ops/hermes-roast-runner/`. Deploy = scp to hermes (`159.69.221.217` / Tailscale `hermes.tailf44b11.ts.net`) + restart service (Task 10).
- Voice: group prompt ports `~/.claude/skills/astro-roast-group/SKILL.md` verbatim philosophy — no AI-slop, funny-from-truth.
- GOLDLINE deviation from spec (approved reasoning): gold line is extracted in the PIPELINE via a cheap Haiku call (`@anthropic-ai/sdk` already used in `lib/chart-annotations.ts`, `ANTHROPIC_API_KEY` already in Vercel env) — NOT in the runner. The runner's creative call stays uncontaminated (documented concern in `server.js` header). Story card falls back to teaser quote when `gold_line` is null, so failures are cosmetic.

---

### Task 1: Schema — `kind`, `gold_line`, `extra_placements`, `roast_subjects`

**Files:**

- Modify: `lib/db/schema.ts`
- Create: none (SQL applied via `node -e`)

**Interfaces:**

- Produces: `roasts.kind` (text, default `'solo'`), `roasts.goldLine`, `roasts.extraPlacements` (jsonb), table `roastSubjects` with relations. Type `ExtraPlacement = { name: string; sunSign: string; moonSign: string; rising: string | null }`.

- [ ] **Step 1: Apply idempotent SQL to Neon**

```bash
cd ~/Developer/astro-roasts && node -e '
import("dotenv/config").catch(()=>{});
const { neon } = await import("@neondatabase/serverless");
const fs = await import("node:fs");
const env = fs.readFileSync(".env.local","utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = neon(url);
await sql`ALTER TABLE roasts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT ${"solo"}`;
await sql`ALTER TABLE roasts ADD COLUMN IF NOT EXISTS gold_line text`;
await sql`ALTER TABLE roasts ADD COLUMN IF NOT EXISTS extra_placements jsonb`;
await sql`CREATE TABLE IF NOT EXISTS roast_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id uuid NOT NULL REFERENCES roasts(id),
  user_id uuid NOT NULL REFERENCES users(id),
  position integer NOT NULL
)`;
await sql`CREATE INDEX IF NOT EXISTS roast_subjects_roast_idx ON roast_subjects(roast_id)`;
console.log("schema applied");
'
```

Expected: `schema applied`. (If the dotenv import line errors, delete it — DATABASE_URL is read from `.env.local` directly.)

- [ ] **Step 2: Update `lib/db/schema.ts`**

In the `roasts` table, after the `mcSubscriberId` column add:

```ts
    kind: text("kind").default("solo").notNull(), // solo | couple | family
    goldLine: text("gold_line"), // most savage standalone quote — story card
    extraPlacements: jsonb("extra_placements"), // ExtraPlacement[] for persons 2..N
```

After the `connections` table definition add:

```ts
export const roastSubjects = pgTable(
  "roast_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roastId: uuid("roast_id")
      .references(() => roasts.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("roast_subjects_roast_idx").on(table.roastId)],
);
```

Extend relations: in `roastsRelations` change `({ one })` to `({ one, many })` and add `subjects: many(roastSubjects),`. Add:

```ts
export const roastSubjectsRelations = relations(roastSubjects, ({ one }) => ({
  roast: one(roasts, {
    fields: [roastSubjects.roastId],
    references: [roasts.id],
  }),
  user: one(users, {
    fields: [roastSubjects.userId],
    references: [users.id],
  }),
}));
```

- [ ] **Step 3: Type check**

Run: `npm run lint` — expected: clean.

- [ ] **Step 4: Commit**

```bash
~/.claude/scripts/committer "feat: schema for group roasts — kind, gold_line, extra_placements, roast_subjects" lib/db/schema.ts
```

---

### Task 2: `lib/group.ts` — kinds, validation, pricing

**Files:**

- Create: `lib/group.ts`
- Test: `test/group.test.ts`

**Interfaces:**

- Produces:
  - `type RoastKind = "solo" | "couple" | "family"`
  - `type PersonInput = { name: string; gender: string; date: string; time: string | null; birthPlace: string }`
  - `type ExtraPlacement = { name: string; sunSign: string; moonSign: string; rising: string | null }`
  - `groupAmountMinorUnits(peopleCount: number): number` — 800 + 400×(n−2)
  - `validateGroupRequest(kind: unknown, people: unknown): { ok: true; kind: RoastKind; people: PersonInput[] } | { ok: false; error: string }` — couple = exactly 2 people, family = 3–6; field shape/length checks matching `/api/generate` limits (name ≤80, gender ≤60, date ≤60, birthPlace ≤160, time ≤40).

- [ ] **Step 1: Write failing tests** — `test/group.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert";
import { groupAmountMinorUnits, validateGroupRequest } from "../lib/group.ts";

const p = (name: string) => ({
  name,
  gender: "woman",
  date: "1990-01-01",
  time: null,
  birthPlace: "Auckland, New Zealand",
});

test("pricing: couple 800, family of 4 = 1600, 6 = 2400", () => {
  assert.equal(groupAmountMinorUnits(2), 800);
  assert.equal(groupAmountMinorUnits(4), 1600);
  assert.equal(groupAmountMinorUnits(6), 2400);
});

test("couple requires exactly 2", () => {
  assert.equal(validateGroupRequest("couple", [p("A"), p("B")]).ok, true);
  assert.equal(validateGroupRequest("couple", [p("A")]).ok, false);
  assert.equal(
    validateGroupRequest("couple", [p("A"), p("B"), p("C")]).ok,
    false,
  );
});

test("family 3-6", () => {
  assert.equal(
    validateGroupRequest("family", [p("A"), p("B"), p("C")]).ok,
    true,
  );
  assert.equal(validateGroupRequest("family", [p("A"), p("B")]).ok, false);
  assert.equal(
    validateGroupRequest(
      "family",
      Array.from({ length: 7 }, (_, i) => p(`P${i}`)),
    ).ok,
    false,
  );
});

test("rejects junk fields", () => {
  assert.equal(
    validateGroupRequest("couple", [
      p("A"),
      { ...p("B"), name: "x".repeat(90) },
    ]).ok,
    false,
  );
  assert.equal(
    validateGroupRequest("couple", [p("A"), { ...p("B"), date: 42 }]).ok,
    false,
  );
  assert.equal(validateGroupRequest("dinner", [p("A"), p("B")]).ok, false);
});
```

- [ ] **Step 2: Run — verify fails** — `npm test -- test/group.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/group.ts`**

```ts
export type RoastKind = "solo" | "couple" | "family";

export type PersonInput = {
  name: string;
  gender: string;
  date: string;
  time: string | null;
  birthPlace: string;
};

export type ExtraPlacement = {
  name: string;
  sunSign: string;
  moonSign: string;
  rising: string | null;
};

// €8 for two, €4 per extra head, all supported currencies use the same
// number in minor units (matches the solo AMOUNT_BY_CURRENCY convention).
export function groupAmountMinorUnits(peopleCount: number): number {
  return 800 + 400 * (peopleCount - 2);
}

const KIND_BOUNDS: Record<string, { min: number; max: number }> = {
  couple: { min: 2, max: 2 },
  family: { min: 3, max: 6 },
};

function validPerson(raw: unknown): PersonInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const gender = typeof r.gender === "string" ? r.gender.trim() : "";
  const date = typeof r.date === "string" ? r.date.trim() : "";
  const birthPlace =
    typeof r.birthPlace === "string" ? r.birthPlace.trim() : "";
  const time =
    typeof r.time === "string" && r.time.trim() ? r.time.trim() : null;
  if (!name || !gender || !date || !birthPlace) return null;
  if (
    name.length > 80 ||
    gender.length > 60 ||
    date.length > 60 ||
    birthPlace.length > 160 ||
    (time && time.length > 40)
  ) {
    return null;
  }
  return { name, gender, date, time, birthPlace };
}

export function validateGroupRequest(
  kind: unknown,
  people: unknown,
):
  | { ok: true; kind: RoastKind; people: PersonInput[] }
  | { ok: false; error: string } {
  if (typeof kind !== "string" || !(kind in KIND_BOUNDS)) {
    return { ok: false, error: "Invalid kind" };
  }
  const bounds = KIND_BOUNDS[kind];
  if (!Array.isArray(people)) {
    return { ok: false, error: "people must be an array" };
  }
  if (people.length < bounds.min || people.length > bounds.max) {
    return {
      ok: false,
      error: `${kind} needs ${bounds.min}${bounds.min === bounds.max ? "" : `-${bounds.max}`} people`,
    };
  }
  const parsed: PersonInput[] = [];
  for (const raw of people) {
    const person = validPerson(raw);
    if (!person) return { ok: false, error: "Invalid person fields" };
    parsed.push(person);
  }
  return { ok: true, kind: kind as RoastKind, people: parsed };
}
```

- [ ] **Step 4: Run tests** — `npm test -- test/group.test.ts` → PASS. `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
~/.claude/scripts/committer "feat: group roast kinds, validation, pricing" lib/group.ts test/group.test.ts
```

---

### Task 3: `lib/roast-runner.ts` — group payload + multi-chart parsing

**Files:**

- Modify: `lib/roast-runner.ts`
- Test: `test/roast-runner-group.test.ts`

**Interfaces:**

- Consumes: `PersonInput` from `lib/group.ts`; existing `extractChartPlacements`, `extractMarkedSection`.
- Produces:
  - `buildGroupRunnerPayload(input: { roastId: string; relationship: "couple" | "family"; people: PersonInput[] }): GroupRoastRunnerPayload` where `GroupRoastRunnerPayload = { roastId; mode: "group"; relationship; people: Array<PersonInput & { hasBirthTime: boolean }> }`.
  - `extractGroupCharts(output: string, peopleCount: number): string[]` — pulls `---CHART_1_START---…---CHART_1_END---` … `---CHART_N_…` sections (missing section → empty string at that index).

Runner group output protocol (consumed here, produced by Task 4): one marked chart section per person (`CHART_1`..`CHART_N`, same order as `people[]`), then one `ROAST` section for the whole group.

- [ ] **Step 1: Failing tests** — `test/roast-runner-group.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert";
import {
  buildGroupRunnerPayload,
  extractGroupCharts,
} from "../lib/roast-runner.ts";

const people = [
  {
    name: "A",
    gender: "man",
    date: "1994-01-21",
    time: "13:00",
    birthPlace: "Wellington, NZ",
  },
  {
    name: "B",
    gender: "woman",
    date: "1992-08-29",
    time: null,
    birthPlace: "Munich, Germany",
  },
];

test("group payload shape", () => {
  const p = buildGroupRunnerPayload({
    roastId: "r1",
    relationship: "couple",
    people,
  });
  assert.equal(p.mode, "group");
  assert.equal(p.relationship, "couple");
  assert.equal(p.people.length, 2);
  assert.equal(p.people[0].hasBirthTime, true);
  assert.equal(p.people[1].hasBirthTime, false);
});

test("extractGroupCharts pulls numbered sections in order", () => {
  const raw = [
    "---CHART_1_START---",
    "chart one",
    "---CHART_1_END---",
    "---CHART_2_START---",
    "chart two",
    "---CHART_2_END---",
    "---ROAST_START---",
    "the roast",
    "---ROAST_END---",
  ].join("\n");
  assert.deepEqual(extractGroupCharts(raw, 2), ["chart one", "chart two"]);
});

test("missing chart section yields empty string, not throw", () => {
  const raw = "---CHART_1_START---\nonly one\n---CHART_1_END---";
  assert.deepEqual(extractGroupCharts(raw, 2), ["only one", ""]);
});
```

- [ ] **Step 2: Run — FAIL** (`buildGroupRunnerPayload` not exported).

- [ ] **Step 3: Implement** — append to `lib/roast-runner.ts`:

```ts
import type { PersonInput } from "./group";

export interface GroupRoastRunnerPayload {
  roastId: string;
  mode: "group";
  relationship: "couple" | "family";
  people: Array<PersonInput & { hasBirthTime: boolean }>;
}

export function buildGroupRunnerPayload(input: {
  roastId: string;
  relationship: "couple" | "family";
  people: PersonInput[];
}): GroupRoastRunnerPayload {
  return {
    roastId: input.roastId,
    mode: "group",
    relationship: input.relationship,
    people: input.people.map((p) => ({ ...p, hasBirthTime: !!p.time })),
  };
}

export function extractGroupCharts(raw: string, peopleCount: number): string[] {
  return Array.from({ length: peopleCount }, (_, i) =>
    extractMarkedSection(raw, `CHART_${i + 1}` as never),
  );
}
```

Note: `extractMarkedSection` is typed `marker: "CHART" | "ROAST"` — widen its signature to `marker: string`. That is safe (marker only interpolated into strings).

- [ ] **Step 4: Run tests** — `npm test -- test/roast-runner-group.test.ts` → PASS; `npm test` full → all pass; `npm run lint` clean.

- [ ] **Step 5: Commit**

```bash
~/.claude/scripts/committer "feat: group runner payload builder + multi-chart parsing" lib/roast-runner.ts test/roast-runner-group.test.ts
```

---

### Task 4: Runner — `mode:"group"` on Hermes runner (local source)

**Files:**

- Modify: `ops/hermes-roast-runner/server.js`
- Create: `ops/hermes-roast-runner/GROUP-SKILL-NOTES.md` (deploy notes only — actual skill file already exists on Mac at `~/.claude/skills/astro-roast-group/SKILL.md` and is copied to Hermes in Task 10)

**Interfaces:**

- Consumes: `GroupRoastRunnerPayload` POSTed to `/roast`.
- Produces: HTTP 200 `{ chartData: string, charts: string[], roast: string, durationMs }` for group mode — `charts[i]` = person i chart text; `chartData` = all charts joined with `\n\n=== {name} ===\n\n` headers (stored in the existing `chartData` column); `roast` = `---ROAST_START---…---ROAST_END---` (same protocol as solo).

- [ ] **Step 1: Add group prompt builder** to `server.js` after `buildWriteUserPrompt`:

```js
function buildGroupWriteUserPrompt({ relationship, people }) {
  const roster = people
    .map(
      (p, i) => `Person ${i + 1}:
- Name: ${p.name}
- Gender: ${p.gender}
- Date of birth: ${p.date}
- Birth time: ${p.hasBirthTime ? p.time : "unknown"}
- Place of birth: ${p.birthPlace}`,
    )
    .join("\n\n");

  return `Invoke the Skill tool now with skill="astro-roast-group" to load the full skill instructions, then follow them EXACTLY. Relationship type: ${relationship}. The people:

${roster}

Resolve each messy place input to exact coordinates and IANA timezone. Run the synastry engine as the skill instructs, then write ONE group roast of the dynamic. Output format, EXACTLY:
${people.map((_, i) => `---CHART_${i + 1}_START---\n<person ${i + 1} full chart text>\n---CHART_${i + 1}_END---`).join("\n")}
---ROAST_START---
<the group roast prose — no TITLE/TEASER/FULL/CALLOUTS fields>
---ROAST_END---
No commentary outside the markers.`;
}
```

- [ ] **Step 2: Branch the request handler.** In the handler, replace the destructure + validation block with:

```js
const {
  roastId,
  name,
  date,
  time,
  birthPlace,
  hasBirthTime,
  mode,
  relationship,
  people,
} = body;
const isGroup = mode === "group";
if (isGroup) {
  if (!Array.isArray(people) || people.length < 2 || people.length > 6) {
    return send(400, { error: "missing_fields" });
  }
} else if (!name || !date || !birthPlace) {
  return send(400, { error: "missing_fields" });
}
```

Then make the write call conditional (group creep runs longer — multi-chart):

```js
const stopWriteCreep = startProgressCreep({
  roastId,
  fromPct: 10,
  toPct: 70,
  durationMs: isGroup ? 150_000 : 75_000,
});

const write = await runClaude({
  userPrompt: isGroup
    ? buildGroupWriteUserPrompt({
        relationship: relationship || "couple",
        people,
      })
    : buildWriteUserPrompt({
        name,
        date,
        time,
        birthPlace,
        hasBirthTime: !!hasBirthTime,
      }),
  model: MODEL,
  tools: "Bash,WebSearch,Skill",
});
```

And after the existing solo extraction, add the group response path (before the solo `return send(200, …)`, guarded):

```js
if (isGroup) {
  const charts = people.map((_, i) =>
    extractMarkedSection(write.stdout, `CHART_${i + 1}`),
  );
  const chartData = charts
    .map((c, i) => `=== ${people[i].name} ===\n\n${c}`)
    .join("\n\n");
  return send(200, {
    chartData,
    charts,
    roast,
    durationMs: Date.now() - startedAt,
  });
}
```

(`roast` is the already-built `---ROAST_START---…` string; the `!roastBody` guard above stays shared.)

- [ ] **Step 3: Syntax check** — `node --check ops/hermes-roast-runner/server.js` → no output.

- [ ] **Step 4: Write `ops/hermes-roast-runner/GROUP-SKILL-NOTES.md`**

```markdown
# Group mode deploy checklist (see Task 10 of the plan)

Hermes needs, in addition to server.js:

- `~/.claude/skills/astro-roast-group/SKILL.md` (copy from Mac, same path)
- `~/synastry_offline.py` (copy from Mac ~/synastry_offline.py; check `python3 -c "import swisseph"` in /opt/roast-runner/venv first)
- Existing `~/.claude/skills/astro-roast/SKILL.md` untouched.
  Smoke test: POST /roast with mode:"group", 2 people, expect charts[2] + roast.
```

- [ ] **Step 5: Commit**

```bash
~/.claude/scripts/committer "feat(runner): group mode — astro-roast-group skill invocation + per-person chart markers" ops/hermes-roast-runner/server.js ops/hermes-roast-runner/GROUP-SKILL-NOTES.md
```

---

### Task 5: `/api/generate` — accept group requests

**Files:**

- Modify: `app/api/generate/route.ts`

**Interfaces:**

- Consumes: `validateGroupRequest`, `groupAmountMinorUnits` (Task 2), `roastSubjects` (Task 1).
- Produces: request body may include `kind: "couple" | "family"` and `people: PersonInput[]` (ALL people, person 1 first — person 1's top-level legacy fields are not used for group). Response unchanged: `{ id }`. Inngest event for group: `{ roastId, userId, kind, relationship: kind, people: PersonInput[], email }`.

- [ ] **Step 1: Raise body cap + branch.** Change `MAX_BODY_BYTES` to `30_000`. After the rate-limit check, insert:

```ts
const body = await req.json();

if (body.kind === "couple" || body.kind === "family") {
  return handleGroupGenerate(body);
}
```

(then the existing solo code continues with the already-parsed `body`).

- [ ] **Step 2: Add `handleGroupGenerate`** in the same file:

```ts
import { roastSubjects } from "@/lib/db/schema"; // extend existing schema import
import { validateGroupRequest } from "@/lib/group";

async function handleGroupGenerate(body: {
  kind: unknown;
  people: unknown;
  email?: unknown;
}) {
  const validated = validateGroupRequest(body.kind, body.people);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const email =
    typeof body.email === "string" && body.email.length <= 254
      ? body.email
      : null;

  const userIds: string[] = [];
  for (const person of validated.people) {
    const rows = (await db
      .insert(users)
      .values({
        name: person.name,
        gender: person.gender,
        email: userIds.length === 0 ? email : null, // owner gets the email
        dob: person.date,
        birthTime: person.time,
        birthCity: normalizeBirthLocation(person.birthPlace),
        lat: 0,
        lon: 0,
        tz: "UTC",
        referralCode: crypto.randomUUID().slice(0, 8),
      })
      .returning()) as (typeof users.$inferSelect)[];
    userIds.push(rows[0].id);
  }

  const roastRows = (await db
    .insert(roasts)
    .values({
      userId: userIds[0],
      kind: validated.kind,
      status: "generating",
      paid: false,
      emailSent: false,
    })
    .returning()) as (typeof roasts.$inferSelect)[];
  const roast = roastRows[0];

  await db.insert(roastSubjects).values(
    userIds.map((userId, position) => ({
      roastId: roast.id,
      userId,
      position,
    })),
  );

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: roast.id,
      userId: userIds[0],
      kind: validated.kind,
      relationship: validated.kind,
      people: validated.people,
      email,
    },
  });

  return NextResponse.json({ id: roast.id });
}
```

- [ ] **Step 3: Verify** — `npm run lint` clean; solo path still compiles untouched.

- [ ] **Step 4: Commit**

```bash
~/.claude/scripts/committer "feat(api): /api/generate accepts couple/family group requests" app/api/generate/route.ts
```

---

### Task 6: Pipeline — group branch + gold line (solo AND group)

**Files:**

- Create: `lib/gold-line.ts`
- Modify: `inngest/pipeline.ts` (CAREFUL: uncommitted WIP in this file — edit additively)
- Test: `test/gold-line.test.ts` (fallback logic only; the API call is not unit-tested)

**Interfaces:**

- Consumes: `buildGroupRunnerPayload`, `extractGroupCharts`, `extractChartPlacements` (Task 3); event fields from Task 5.
- Produces: `pickGoldLine(fullText: string): Promise<string | null>` (Haiku call, 5s budget, null on any failure); `roasts.goldLine` + `roasts.extraPlacements` populated. `sanitizeGoldLine(line: string, fullText: string): string | null` exported for tests — returns the line only if it is a verbatim substring of the roast and ≤200 chars.

- [ ] **Step 1: Failing test** — `test/gold-line.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert";
import { sanitizeGoldLine } from "../lib/gold-line.ts";

const roast = "You alphabetise your feelings. Your Moon filed a complaint.";

test("accepts verbatim substring", () => {
  assert.equal(
    sanitizeGoldLine("Your Moon filed a complaint.", roast),
    "Your Moon filed a complaint.",
  );
});

test("rejects hallucinated or oversize lines", () => {
  assert.equal(sanitizeGoldLine("Something Claude invented.", roast), null);
  assert.equal(
    sanitizeGoldLine("x".repeat(201), roast + "x".repeat(201)),
    null,
  );
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `lib/gold-line.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

export function sanitizeGoldLine(
  line: string,
  fullText: string,
): string | null {
  const trimmed = line.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!trimmed || trimmed.length > 200) return null;
  return fullText.includes(trimmed) ? trimmed : null;
}

// Cheap post-hoc pick. Never blocks the pipeline: any failure → null and the
// story card falls back to the teaser quote.
export async function pickGoldLine(fullText: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const message = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Below is a comedic astrology roast. Return the single most savage, funniest line that stands alone out of context — copied VERBATIM, one line, nothing else. Max ~25 words.\n\n${fullText.slice(0, 12000)}`,
          },
        ],
      },
      { timeout: 15_000 },
    );
    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return sanitizeGoldLine(text, fullText);
  } catch (err) {
    console.error("gold_line_failed", String(err).slice(0, 200));
    return null;
  }
}
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Pipeline group branch.** In `inngest/pipeline.ts`:

Destructure new event fields: add `kind`, `relationship`, `people` to the existing `const { … } = event.data;`. Define `const isGroup = kind === "couple" || kind === "family";`.

In Step 1 (`generate-roast`), make the fetch body conditional:

```ts
        body: JSON.stringify(
          isGroup
            ? buildGroupRunnerPayload({ roastId, relationship, people })
            : buildRoastRunnerPayload({ roastId, name, gender, date, time, birthPlace: city }),
        ),
```

Widen the response type with `charts?: string[]` and, after the existing `placements` extraction, replace the single `db.update` with:

```ts
const charts: string[] =
  isGroup && Array.isArray(body.charts) && body.charts.length
    ? body.charts
    : isGroup
      ? extractGroupCharts(output, people.length)
      : [];

const placements = extractChartPlacements(
  isGroup ? charts[0] || "" : chartData,
);
const extraPlacements = isGroup
  ? charts.slice(1).map((c, i) => {
      const p = extractChartPlacements(c);
      return {
        name: people[i + 1].name,
        sunSign: p.sunSign,
        moonSign: p.moonSign,
        rising: p.rising,
      };
    })
  : undefined;

await db
  .update(roasts)
  .set({
    chartData,
    draft: roastOutput,
    ...placements,
    ...(extraPlacements ? { extraPlacements } : {}),
  })
  .where(eq(roasts.id, roastId));
```

(Imports: `buildGroupRunnerPayload`, `extractGroupCharts` from `@/lib/roast-runner`.)

In Step 2 (`save-and-email`), after computing `fullText`, add the gold line before the update:

```ts
const goldLine = fullText ? await pickGoldLine(fullText) : null;
```

and include `goldLine` in the `.set({ … })`. Import `pickGoldLine` from `@/lib/gold-line`.

- [ ] **Step 6: Verify + commit**

`npm run lint` clean, `npm test` all pass.

```bash
~/.claude/scripts/committer "feat(pipeline): group roast branch + gold line extraction" inngest/pipeline.ts lib/gold-line.ts test/gold-line.test.ts
```

Note in the commit body if `inngest/pipeline.ts` still contains the pre-existing uncommitted WIP hunks — commit the whole file (WIP + this work ride together; Oliver's branch).

---

### Task 7: Payment — group amounts in `/api/payment-intent`

**Files:**

- Modify: `app/api/payment-intent/route.ts`
- Test: covered by `test/group.test.ts` pricing test (amount derives from `groupAmountMinorUnits`)

**Interfaces:**

- Consumes: `groupAmountMinorUnits` (Task 2); `roasts.kind` (Task 1).

- [ ] **Step 1: Select `kind` and count subjects.** Extend the roast select with `kind: roasts.kind`. After the `paid` guard add:

```ts
let amount = AMOUNT_BY_CURRENCY[currency] ?? 500;
if (roast.kind === "couple" || roast.kind === "family") {
  const subjectRows = await db
    .select({ id: roastSubjects.id })
    .from(roastSubjects)
    .where(eq(roastSubjects.roastId, roastId));
  amount = groupAmountMinorUnits(Math.max(subjectRows.length, 2));
}
```

(Move the existing `const country/currency` lines above this block; delete the old `const amount` line. Imports: `roastSubjects` from `@/lib/db/schema`, `groupAmountMinorUnits` from `@/lib/group`.)

Description string: make it kind-aware —

```ts
      description:
        roast.kind === "solo"
          ? "Astroroast — personalized comedic essay (entertainment)"
          : `Astroroast — ${roast.kind} roast (entertainment)`,
```

- [ ] **Step 2: Verify** — `npm run lint` clean. Manual: covered in Task 11 e2e.

- [ ] **Step 3: Commit**

```bash
~/.claude/scripts/committer "feat(payments): group pricing 800+400/head in payment-intent" app/api/payment-intent/route.ts
```

---

### Task 8: DM funnel — keywords + group parser + webhook handling

**Files:**

- Modify: `lib/instagram-webhook.ts`, `app/api/webhooks/instagram/route.ts`
- Test: `test/instagram-webhook.test.ts` (extend existing file)

**Interfaces:**

- Consumes: `sendInstagramDm({recipientId, texts})` from `lib/instagram.ts`; `roastSubjects`; `PersonInput`.
- Produces:
  - `detectGroupKeyword(text: string): "couple" | "family" | null` — matches whole-message `ROAST US` / `ROAST MY FAMILY` (case-insensitive, surrounding whitespace/emoji tolerated via trim + strip of non-letters at ends).
  - `GROUP_TEMPLATE_MESSAGES: Record<"couple" | "family", string[]>` — the reply templates.
  - `parseInstagramGroupRequest(text: string): { relationship: "couple" | "family"; people: ParsedInstagramRoastRequest[] } | null` — splits on `person N:` headers (2–6 blocks), reuses the existing per-block key:value parser.

- [ ] **Step 1: Failing tests** — append to `test/instagram-webhook.test.ts`:

```ts
import {
  detectGroupKeyword,
  parseInstagramGroupRequest,
  GROUP_TEMPLATE_MESSAGES,
} from "../lib/instagram-webhook.ts";

test("keyword detection", () => {
  assert.equal(detectGroupKeyword("ROAST US"), "couple");
  assert.equal(detectGroupKeyword("  roast us! "), "couple");
  assert.equal(detectGroupKeyword("Roast my family"), "family");
  assert.equal(detectGroupKeyword("roast"), null);
  assert.equal(detectGroupKeyword("name: A\ndob: 1990-01-01"), null);
});

test("group parse: two person blocks", () => {
  const msg = `person 1:
name: Ana
dob: 1992-08-29
place: Munich
time: 08:16
person 2:
name: Ben
dob: 1994-01-21
place: Wellington`;
  const parsed = parseInstagramGroupRequest(msg);
  assert.ok(parsed);
  assert.equal(parsed.people.length, 2);
  assert.equal(parsed.relationship, "couple");
  assert.equal(parsed.people[0].name, "Ana");
  assert.equal(parsed.people[1].time, null);
});

test("group parse: 3+ blocks = family, 7 blocks rejected, junk rejected", () => {
  const block = (i: number) =>
    `person ${i}:\nname: P${i}\ndob: 1990-01-0${(i % 9) + 1}\nplace: Auckland`;
  const three = [1, 2, 3].map(block).join("\n");
  assert.equal(parseInstagramGroupRequest(three)?.relationship, "family");
  const seven = [1, 2, 3, 4, 5, 6, 7].map(block).join("\n");
  assert.equal(parseInstagramGroupRequest(seven), null);
  assert.equal(parseInstagramGroupRequest("person 1:\nname: only"), null);
});

test("templates mention the field format", () => {
  assert.match(GROUP_TEMPLATE_MESSAGES.couple.join(" "), /person 1/i);
  assert.match(GROUP_TEMPLATE_MESSAGES.family.join(" "), /person 3/i);
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — append to `lib/instagram-webhook.ts`:

```ts
export function detectGroupKeyword(text: string): "couple" | "family" | null {
  const clean = text
    .trim()
    .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
    .toLowerCase();
  if (clean === "roast us") return "couple";
  if (clean === "roast my family" || clean === "roast family") return "family";
  return null;
}

export const GROUP_TEMPLATE_MESSAGES: Record<"couple" | "family", string[]> = {
  couple: [
    `both of you. one message, this exact shape:

person 1:
name: …
dob: 1994-01-21
place: city, country
time: 13:00 (optional)
gender: …

person 2:
name: …
dob: …
place: …

send it and the chart does the rest.`,
  ],
  family: [
    `the whole household. one message, 3 to 6 people, this exact shape:

person 1:
name: …
dob: 1994-01-21
place: city, country
time: 13:00 (optional)
gender: …

person 2:
name: …
dob: …
place: …

person 3:
name: …
dob: …
place: …

add person 4-6 the same way. send it. nobody is safe.`,
  ],
};

export function parseInstagramGroupRequest(text: string): {
  relationship: "couple" | "family";
  people: ParsedInstagramRoastRequest[];
} | null {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/(?=^\s*person\s*\d+\s*:)/im)
    .map((b) => b.replace(/^\s*person\s*\d+\s*:/im, "").trim())
    .filter(Boolean);

  if (blocks.length < 2 || blocks.length > 6) return null;

  const people: ParsedInstagramRoastRequest[] = [];
  for (const block of blocks) {
    const person = parseInstagramRoastRequest(block);
    if (!person) return null;
    people.push(person);
  }
  return {
    relationship: people.length === 2 ? "couple" : "family",
    people,
  };
}
```

- [ ] **Step 4: Run tests** — PASS. (If the `split` regex leaves a preamble chunk before `person 1:`, the leading `.filter(Boolean)` plus per-block parse rejection handles it — the preamble block fails `parseInstagramRoastRequest` → null. If users write intro text before the blocks, that kills the parse; acceptable v1, the template says "one message, this exact shape".) Adjust: drop a leading non-`person` chunk instead of failing:

```ts
if (
  blocks.length &&
  !/^name\s*[:=-]/im.test(blocks[0]) &&
  !parseInstagramRoastRequest(blocks[0])
) {
  blocks.shift();
}
```

Place this before the length check. Re-run tests.

- [ ] **Step 5: Wire the webhook route.** In `app/api/webhooks/instagram/route.ts`, inside the `for (const message of messages)` loop, BEFORE the solo parse:

```ts
const keyword = detectGroupKeyword(message.text);
if (keyword) {
  await sendInstagramDm({
    recipientId: message.senderId,
    texts: GROUP_TEMPLATE_MESSAGES[keyword],
  });
  continue;
}

const group = parseInstagramGroupRequest(message.text);
if (group) {
  await handleGroupDmRequest(group, message.senderId);
  continue;
}
```

Add at the bottom of the file:

```ts
async function handleGroupDmRequest(
  group: {
    relationship: "couple" | "family";
    people: ParsedInstagramRoastRequest[];
  },
  senderId: string,
) {
  const existing = await db.query.roasts.findFirst({
    where: (r, { and: dbAnd, eq: dbEq }) =>
      dbAnd(
        dbEq(r.source, "instagram_dm"),
        dbEq(r.mcSubscriberId, senderId),
        dbEq(r.status, "generating"),
      ),
  });
  if (existing) return;

  const kind = group.relationship;
  const people = group.people.map((p) => ({
    name: p.name,
    gender: p.gender,
    date: p.date,
    time: p.time,
    birthPlace: normalizeBirthLocation(p.birthPlace),
  }));

  const userIds: string[] = [];
  for (const person of people) {
    const rows = (await db
      .insert(users)
      .values({
        name: person.name,
        gender: person.gender,
        email: null,
        dob: person.date,
        birthTime: person.time,
        birthCity: person.birthPlace,
        lat: 0,
        lon: 0,
        tz: "UTC",
        referralCode: crypto.randomUUID().slice(0, 8),
      })
      .returning()) as (typeof users.$inferSelect)[];
    userIds.push(rows[0].id);
  }

  const roastRows = (await db
    .insert(roasts)
    .values({
      userId: userIds[0],
      kind,
      status: "generating",
      paid: false,
      emailSent: false,
      source: "instagram_dm",
      mcSubscriberId: senderId,
    })
    .returning()) as (typeof roasts.$inferSelect)[];
  const roast = roastRows[0];

  await db.insert(roastSubjects).values(
    userIds.map((userId, position) => ({
      roastId: roast.id,
      userId,
      position,
    })),
  );

  await inngest.send({
    name: "roast/generate",
    data: {
      roastId: roast.id,
      userId: userIds[0],
      kind,
      relationship: kind,
      people,
      email: null,
      igSenderId: senderId,
    },
  });
}
```

Imports to extend: `detectGroupKeyword`, `parseInstagramGroupRequest`, `GROUP_TEMPLATE_MESSAGES`, `type ParsedInstagramRoastRequest` from `@/lib/instagram-webhook`; `sendInstagramDm` from `@/lib/instagram`; `roastSubjects` from `@/lib/db/schema`.

- [ ] **Step 6: Verify + commit** — `npm test` all pass, `npm run lint` clean.

```bash
~/.claude/scripts/committer "feat(dm): ROAST US / ROAST MY FAMILY keywords + group DM parsing and generation" lib/instagram-webhook.ts app/api/webhooks/instagram/route.ts test/instagram-webhook.test.ts
```

---

### Task 9: Web UI — group form, family gate, group rendering, upsell

**Files:**

- Create: `components/PersonFields.tsx`
- Modify: `components/BirthForm.tsx`, `lib/roast-response.ts`, `lib/types.ts`, `app/roast/[id]/page.tsx`, `app/roast/[id]/RoastClient.tsx` (read first), `components/FullRoastView.tsx` (read first), `components/TeaserView.tsx` (read first)

**Interfaces:**

- Consumes: `/api/generate` group body (Task 5): `{ kind, people: PersonInput[], email? }`.
- Produces:
  - `RoastData` gains `kind: "solo" | "couple" | "family"`, `subjectNames: string[]`, `extraPlacements?: ExtraPlacement[]`, `goldLine?: string | null` (goldLine not needed client-side yet but harmless), `amountMinorUnits: number` (for the paywall price).
  - localStorage key `ar_has_roast` = `"1"` set by RoastClient when a roast reaches `ready` — the family-mode unlock signal.

- [ ] **Step 1: `components/PersonFields.tsx`** — extract the person field group (name, gender, date, time, place, country) from `BirthForm` into a controlled component:

```tsx
"use client";

export type PersonFormValue = {
  name: string;
  gender: string;
  date: string;
  time: string;
  placeName: string;
  countryName: string;
};

export const EMPTY_PERSON: PersonFormValue = {
  name: "",
  gender: "",
  date: "",
  time: "",
  placeName: "",
  countryName: "",
};

export default function PersonFields({
  idPrefix,
  label,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  label: string | null;
  value: PersonFormValue;
  onChange: (v: PersonFormValue) => void;
  disabled: boolean;
}) {
  /* Move the existing name/gender/date/time/place/country JSX from
     BirthForm here verbatim, with:
     - ids prefixed `${idPrefix}-…`
     - value/onChange wired to the value object
       (e.g. onChange({ ...value, name: e.target.value }))
     - the same inputClass/labelClass strings (copy them in)
     - an optional heading rendered when label is non-null:
       <p className="text-xs uppercase tracking-[0.2em] text-blood font-mono">{label}</p>
     Email stays OUT of this component (owner-level, asked once). */
  …
}
```

(The `…` is the verbatim JSX move — copy from `BirthForm.tsx` lines 112–280, adjusting ids/values as noted. No new styling.)

- [ ] **Step 2: Rework `BirthForm.tsx`**

State:

```tsx
type FormMode = "solo" | "couple" | "family";
const [mode, setMode] = useState<FormMode>("solo");
const [people, setPeople] = useState<PersonFormValue[]>([EMPTY_PERSON]);
const [familyUnlocked, setFamilyUnlocked] = useState(false);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const unlocked =
    localStorage.getItem("ar_has_roast") === "1" ||
    params.get("mode") === "family";
  setFamilyUnlocked(unlocked);
  if (params.get("mode") === "family") switchMode("family");
  if (params.get("mode") === "couple") switchMode("couple");
}, []);

const PEOPLE_BY_MODE: Record<FormMode, number> = {
  solo: 1,
  couple: 2,
  family: 3,
};
function switchMode(next: FormMode) {
  setMode(next);
  setPeople((prev) => {
    const target = PEOPLE_BY_MODE[next];
    const copy = prev.slice(0, next === "family" ? 6 : target);
    while (copy.length < target) copy.push(EMPTY_PERSON);
    return copy;
  });
}
```

Mode tabs above the fields (family tab rendered only when `familyUnlocked`):

```tsx
<div className="flex gap-6 font-mono text-xs uppercase tracking-[0.2em]">
  {(
    ["solo", "couple", ...(familyUnlocked ? ["family"] : [])] as FormMode[]
  ).map((m) => (
    <button
      key={m}
      type="button"
      onClick={() => switchMode(m)}
      className={`interactive pb-1 border-b-2 transition-colors ${
        mode === m
          ? "border-blood text-blood"
          : "border-transparent text-ash/50 hover:text-ash"
      }`}
    >
      {m === "solo" ? "Just me" : m === "couple" ? "Us" : "My family"}
    </button>
  ))}
</div>
```

Render `people.map((p, i) => <PersonFields key={i} idPrefix={`p${i}`} label={mode === "solo" ? null : `Person ${i + 1}`} value={p} onChange={…} disabled={loading} />)`. Family mode: an "Add person" button (max 6, `+ €4`) and a remove button per person beyond 3. Keep the single email field once, below the people. Price hint under the CTA: solo `€5` / couple `€8` / family `` `€${8 + 4 * (people.length - 2)}` ``.

Submit: validate every person (same per-field messages, focus first invalid); solo posts the existing body shape (unchanged); couple/family posts:

```ts
{
  kind: mode,
  email: email || undefined,
  people: people.map((p) => ({
    name: p.name,
    gender: p.gender,
    date: p.date,
    time: p.time || null,
    birthPlace: [p.placeName, p.countryName].filter((s) => s.trim()).join(", "),
  })),
}
```

CTA label: solo "Generate my roast" / couple "Roast us both" / family "Roast the whole family".

- [ ] **Step 3: Payload plumbing.** `lib/types.ts` `RoastData`: add

```ts
  kind?: "solo" | "couple" | "family";
  subjectNames?: string[];
  extraPlacements?: { name: string; sunSign: string; moonSign: string; rising: string | null }[];
  amountMinorUnits?: number;
```

`lib/roast-response.ts`: extend `RoastRecord` with `kind: string`, `extraPlacements?: unknown`, and an optional `subjects?: { position: number; user: { name: string } }[]`. In `buildRoastPayload` add to the base payload:

```ts
    kind: (roast.kind as RoastData["kind"]) ?? "solo",
    subjectNames: roast.subjects?.length
      ? [...roast.subjects].sort((a, b) => a.position - b.position).map((s) => s.user.name)
      : [user.name],
    extraPlacements: (roast.extraPlacements as RoastData["extraPlacements"]) ?? undefined,
    amountMinorUnits:
      roast.kind === "couple" || roast.kind === "family"
        ? 800 + 400 * Math.max((roast.subjects?.length ?? 2) - 2, 0)
        : 500,
```

`app/roast/[id]/page.tsx` + `app/api/roast/*` roast queries: add `subjects: { with: { user: true } }` to the `with:` clause wherever `with: { user: true }` appears for a roast fetched into `buildRoastPayload` (grep: `rg -n "with: { user: true }" app lib`). Metadata title for groups: `subjectNames.join(" & ")`.

- [ ] **Step 4: Rendering + gate + upsell.** Read `RoastClient.tsx`, `TeaserView.tsx`, `FullRoastView.tsx` first, then:

- `RoastClient`: in the effect that observes `status === "ready"` (or add one): `localStorage.setItem("ar_has_roast", "1")`.
- `TeaserView`/`PaywallCTA`: show the group price — replace any hardcoded `€5`/`$5` copy with `amountMinorUnits / 100` formatted (`€8`, `€16`). Grep first: `rg -n "€5|\\$5|5\\.00" components app`.
- Big-3 row: where sun/moon/rising render, if `extraPlacements?.length`, render one row per person: person 1 row labelled `subjectNames[0]`, then each extra placement labelled with its name.
- `FullRoastView`: after the roast body, upsell block:

```tsx
<div className="mt-16 border-t border-ash/15 pt-10">
  <p className="font-mono text-xs uppercase tracking-[0.2em] text-blood mb-3">
    Next victim
  </p>
  <p className="font-syne font-bold text-2xl text-ash mb-6">
    Now do your family. €4 a head.
  </p>
  <a
    href="/?mode=family#roast"
    className="interactive inline-block bg-ash text-void font-syne font-bold uppercase px-8 py-4 hover:bg-blood hover:text-ash transition-colors duration-300"
  >
    Roast my family
  </a>
</div>
```

(Confirm the home form section anchor — grep `id=` on the landing page; use the real anchor instead of `#roast` if it differs.)

- [ ] **Step 5: Verify** — `npm run lint` clean; `npm run dev` → home page: solo/couple tabs visible, family hidden; set `localStorage.ar_has_roast = "1"` in devtools → family tab appears; couple submit hits `/api/generate` (network tab shows kind/people body) and lands on `/roast/<id>` in generating state.

- [ ] **Step 6: Commit**

```bash
~/.claude/scripts/committer "feat(ui): couple/family roast form with family gate, group rendering, family upsell" components/PersonFields.tsx components/BirthForm.tsx components/TeaserView.tsx components/FullRoastView.tsx app/roast/[id]/RoastClient.tsx app/roast/[id]/page.tsx lib/roast-response.ts lib/types.ts
```

(Adjust the file list to what actually changed — e.g. `PaywallCTA.tsx`.)

---

### Task 10: Story card route + ShareButton v2

**Files:**

- Create: `app/roast/[id]/story-image/route.tsx`
- Modify: `components/ShareButton.tsx`
- Reuse: fonts already at `app/roast/[id]/Syne-ExtraBold.ttf` + `DMMono-Regular.ttf` (verify with `ls app/roast/\[id\]/`)

**Interfaces:**

- Consumes: `roasts.goldLine` (Task 6), `subjectNames` via the same drizzle query pattern as `opengraph-image.tsx`; `pullQuote` fallback logic (copy of the one in `opengraph-image.tsx` — export it from a shared spot, see Step 1).
- Produces: `GET /roast/:id/story-image` → PNG 1080×1920. `ShareButton` file-share behaviour.

- [ ] **Step 1: Share the quote fallback.** Create `lib/story-quote.ts` and move `pullQuote` from `opengraph-image.tsx` into it (export it; import back into `opengraph-image.tsx`):

```ts
export function pullQuote(teaser: string | null): string {
  // (verbatim body from app/roast/[id]/opengraph-image.tsx)
}

export function storyQuote(roast: {
  goldLine: string | null;
  teaser: string | null;
  fullText: string | null;
}): string {
  return roast.goldLine || pullQuote(roast.teaser ?? roast.fullText);
}
```

- [ ] **Step 2: `app/roast/[id]/story-image/route.tsx`**

```tsx
import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { getRoastUser } from "@/lib/roast-response";
import { storyQuote } from "@/lib/story-quote";

export const runtime = "nodejs";

const VOID = "#030303";
const ASH = "#e5e5e5";
const BLOOD = "#ff2a00";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [syne, dmMono] = await Promise.all([
    readFile(new URL("../Syne-ExtraBold.ttf", import.meta.url)),
    readFile(new URL("../DMMono-Regular.ttf", import.meta.url)),
  ]);

  let names = ["Subject unknown"];
  let quote = storyQuote({ goldLine: null, teaser: null, fullText: null });
  let big3: { label: string; value: string }[] = [];

  try {
    const roast = await db.query.roasts.findFirst({
      where: eq(roasts.id, id),
      with: { user: true, subjects: { with: { user: true } } },
    });
    if (roast?.status === "ready") {
      names = roast.subjects?.length
        ? [...roast.subjects]
            .sort((a, b) => a.position - b.position)
            .map((s) => s.user.name)
        : [getRoastUser(roast).name];
      quote = storyQuote(roast);
      big3 = [
        { label: "SUN", value: roast.sunSign ?? "" },
        { label: "MOON", value: roast.moonSign ?? "" },
        { label: "RISING", value: roast.rising ?? "" },
      ].filter((p) => p.value);
    }
  } catch {
    // brand-only card
  }

  const nameLine = names.join(" & ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: VOID,
        padding: "120px 88px 100px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 24,
          height: 24,
          backgroundColor: BLOOD,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontFamily: "DM Mono",
          fontSize: 30,
          letterSpacing: "0.25em",
          color: BLOOD,
          textTransform: "uppercase",
        }}
      >
        <div style={{ width: 80, height: 3, backgroundColor: BLOOD }} />
        Case file — {nameLine.length > 24 ? "Astro Roasts" : nameLine}
      </div>

      <div
        style={{
          fontFamily: "Syne",
          fontSize: quote.length > 90 ? 64 : 84,
          lineHeight: 1.15,
          color: ASH,
          letterSpacing: "-0.02em",
          display: "flex",
        }}
      >
        “{quote}”
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {big3.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 56,
              borderTop: "1px solid rgba(229,229,229,0.15)",
              paddingTop: 40,
            }}
          >
            {big3.map((p) => (
              <div
                key={p.label}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div
                  style={{
                    fontFamily: "DM Mono",
                    fontSize: 22,
                    letterSpacing: "0.2em",
                    color: BLOOD,
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    fontFamily: "Syne",
                    fontSize: 40,
                    color: ASH,
                    textTransform: "uppercase",
                  }}
                >
                  {p.value}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontFamily: "DM Mono",
            fontSize: 26,
            letterSpacing: "0.2em",
            color: "rgba(229,229,229,0.6)",
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>@astroroasted · DM ROAST</span>
          <span>astroroast.com</span>
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Syne", data: syne, weight: 800, style: "normal" },
        { name: "DM Mono", data: dmMono, weight: 400, style: "normal" },
      ],
    },
  );
}
```

- [ ] **Step 3: ShareButton v2.** Replace `handleShare`'s opening with a story-file attempt before the existing URL share:

```tsx
  const handleShare = async () => {
    const url = `${window.location.origin}/roast/${roastId}`;

    // Story-card share: real image into the sheet → "Add to Instagram Story".
    try {
      const res = await fetch(`/roast/${roastId}/story-image`);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "astroroast-story.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "Astro Roasts", text: "My natal chart got roasted. Yours next. astroroast.com" });
          track("share_clicked", { roastId, method: "story_file" });
          setState("shared");
          setTimeout(() => setState("idle"), 2000);
          return;
        }
        // Desktop / no file-share: download the card, then continue to URL share.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "astroroast-story.png";
        a.click();
        URL.revokeObjectURL(a.href);
        track("share_clicked", { roastId, method: "story_download" });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // story card unavailable — fall through to URL share
    }

    // …existing navigator.share(shareData) / clipboard fallback unchanged…
```

- [ ] **Step 4: Verify** — `npm run dev`, hit `http://localhost:3000/roast/<real-id>/story-image` in the browser → 1080×1920 PNG renders, quote present. `npm run lint` clean.

- [ ] **Step 5: Commit**

```bash
~/.claude/scripts/committer "feat(share): 1080x1920 story card route + file-based story share" app/roast/[id]/story-image/route.tsx lib/story-quote.ts app/roast/[id]/opengraph-image.tsx components/ShareButton.tsx
```

---

### Task 11: Deploy + end-to-end verification

**Files:** none (ops)

- [ ] **Step 1: Deploy runner to Hermes**

```bash
IP=$(security find-generic-password -s hetzner-server-ip -w)
scp ~/Developer/astro-roasts/ops/hermes-roast-runner/server.js root@$IP:/opt/roast-runner/server.js
scp ~/.claude/skills/astro-roast-group/SKILL.md root@$IP:/root/.claude/skills/astro-roast-group/SKILL.md
scp ~/synastry_offline.py root@$IP:/root/synastry_offline.py
ssh root@$IP 'mkdir -p /root/.claude/skills/astro-roast-group && systemctl restart roast-runner && sleep 2 && curl -s localhost:8787/health'
```

(Run the `mkdir` before the SKILL scp if the dir is missing; verify actual service name with `ssh root@$IP 'systemctl list-units | grep -i roast'` and the actual server.js path with `ssh root@$IP 'systemctl cat roast-runner'` BEFORE scp — adjust paths to what the unit file says. If `~/synastry_offline.py` does not exist on the Mac, the astro-roast-group skill references it — locate with `rg -l synastry ~/.claude/skills` and copy the engine the skill actually names.)

- [ ] **Step 2: Runner smoke test (group)**

```bash
SECRET=<from hermes env / keychain>
curl -s -X POST http://$IP:8787/roast -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{
  "roastId":"smoke-group",
  "mode":"group",
  "relationship":"couple",
  "people":[
    {"name":"Ana","gender":"woman","date":"1992-08-29","time":"08:16","birthPlace":"Munich, Germany","hasBirthTime":true},
    {"name":"Ben","gender":"man","date":"1994-01-21","time":null,"birthPlace":"Wellington, New Zealand","hasBirthTime":false}
  ]}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("charts:",len(d.get("charts",[])), "roast:", len(d.get("roast","")))'
```

Expected: `charts: 2 roast: <several thousand>`. Solo smoke too (existing payload shape) — confirm no regression.

- [ ] **Step 3: Deploy web** — push branch; Vercel preview builds. Monitor the deploy (project rule): `vercel ls` / dashboard until READY. **Before any Vercel CLI use: `cp .env.local .env.local.backup`.** No new env vars required (`ANTHROPIC_API_KEY`, `INSTAGRAM_*` already set — verify with Vercel REST API, not CLI env pull).

- [ ] **Step 4: E2E checklist (record results in the session)**

1. Web solo roast → unchanged, gold line lands in DB (`select gold_line from roasts order by created_at desc limit 1`).
2. Web couple roast → generating page → ready; both names + two big-3 rows; paywall shows €8; pay with Stripe test card on preview → full text.
3. Family gate: fresh incognito → no family tab; after roast ready → tab appears; family of 3 → €12 shown, payment-intent amount 1200.
4. Story image: `/roast/<id>/story-image` renders for solo + couple; ShareButton on a real phone → share sheet shows Instagram Story target.
5. DM: send `ROAST US` to @astroroasted → template reply arrives; send filled template → teaser DM back. (Webhook must be live on prod + Meta app subscribed — if the uncommitted webhook work isn't deployed/subscribed yet, park this item and note it.)

- [ ] **Step 5: Memory + wrap-up** — update `~/.claude/projects/-Users-oliverhart/memory/astroroast-dm-funnel.md` (webhook path now primary, group keywords) and add gold-line/story-card note to `astroroast-instagram.md`. Commit any doc changes.

---

## Self-Review (done at write time)

- Spec coverage: schema ✔ (T1), runner ✔ (T4, GOLDLINE moved to pipeline — deviation documented in Global Constraints), generate ✔ (T5), pipeline ✔ (T6), pricing ✔ (T2/T7), UI + gate + upsell ✔ (T9), DM ✔ (T8), story card + ShareButton ✔ (T10), tests ✔ (T2/T3/T6/T8), e2e ✔ (T11).
- Known judgment calls for the implementer: exact JSX move in T9 Step 1 (verbatim relocation, no redesign); real service name/paths on Hermes (T11 Step 1 verifies before scp); anchor id for the upsell link.
