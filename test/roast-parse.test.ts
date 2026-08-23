import { test } from "node:test";
import assert from "node:assert";
import { parseRoastOutput } from "../lib/roast-parse.ts";

const ROAST = "Sun conjunct Pluto in the eleventh.\n\nShe should give it.";
const HOOK = "Right. So the universe looked at November 1991 —";

test("keeps the teaser out of fullText when FULL precedes TEASER", () => {
    const raw = [
      "---ROAST_START---",
      "TITLE: Nuclear submarine",
      `FULL: ${ROAST}`,
      `TEASER: ${HOOK}`,
      "CALLOUTS: a|b|c",
      "---ROAST_END---",
    ].join("\n");

    const parsed = parseRoastOutput(raw);
    assert.equal(parsed.fullText, ROAST);
    assert.ok(!parsed.fullText.includes("TEASER:"));
    assert.ok(!parsed.fullText.includes(HOOK));
    assert.equal(parsed.teaser, HOOK);
    assert.equal(parsed.callouts, "a|b|c");
  });

test("parses the documented TEASER-then-FULL order", () => {
    const raw = [
      "---ROAST_START---",
      "TITLE: Nuclear submarine",
      `TEASER: ${HOOK}`,
      `FULL: ${ROAST}`,
      "CALLOUTS: a|b",
      "---ROAST_END---",
    ].join("\n");

    const parsed = parseRoastOutput(raw);
    assert.equal(parsed.fullText, ROAST);
    assert.equal(parsed.teaser, HOOK);
  });

test("survives a missing CALLOUTS section", () => {
    const raw = [
      "---ROAST_START---",
      `TEASER: ${HOOK}`,
      `FULL: ${ROAST}`,
      "---ROAST_END---",
    ].join("\n");

    const parsed = parseRoastOutput(raw);
    assert.equal(parsed.fullText, ROAST);
    assert.equal(parsed.callouts, "");
  });

test("treats unlabelled group-runner prose as the roast", () => {
    const raw = `---ROAST_START---\n${ROAST}\n---ROAST_END---`;
    const parsed = parseRoastOutput(raw);
    assert.equal(parsed.fullText, ROAST);
  });
