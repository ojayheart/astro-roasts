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
