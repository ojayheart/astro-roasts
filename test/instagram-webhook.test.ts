import test from "node:test";
import assert from "node:assert/strict";
import {
  extractInstagramTextMessages,
  parseInstagramRoastRequest,
  verifyInstagramWebhookChallenge,
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
