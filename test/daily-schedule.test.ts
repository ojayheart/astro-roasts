import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyCohort,
  dueDevices,
  localHour,
  runDailyJob,
  type DailyJobPorts,
  type DeviceRow,
  type FanOutPorts,
} from "../lib/daily-schedule.ts";
import type { BirthInput, DailyTransits } from "../lib/transits.ts";

const AUCKLAND = "3f1b1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
const KATHMANDU = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

// 2026-08-10T20:20Z → Auckland 08:20 (+12), Kathmandu 02:05 (+5:45).
const NOW = new Date("2026-08-10T20:20:00Z");

const DEVICES: DeviceRow[] = [
  { userId: AUCKLAND, tz: "Pacific/Auckland", notifyHour: 8 },
  { userId: KATHMANDU, tz: "Asia/Kathmandu", notifyHour: 2 },
];

function ports(over: Partial<FanOutPorts> = {}): FanOutPorts {
  return {
    devices: async () => DEVICES,
    subscribed: async () => true,
    ...over,
  };
}

test("the local hour follows a whole-hour offset", () => {
  assert.equal(localHour("Pacific/Auckland", NOW), 8);
  assert.equal(localHour("UTC", NOW), 20);
});

test("a 45-minute offset still lands on the right hour", () => {
  assert.equal(localHour("Asia/Kathmandu", NOW), 2);
  assert.equal(
    localHour("Asia/Kathmandu", new Date("2026-08-10T20:16:00Z")),
    2,
  );
  // 20:14Z is 01:59 in Kathmandu — the hour has not turned over yet.
  assert.equal(
    localHour("Asia/Kathmandu", new Date("2026-08-10T20:14:00Z")),
    1,
  );
});

test("midnight reads as 0, not 24", () => {
  assert.equal(localHour("UTC", new Date("2026-08-10T00:05:00Z")), 0);
});

test("an unknown timezone is skipped rather than pushed at the wrong hour", () => {
  assert.equal(localHour("Mars/Olympus", NOW), null);
  assert.deepEqual(
    dueDevices([{ userId: AUCKLAND, tz: "Mars/Olympus", notifyHour: 8 }], NOW),
    [],
  );
});

test("both timezones come due on their own local hour", () => {
  const due = dueDevices(DEVICES, NOW);
  assert.deepEqual(
    due.map((entry) => entry.userId),
    [AUCKLAND, KATHMANDU],
  );
  // The date is the handset's calendar day, not UTC's.
  assert.equal(due[0].date, "2026-08-11");
  assert.equal(due[1].date, "2026-08-11");
});

test("a device whose notify hour is not now is left alone", () => {
  const due = dueDevices(
    [{ userId: AUCKLAND, tz: "Pacific/Auckland", notifyHour: 9 }],
    NOW,
  );
  assert.deepEqual(due, []);
});

test("two handsets on the same account are one push", () => {
  const due = dueDevices(
    [
      ...DEVICES,
      { userId: AUCKLAND, tz: "Pacific/Auckland", notifyHour: 8 },
      { userId: AUCKLAND, tz: "UTC", notifyHour: 20 },
    ],
    NOW,
  );
  assert.equal(due.filter((entry) => entry.userId === AUCKLAND).length, 1);
});

test("a non-subscribed user is dropped from the cohort", async () => {
  const cohort = await dailyCohort(
    ports({ subscribed: async (userId) => userId === KATHMANDU }),
    NOW,
  );
  assert.deepEqual(
    cohort.map((entry) => entry.userId),
    [KATHMANDU],
  );
});

test("nobody due means nobody asked about entitlement", async () => {
  const asked: string[] = [];
  const cohort = await dailyCohort(
    ports({
      devices: async () => [
        { userId: AUCKLAND, tz: "Pacific/Auckland", notifyHour: 17 },
      ],
      subscribed: async (userId) => {
        asked.push(userId);
        return true;
      },
    }),
    NOW,
  );
  assert.deepEqual(cohort, []);
  assert.deepEqual(asked, []);
});

const ROAST = {
  title: "Tuesday, Again",
  goldLine: "Mars is not your alibi.",
  body: "You will call it timing.",
};

const BIRTH = { name: "Oliver" } as unknown as BirthInput;
const DAILY = { date: "2026-08-11" } as unknown as DailyTransits;

function jobPorts(
  over: Partial<DailyJobPorts> = {},
  generated: string[] = [],
): DailyJobPorts {
  return {
    subscribed: async () => true,
    find: async () => null,
    birth: async () => BIRTH,
    generate: async (_birth, date) => {
      generated.push(date);
      return { roast: ROAST, transits: DAILY };
    },
    save: async () => undefined,
    ...over,
  };
}

test("a daily that is ready or still generating is never generated twice", async () => {
  for (const status of ["ready", "generating"]) {
    const generated: string[] = [];
    const saved: string[] = [];
    const result = await runDailyJob(
      jobPorts(
        {
          find: async () => ({ status }),
          save: async (userId) => saved.push(userId),
        },
        generated,
      ),
      AUCKLAND,
      "2026-08-11",
    );
    assert.deepEqual(result, { userId: AUCKLAND, skipped: "cached" });
    assert.deepEqual(generated, [], `${status} still reached generate()`);
    assert.deepEqual(saved, []);
  }
});

test("a failed daily is retried, and a user with no row is generated", async () => {
  for (const find of [
    async () => null,
    async () => ({ status: "error" }),
  ] as DailyJobPorts["find"][]) {
    const generated: string[] = [];
    const result = await runDailyJob(
      jobPorts({ find }, generated),
      AUCKLAND,
      "2026-08-11",
    );
    assert.deepEqual(result, {
      userId: AUCKLAND,
      date: "2026-08-11",
      status: "ready",
    });
    assert.deepEqual(generated, ["2026-08-11"]);
  }
});

test("a lapsed subscriber is skipped before anything is computed", async () => {
  const generated: string[] = [];
  const result = await runDailyJob(
    jobPorts({ subscribed: async () => false }, generated),
    AUCKLAND,
    "2026-08-11",
  );
  assert.deepEqual(result, { userId: AUCKLAND, skipped: "not_subscribed" });
  assert.deepEqual(generated, []);
});

test("no birth details and no transits are distinct skips, never a blank roast", async () => {
  assert.deepEqual(
    await runDailyJob(
      jobPorts({ birth: async () => null }),
      AUCKLAND,
      "2026-08-11",
    ),
    { userId: AUCKLAND, skipped: "no_birth" },
  );
  assert.deepEqual(
    await runDailyJob(
      jobPorts({ generate: async () => null }),
      AUCKLAND,
      "2026-08-11",
    ),
    { userId: AUCKLAND, skipped: "no_transits" },
  );
});
