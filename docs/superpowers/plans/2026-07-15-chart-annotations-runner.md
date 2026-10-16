# Chart Annotations Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate paid chart annotation jokes through the existing Hermes Claude subscription runner instead of the exhausted metered Anthropic API.

**Architecture:** The web app continues to enumerate deterministic chart facts and cache completed annotations. It sends only the roast text and element descriptors to a new authenticated Hermes endpoint; the runner validates the bounded payload, invokes Claude CLI, parses strict JSON, and returns lines for known IDs. Any runner failure continues through the existing facts-only route fallback.

**Tech Stack:** Next.js 16, TypeScript, Node HTTP server, Claude CLI, Node test runner.

## Global Constraints

- Preserve facts-only behavior on every generation failure.
- Keep `ROAST_RUNNER_SECRET` bearer authentication and `ROAST_RUNNER_URL` configuration.
- Accept at most 100 elements, 80,000 roast characters, and 300 characters per generated line.
- Preserve existing uncommitted user formatting changes in `ops/hermes-roast-runner/server.js`.

---

### Task 1: Runner contract helpers

**Files:**
- Create: `ops/hermes-roast-runner/chart-annotations.js`
- Create: `test/chart-annotations-runner.test.ts`

**Interfaces:**
- Consumes: `{ roastText, elements: Array<{ id, title, facts }> }`.
- Produces: `validateAnnotationInput(body)`, `buildAnnotationPrompt(body)`, and `parseAnnotationOutput(stdout, allowedIds)`.

- [ ] **Step 1: Write failing tests**

Test valid and oversized payloads, prompt inclusion, fenced JSON parsing, unknown-ID removal, whitespace trimming, and line-length rejection by importing the three named helpers.

- [ ] **Step 2: Verify RED**

Run: `node --test test/chart-annotations-runner.test.ts`

Expected: FAIL because `ops/hermes-roast-runner/chart-annotations.js` does not exist.

- [ ] **Step 3: Implement the helpers**

Create bounded validation for `roastText`, `elements`, `id`, `title`, and `facts`; build a prompt that requests `{\"lines\":[{\"id\":\"...\",\"line\":\"...\"}]}`; parse optional Markdown fences and return only allowed IDs with non-empty lines of at most 300 characters.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/chart-annotations-runner.test.ts`

Expected: all runner helper tests pass.

### Task 2: Web runner client

**Files:**
- Modify: `lib/chart-annotations.ts`
- Create: `test/chart-annotations.test.ts`

**Interfaces:**
- Consumes: `NatalChart`, roast text, `ROAST_RUNNER_URL`, and `ROAST_RUNNER_SECRET`.
- Produces: the existing `generateChartAnnotations(chart, roastText)` API and `ChartAnnotations` result.

- [ ] **Step 1: Write failing tests**

Inject a fake fetch through an optional test-only options object, assert the authenticated `/chart-annotations` request contract, and verify returned lines merge only into known deterministic annotations. Add non-OK and missing-configuration rejection cases.

- [ ] **Step 2: Verify RED**

Run: `node --test test/chart-annotations.test.ts`

Expected: FAIL because the current implementation ignores the runner client and instantiates Anthropic.

- [ ] **Step 3: Implement the client**

Remove the direct Anthropic call from this module. POST the bounded descriptors and roast to `${ROAST_RUNNER_URL}/chart-annotations` with bearer authentication and a 55-second timeout, reject non-OK or malformed responses, and merge trimmed lines only for known IDs.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/chart-annotations.test.ts`

Expected: all web client tests pass.

### Task 3: Hermes endpoint

**Files:**
- Modify: `ops/hermes-roast-runner/server.js`
- Test: `test/chart-annotations-runner.test.ts`

**Interfaces:**
- Consumes: validated Task 1 payload and shared `runClaude`.
- Produces: authenticated `POST /chart-annotations` returning `{ lines }` or a typed 4xx/5xx error.

- [ ] **Step 1: Extend the failing contract test**

Assert the runner route allow-list contains `/chart-annotations` so deployment cannot silently omit the handler.

- [ ] **Step 2: Verify RED**

Run: `node --test test/chart-annotations-runner.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement the endpoint**

Add an annotation system prompt, use `ANNOTATION_MODEL || DM_AGENT_MODEL`, validate before invoking Claude, execute with no tools and a 50-second timeout, parse through Task 1 helpers, return 502 on bad output, and retain the shared bearer-auth gate.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/chart-annotations-runner.test.ts`

Expected: all endpoint contract tests pass.

### Task 4: Verification and delivery

**Files:**
- Review: all files above

**Interfaces:**
- Consumes: completed implementation.
- Produces: verified, committed, pushed fix.

- [ ] **Step 1: Run focused and complete verification**

Run: `node --test test/chart-annotations.test.ts test/chart-annotations-runner.test.ts && npm test && npm run lint && npm run build`

Expected: exit 0 for every command.

- [ ] **Step 2: Review scoped diff**

Run: `git diff --check && git diff -- lib/chart-annotations.ts ops/hermes-roast-runner/chart-annotations.js ops/hermes-roast-runner/server.js test/chart-annotations.test.ts test/chart-annotations-runner.test.ts`

Expected: no whitespace errors; only the planned behavior plus pre-existing formatting remains.

- [ ] **Step 3: Commit and push**

Run: `~/.codex/scripts/committer \"fix: route chart annotations through Hermes\" <explicit files>` then `git push origin main`.

Expected: one atomic conventional commit on `main`, pushed successfully.
