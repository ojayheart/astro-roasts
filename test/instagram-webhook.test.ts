import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  extractInstagramTextMessages,
  parseInstagramRoastRequest,
  verifyInstagramWebhookChallenge,
  detectGroupKeyword,
  parseInstagramGroupRequest,
  GROUP_TEMPLATE_MESSAGES,
  verifyInstagramWebhookSignature,
} from "../lib/instagram-webhook.ts";

test("Instagram webhook challenge verifies matching token", () => {
  const params = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": "verify-me",
    "hub.challenge": "12345",
  });

  assert.deepEqual(verifyInstagramWebhookChallenge(params, "verify-me"), {
    ok: true,
    challenge: "12345",
  });
});

test("Instagram webhook challenge rejects missing or wrong token", () => {
  const params = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": "wrong",
    "hub.challenge": "12345",
  });

  assert.deepEqual(verifyInstagramWebhookChallenge(params, "verify-me"), {
    ok: false,
  });
  assert.deepEqual(verifyInstagramWebhookChallenge(params, undefined), {
    ok: false,
  });
});

test("Instagram webhook extracts text messages and ignores echoes", () => {
  const payload = {
    entry: [
      {
        messaging: [
          {
            sender: { id: "sender-1" },
            recipient: { id: "ig-1" },
            message: { mid: "m-1", text: "hello" },
          },
          {
            sender: { id: "ig-1" },
            recipient: { id: "sender-1" },
            message: { mid: "m-2", text: "echo", is_echo: true },
          },
        ],
      },
    ],
  };

  assert.deepEqual(extractInstagramTextMessages(payload), [
    {
      senderId: "sender-1",
      recipientId: "ig-1",
      text: "hello",
      mid: "m-1",
    },
  ]);
});

test("Instagram roast request parses key-value DM text", () => {
  const parsed = parseInstagramRoastRequest(`
    Name: Ayumi
    Gender: woman
    DOB: 21 August 1986
    Time: 07:00
    Birthplace: Preston, England
  `);

  assert.deepEqual(parsed, {
    name: "Ayumi",
    gender: "woman",
    date: "21 August 1986",
    time: "07:00",
    birthPlace: "Preston, England",
  });
});

test("Instagram roast request requires name, date, and place", () => {
  assert.equal(parseInstagramRoastRequest("ROAST"), null);
  assert.equal(
    parseInstagramRoastRequest("Name: Ayumi\nDOB: 21 August 1986"),
    null,
  );
});

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

test("malformed group messages look like group and must not reach solo parser", () => {
  const seven = [1, 2, 3, 4, 5, 6, 7]
    .map((i) => `person ${i}:\nname: P${i}\ndob: 1990-01-01\nplace: Auckland`)
    .join("\n");
  assert.equal(parseInstagramGroupRequest(seven), null);
  assert.match(seven, /person\s*\d+\s*:/i);
  const missingDob =
    "person 1:\nname: A\ndob: 1990-01-01\nplace: X\nperson 2:\nname: B\nplace: Y";
  assert.equal(parseInstagramGroupRequest(missingDob), null);
  assert.match(missingDob, /person\s*\d+\s*:/i);
});

test("webhook signature verification with valid signature", () => {
  const secret = "test-secret";
  const body = '{"test":"data"}';
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyInstagramWebhookSignature(body, signature, secret), true);
});

test("webhook signature verification fails on tampered body", () => {
  const secret = "test-secret";
  const body = '{"test":"data"}';
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const tamperedBody = '{"test":"tampered"}';
  assert.equal(
    verifyInstagramWebhookSignature(tamperedBody, signature, secret),
    false,
  );
});

test("webhook signature verification passes with warning when secret missing", () => {
  const body = '{"test":"data"}';
  const signature = "sha256=abc123";
  assert.equal(
    verifyInstagramWebhookSignature(body, signature, undefined),
    true,
  );
});
