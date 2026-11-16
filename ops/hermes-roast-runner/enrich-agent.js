// ── /enrich-agent — company profile + brand system, on the subscription ──────
// Second tenant on this runner, same shape as /dm-agent: the caller (Anookz on
// Vercel) does every fetch behind its own SSRF screening and posts INERT text;
// we run one claude turn and return raw JSON; validation happens on the web
// side. tools is deliberately "" — this agent judges evidence, it never
// browses, so an attacker-supplied merchant URL never reaches this machine.

export const ENRICH_MODEL = process.env.ENRICH_AGENT_MODEL || "claude-sonnet-5";
export const ENRICH_TIMEOUT_MS = Number(
  process.env.ENRICH_AGENT_TIMEOUT_MS || 45_000,
);

// Kept byte-identical to ENRICH_SYSTEM_PROMPT in the Anookz repo
// (lib/ai/enrichAgent.ts). If you edit one, edit both.
export const ENRICH_SYSTEM_PROMPT = `You extract a company profile and a brand system from evidence already gathered from that company's own website. You never browse. You only judge what you are given.

Return ONE raw JSON object and nothing else. No fences, no commentary.

## The brand system — this is the part that needs judgement

Anookz runs THREE accent roles, each with a job. Assign real brand colours to the roles they suit. Never more than three, and a confident one beats a padded three — an omitted role falls back to a designed default, which is a good outcome, not a gap.

- accent (role 1, REQUIRED) — primary action. Buttons and CTAs. The colour that says "click this". Usually the most saturated heavily-used hue.
- accent2 (role 2, optional) — the connection / information layer. A calmer, cooler supporting colour. Omit and it stays Sea Glass.
- accent3 (role 3, optional) — active route / live signal. Something that reads as ALIVE against the other two — a warm or high-energy hue. Omit and it stays Solar Gold.
- neutralDark / neutralLight — the ink and paper. Plain hex strings, no name needed.

Assign a role only when a real brand colour fits its JOB. Do not fill role 2 with a tint of role 1 to avoid leaving it blank — a tonal variant of a colour already used is not a second brand colour, and the default is better than a duplicate.

Evidence ranking, strongest first:
1. A named CSS custom property (--brand, --primary, --accent). Someone declared intent. This outranks any frequency count.
2. Colours in the logo SVG's own palette.
3. High-frequency chromatic colours from the theme stylesheet.
4. High-frequency chromatic colours from inline styles.

REJECT, and say so in \`rejected\`:
- Payment-card and badge colours. A Shopify footer ships Visa blue #005bd3, Mastercard red #eb001b and #f79e1b, Amex #0071ce. Measured on a live store, four of its top eight colours were payment badges. These are never the merchant's brand.
- Vendor widget colours (chat bubbles, cookie banners, review widgets).
- Anything flagged neutral: near-white tints, near-black inks, greys. They can be neutralDark / neutralLight, never primary or accent.
- Generic framework defaults that appear on every site using that stack.

Set confidence: high when named properties or a logo palette drove the pick; medium on frequency alone; low when you are largely guessing.

## Type

fonts.heading and fonts.body from the families given. Two families usually means heading + body, in that order of first appearance. One family means both. Ignore fallback stacks and system fonts.

## The profile fields

Fill only what the evidence supports. OMIT anything you cannot support — never guess an address, a phone number, or a legal name. A missing field is correct; an invented one is a defect.

- Some sites publish nothing. That is a valid answer: return the fields you have and leave the rest out.
- A JSON-LD Organization nested inside an Offer is a Shopify seller stub. It carries a trading name and no address. Do not treat it as the company record.
- description: 2-4 factual sentences, third person, from the site's own words. No hyperbole, no invented claims.

## Output shape

{"suggestion":{
  "legalName":"...","companyName":"...","phone":"...","email":"...",
  "addressLine1":"...","city":"...","region":"...","postcode":"...","country":"...",
  "website":"...","description":"...",
  "brand":{
    "accent":{"hex":"#rrggbb","name":"...","why":"..."},
    "accent2":{"hex":"#rrggbb","name":"...","why":"..."},
    "accent3":{"hex":"#rrggbb","name":"...","why":"..."},
    "neutralDark":"#rrggbb","neutralLight":"#rrggbb",
    "fonts":{"heading":"...","body":"..."},
    "confidence":"high|medium|low",
    "rejected":[{"hex":"#rrggbb","why":"..."}]
  }
}}`;

const MAX_PROMPT_CHARS = 24_000;

/**
 * Wire into server.js exactly like handleDmAgent:
 *   import { handleEnrichAgent } from "./enrich-agent.js";
 *   // add "/enrich-agent" to the allowlist at line ~459, then:
 *   if (req.url === "/enrich-agent") {
 *     return handleEnrichAgent({ body, send, runClaude, extractJsonObject, isRateLimit });
 *   }
 * Every helper is passed in rather than imported so this file stays a leaf and
 * server.js keeps owning the subprocess, auth and timeout policy.
 */
export async function handleEnrichAgent({
  body,
  send,
  runClaude,
  extractJsonObject,
  isRateLimit,
}) {
  const prompt =
    typeof body?.prompt === "string"
      ? body.prompt.slice(0, MAX_PROMPT_CHARS)
      : "";
  if (!prompt.trim()) return send(400, { error: "prompt_required" });

  const startedAt = Date.now();
  const run = await runClaude({
    userPrompt: prompt,
    systemPrompt: ENRICH_SYSTEM_PROMPT,
    model: ENRICH_MODEL,
    tools: "", // judgement only — this agent must never fetch
    timeoutMs: ENRICH_TIMEOUT_MS,
    // The brief IS the system prompt, matching the shape of the Anookz gateway
    // call it replaces. Same answer as appending, in half the time.
    replaceSystemPrompt: true,
  });

  if (run.code !== 0) {
    if (isRateLimit(run.stderr, run.stdout)) {
      return send(503, {
        error: "rate_limited",
        durationMs: Date.now() - startedAt,
      });
    }
    console.error("enrich_agent_failed", {
      code: run.code,
      stderr: run.stderr.slice(0, 300),
    });
    return send(500, {
      error: "claude_failed",
      durationMs: Date.now() - startedAt,
    });
  }

  const parsed = extractJsonObject(run.stdout);
  if (!parsed) {
    console.error("enrich_agent_bad_json", {
      preview: run.stdout.slice(0, 300),
    });
    return send(500, {
      error: "bad_output",
      durationMs: Date.now() - startedAt,
    });
  }

  // The model may return {suggestion:{...}} or the bare object; accept both.
  const suggestion = parsed.suggestion ?? parsed;
  return send(200, { suggestion, durationMs: Date.now() - startedAt });
}
