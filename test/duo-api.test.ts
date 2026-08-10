import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDuoRequest,
  serveCreateDuo,
  serveDuo,
  serveDuoList,
  type DuoCreatePorts,
  type DuoDetail,
  type DuoListPorts,
  type DuoReadPorts,
  type DuoRow,
} from "../lib/duo-api.ts";
import type { PersonInput } from "../lib/group.ts";

const USER_ID = "8f2c1f9e-1c1a-4f6b-9a2e-0f3b7d5c1a11";
const DUO_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const ROAST_ID = "9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f";

const OWNER: PersonInput = {
  name: "Oliver",
  gender: "man",
  date: "1992-03-14",
  time: "09:15",
  birthPlace: "Munich, Germany",
};

const PARTNER = {
  name: "Mara",
  dob: "1994-11-02",
  birthTime: "18:40",
  birthPlace: "Lisbon, Portugal",
  relationship: "lovers",
};

const DUO: DuoRow = {
  id: DUO_ID,
  relationship: "lovers",
  createdAt: "2026-08-10T09:00:00.000Z",
  subjectName: "Mara",
  status: "generating",
  title: null,
  goldLine: null,
};

const READY: DuoDetail = {
  ...DUO,
  status: "ready",
  title: "Two Clocks, One Alarm",
  goldLine: "You call it compromise; the chart calls it attrition.",
  body: "…",
};

function createPorts(over: Partial<DuoCreatePorts> = {}): DuoCreatePorts {
  return {
    userId: async () => USER_ID,
    subscribed: async () => true,
    owner: async () => OWNER,
    create: async () => ({ duo: DUO, roastId: ROAST_ID }),
    dispatch: async () => {},
    ...over,
  };
}

function listPorts(over: Partial<DuoListPorts> = {}): DuoListPorts {
  return {
    userId: async () => USER_ID,
    subscribed: async () => true,
    list: async () => [DUO],
    ...over,
  };
}

function readPorts(over: Partial<DuoReadPorts> = {}): DuoReadPorts {
  return {
    userId: async () => USER_ID,
    subscribed: async () => true,
    find: async () => READY,
    ...over,
  };
}

test("no session is 401 on all three duo entry points", async () => {
  const none = { userId: async () => null };
  assert.equal((await serveCreateDuo(createPorts(none), PARTNER)).status, 401);
  assert.equal((await serveDuoList(listPorts(none))).status, 401);
  assert.equal((await serveDuo(readPorts(none), DUO_ID)).status, 401);
});

test("an unsubscribed user is 402, and nothing is created", async () => {
  let created = false;
  const reply = await serveCreateDuo(
    createPorts({
      subscribed: async () => false,
      create: async () => {
        created = true;
        throw new Error("create should not run");
      },
    }),
    PARTNER,
  );
  assert.equal(reply.status, 402);
  assert.deepEqual(reply.body, { error: "subscription_required" });
  assert.equal(created, false);
  assert.equal(
    (await serveDuoList(listPorts({ subscribed: async () => false }))).status,
    402,
  );
});

test("a duo creation persists first, then dispatches the group job", async () => {
  const order: string[] = [];
  let dispatched: {
    roastId: string;
    ownerId: string;
    relationship: string;
    people: PersonInput[];
  } | null = null;

  const reply = await serveCreateDuo(
    createPorts({
      create: async (input) => {
        order.push("create");
        assert.equal(input.ownerId, USER_ID);
        assert.equal(input.relationship, "lovers");
        assert.equal(input.people.length, 2);
        assert.equal(input.people[0].name, "Oliver");
        return { duo: DUO, roastId: ROAST_ID };
      },
      dispatch: async (input) => {
        order.push("dispatch");
        dispatched = input;
      },
    }),
    PARTNER,
  );

  assert.deepEqual(order, ["create", "dispatch"]);
  assert.equal(reply.status, 201);
  assert.deepEqual(reply.body, {
    duo: {
      id: DUO_ID,
      relationship: "lovers",
      subjectName: "Mara",
      createdAt: "2026-08-10T09:00:00.000Z",
      status: "generating",
      title: null,
      goldLine: null,
    },
  });
  assert.equal(dispatched!.roastId, ROAST_ID);
  assert.deepEqual(dispatched!.people[1], {
    name: "Mara",
    gender: "unspecified",
    date: "1994-11-02",
    time: "18:40",
    birthPlace: "Lisbon, Portugal",
  });
});

test("a partner missing birth details is 400, an owner without a chart is 404", async () => {
  assert.deepEqual(await serveCreateDuo(createPorts(), { name: "Mara" }), {
    status: 400,
    body: { error: "invalid_person" },
  });
  assert.deepEqual(
    await serveCreateDuo(createPorts({ owner: async () => null }), PARTNER),
    { status: 404, body: { error: "not_found" } },
  );
});

test("an unknown relationship falls back to the kind, a known one survives", () => {
  assert.equal(
    parseDuoRequest({ ...PARTNER, relationship: "partners" }, OWNER)
      ?.relationship,
    "partners",
  );
  assert.equal(
    parseDuoRequest({ ...PARTNER, relationship: 42 }, OWNER)?.relationship,
    "couple",
  );
});

test("the list is the caller's own duos", async () => {
  let asked: string | null = null;
  const reply = await serveDuoList(
    listPorts({
      list: async (ownerId) => {
        asked = ownerId;
        return [DUO];
      },
    }),
  );
  assert.equal(asked, USER_ID);
  assert.deepEqual(reply, { status: 200, body: { duos: [DUO] } });
});

test("a duo that is not the caller's reads as 404, not another user's roast", async () => {
  const reply = await serveDuo(readPorts({ find: async () => null }), DUO_ID);
  assert.deepEqual(reply, { status: 404, body: { error: "not_found" } });
});

test("a finished duo carries its body, an in-flight one carries nulls", async () => {
  const done = await serveDuo(readPorts(), DUO_ID);
  assert.equal(done.status, 200);
  assert.deepEqual(done.body, {
    duo: {
      id: DUO_ID,
      relationship: "lovers",
      subjectName: "Mara",
      createdAt: "2026-08-10T09:00:00.000Z",
      status: "ready",
      title: "Two Clocks, One Alarm",
      goldLine: "You call it compromise; the chart calls it attrition.",
      body: "…",
    },
  });

  const pending = await serveDuo(
    readPorts({
      find: async () => ({ ...DUO, body: null }),
    }),
    DUO_ID,
  );
  assert.deepEqual(pending.body, {
    duo: {
      id: DUO_ID,
      relationship: "lovers",
      subjectName: "Mara",
      createdAt: "2026-08-10T09:00:00.000Z",
      status: "generating",
      title: null,
      goldLine: null,
      body: null,
    },
  });
});
