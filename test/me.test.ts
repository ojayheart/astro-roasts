import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMePayload,
  parseBirthInput,
  parseDeviceInput,
  placementsFrom,
} from "../lib/me.ts";

const USER = {
  id: "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11",
  name: "Oliver",
  email: "o@example.com",
  dob: "1992-03-14",
  birthTime: "09:15",
  birthCity: "Munich, Germany",
  tz: "Europe/Berlin",
  onboardedAt: new Date("2026-08-01T10:00:00Z"),
};

test("birth input needs a real date and a place", () => {
  assert.deepEqual(
    parseBirthInput({ date: "1992-03-14", birthPlace: "  Munich,  Germany " }),
    { dob: "1992-03-14", birthTime: null, birthCity: "Munich, Germany" },
  );
  assert.equal(parseBirthInput({ birthPlace: "Munich" }), null);
  assert.equal(parseBirthInput({ date: "14/03/1992", birthPlace: "M" }), null);
  assert.equal(parseBirthInput({ date: "1992-03-14", birthPlace: "" }), null);
  assert.equal(parseBirthInput(null), null);
});

test("birth time is optional but must be HH:MM when given", () => {
  assert.equal(
    parseBirthInput({ date: "1992-03-14", birthPlace: "Munich", time: "09:15" })
      ?.birthTime,
    "09:15",
  );
  assert.equal(
    parseBirthInput({ date: "1992-03-14", birthPlace: "Munich", time: "" })
      ?.birthTime,
    null,
  );
  assert.equal(
    parseBirthInput({
      date: "1992-03-14",
      birthPlace: "Munich",
      time: "25:00",
    }),
    null,
  );
});

test("device input defaults notify hour to the schema default", () => {
  const token = "a".repeat(64);
  assert.deepEqual(
    parseDeviceInput({ apnsToken: token, tz: "Pacific/Auckland" }),
    {
      apnsToken: token,
      tz: "Pacific/Auckland",
      notifyHour: 8,
      build: null,
    },
  );
});

test("device input rejects a bad token, tz or hour", () => {
  const token = "b".repeat(64);
  assert.equal(parseDeviceInput({ apnsToken: "short", tz: "UTC" }), null);
  assert.equal(parseDeviceInput({ apnsToken: token, tz: "" }), null);
  assert.equal(parseDeviceInput({ apnsToken: token, tz: "Bad Zone" }), null);
  assert.equal(
    parseDeviceInput({ apnsToken: token, tz: "UTC", notifyHour: 24 }),
    null,
  );
  assert.equal(
    parseDeviceInput({ apnsToken: token, tz: "UTC", notifyHour: 7.5 }),
    null,
  );
  assert.equal(
    parseDeviceInput({ apnsToken: token, tz: "UTC", notifyHour: "8" }),
    null,
  );
});

test("placements collapse to null when the roast has none", () => {
  const empty = {
    sunSign: null,
    moonSign: null,
    rising: null,
    mercurySign: null,
    venusSign: null,
    marsSign: null,
    jupiterSign: null,
    saturnSign: null,
  };
  assert.equal(placementsFrom(empty), null);
  assert.equal(placementsFrom(undefined), null);
  assert.equal(
    placementsFrom({ ...empty, sunSign: "Pisces" })?.sunSign,
    "Pisces",
  );
});

test("me payload carries user, placements and entitlement", () => {
  const payload = buildMePayload(USER, null, true);
  assert.deepEqual(payload, {
    user: {
      id: USER.id,
      name: "Oliver",
      email: "o@example.com",
      dob: "1992-03-14",
      birthTime: "09:15",
      birthCity: "Munich, Germany",
      tz: "Europe/Berlin",
      onboardedAt: "2026-08-01T10:00:00.000Z",
    },
    placements: null,
    subscription: { subscribed: true },
  });
});

test("me payload never leaks an unsubscribed user into subscribed", () => {
  const payload = buildMePayload({ ...USER, onboardedAt: null }, null, false);
  assert.equal(payload.user.onboardedAt, null);
  assert.equal(payload.subscription.subscribed, false);
});
