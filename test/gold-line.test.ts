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
