import { test } from "node:test";
import assert from "node:assert";
import {
  groupAmountMinorUnits,
  isRelationshipType,
  normalizeRelationship,
  validateGroupRequest,
} from "../lib/group.ts";

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

test("groupAmountMinorUnits rejects < 2 people", () => {
  assert.throws(
    () => groupAmountMinorUnits(1),
    /Group pricing requires at least 2 people/,
  );
  assert.throws(
    () => groupAmountMinorUnits(0),
    /Group pricing requires at least 2 people/,
  );
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

test("time field: oversize rejected, whitespace coerced to null", () => {
  assert.equal(
    validateGroupRequest("couple", [
      p("A"),
      { ...p("B"), time: "x".repeat(41) },
    ]).ok,
    false,
  );
  const result = validateGroupRequest("couple", [
    p("A"),
    { ...p("B"), time: "  " },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) assert.strictEqual(result.people[1].time, null);
});

test("relationship allowlist accepts known types, rejects junk", () => {
  assert.equal(isRelationshipType("siblings"), true);
  assert.equal(isRelationshipType("lovers"), true);
  assert.equal(isRelationshipType("Siblings"), false); // exact match only
  assert.equal(isRelationshipType("nemeses"), false);
  assert.equal(isRelationshipType(undefined), false);
  assert.equal(isRelationshipType(7), false);
});

test("relationship falls back to kind when absent or invalid", () => {
  assert.equal(normalizeRelationship("friends", "couple"), "friends");
  assert.equal(normalizeRelationship(undefined, "couple"), "couple");
  assert.equal(normalizeRelationship("<script>", "couple"), "couple");
  assert.equal(normalizeRelationship(null, "family"), "family");
});
