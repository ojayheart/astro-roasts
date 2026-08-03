import { test } from "node:test";
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import {
  buildAnnotationPrompt,
  handleChartAnnotations,
  parseAnnotationOutput,
  validateAnnotationInput,
} from "../ops/hermes-roast-runner/chart-annotations.js";

const body = {
  roastText: "You schedule spontaneity three weeks ahead.",
  elements: [
    {
      id: "planet:Sun",
      title: "Sun",
      facts: "Aquarius · 01°00′ · House 9",
    },
  ],
};

test("validates bounded annotation payloads", () => {
  assert.equal(validateAnnotationInput(body), null);
  assert.equal(
    validateAnnotationInput({ ...body, roastText: "" }),
    "roastText",
  );
  assert.equal(
    validateAnnotationInput({
      ...body,
      elements: Array(201).fill(body.elements[0]),
    }),
    "elements",
  );
  assert.equal(
    validateAnnotationInput({
      ...body,
      elements: [{ ...body.elements[0], id: "x".repeat(201) }],
    }),
    "element.id",
  );
});

test("builds a prompt with roast continuity and exact element ids", () => {
  const prompt = buildAnnotationPrompt(body);
  assert.match(prompt, /schedule spontaneity/);
  assert.match(prompt, /planet:Sun/);
  assert.match(prompt, /Aquarius/);
});

test("parses fenced JSON and keeps only safe known lines", () => {
  const output = `\`\`\`json
{"lines":[
  {"id":"planet:Sun","line":"  Your calendar has a calendar.  "},
  {"id":"planet:Moon","line":"unknown"},
  {"id":"planet:Sun","line":"${"x".repeat(301)}"}
]}
\`\`\``;

  assert.deepEqual(parseAnnotationOutput(output, new Set(["planet:Sun"])), [
    { id: "planet:Sun", line: "Your calendar has a calendar." },
  ]);
});

test("handles a successful Claude runner response", async () => {
  let sent:
    { tools: string; systemPrompt: string; [key: string]: unknown } | undefined;
  let response: { status: number; payload: unknown } | undefined;
  await handleChartAnnotations(
    body,
    (status: number, payload: unknown) => {
      response = { status, payload };
    },
    async (input: {
      tools: string;
      systemPrompt: string;
      [key: string]: unknown;
    }) => {
      sent = input;
      return {
        code: 0,
        stdout:
          '{"lines":[{"id":"planet:Sun","line":"Your calendar has a calendar."}]}',
        stderr: "",
      };
    },
  );

  assert.equal(sent?.tools, "");
  assert.match(sent?.systemPrompt ?? "", /micro-captions/);
  assert.deepEqual(response, {
    status: 200,
    payload: {
      lines: [{ id: "planet:Sun", line: "Your calendar has a calendar." }],
    },
  });
});

test("rejects invalid payloads before invoking Claude", async () => {
  let invoked = false;
  let response: { status: number; payload: unknown } | undefined;
  await handleChartAnnotations(
    { ...body, roastText: "" },
    (status: number, payload: unknown) => {
      response = { status, payload };
    },
    async () => {
      invoked = true;
      throw new Error("must not run");
    },
  );

  assert.equal(invoked, false);
  assert.deepEqual(response, {
    status: 400,
    payload: { error: "invalid_input", detail: "roastText" },
  });
});

test("Hermes server wires the authenticated chart-annotations route", async () => {
  const source = await readFile(
    new URL("../ops/hermes-roast-runner/server.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /req\.url !== "\/chart-annotations"/);
  assert.match(source, /handleChartAnnotations\(body, send, runClaude/);
});

const bigBody = {
  roastText: "You schedule spontaneity three weeks ahead.",
  elements: Array.from({ length: 30 }, (_, i) => ({
    id: `planet:${i}`,
    title: `Body ${i}`,
    facts: "Aquarius · 01°00′ · House 9",
  })),
};

test("splits a full chart into chunks and merges the lines", async () => {
  const sizes: number[] = [];
  let response: { status: number; payload: any } | undefined;

  await handleChartAnnotations(
    bigBody,
    (status: number, payload: unknown) => {
      response = { status, payload: payload as any };
    },
    async (input: { userPrompt: string; [key: string]: unknown }) => {
      const ids = [...input.userPrompt.matchAll(/^(planet:\d+) —/gm)].map(
        (m) => m[1],
      );
      sizes.push(ids.length);
      return {
        code: 0,
        stdout: JSON.stringify({
          lines: ids.map((id) => ({ id, line: `line for ${id}` })),
        }),
        stderr: "",
      };
    },
  );

  assert.deepEqual(sizes, [20, 10]);
  assert.equal(response?.status, 200);
  assert.equal(response?.payload.lines.length, 30);
});

test("keeps the lines from chunks that survive when one chunk dies", async () => {
  let call = 0;
  let response: { status: number; payload: any } | undefined;

  await handleChartAnnotations(
    bigBody,
    (status: number, payload: unknown) => {
      response = { status, payload: payload as any };
    },
    async (input: { userPrompt: string; [key: string]: unknown }) => {
      const ids = [...input.userPrompt.matchAll(/^(planet:\d+) —/gm)].map(
        (m) => m[1],
      );
      // First chunk (20 elements) times out the way a SIGTERM'd `claude -p`
      // does; the surviving 10-element chunk still gives the wheel its lines.
      if (call++ === 0) return { code: 143, stdout: "", stderr: "" };
      return {
        code: 0,
        stdout: JSON.stringify({
          lines: ids.map((id) => ({ id, line: `line for ${id}` })),
        }),
        stderr: "",
      };
    },
  );

  assert.equal(response?.status, 200);
  assert.equal(response?.payload.lines.length, 10);
});

test("reports rate limiting only when every chunk fails", async () => {
  let response: { status: number; payload: unknown } | undefined;

  await handleChartAnnotations(
    bigBody,
    (status: number, payload: unknown) => {
      response = { status, payload };
    },
    async () => ({ code: 1, stdout: "", stderr: "429 rate limit exceeded" }),
  );

  assert.deepEqual(response, {
    status: 503,
    payload: { error: "rate_limited" },
  });
});
