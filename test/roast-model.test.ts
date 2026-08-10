import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROAST_MODEL,
  batchStatus,
  buildAnthropicBody,
  buildOpenAIBody,
  buildVoiceBlock,
  collectBatch,
  complete,
  providerFor,
  resolveModel,
  submitBatch,
} from "../lib/roast-model.ts";
import {
  ROAST_SYSTEM_PROMPT,
  ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
} from "../lib/roast-prompt.ts";
import { VOICE_PRESETS } from "../inngest/prompts.ts";

function fakeAnthropic(recorder: { body?: unknown; batch?: unknown } = {}) {
  return {
    recorder,
    client: {
      messages: {
        create: async (body: unknown) => {
          recorder.body = body;
          return { content: [{ type: "text", text: "  a roast  " }] };
        },
        batches: {
          create: async (body: unknown) => {
            recorder.batch = body;
            return { id: "batch_123" };
          },
          retrieve: async () => ({ processing_status: "ended" }),
          results: async function* () {
            yield {
              custom_id: "monthly:u2:2026-09",
              result: {
                type: "succeeded",
                message: { content: [{ type: "text", text: "second" }] },
              },
            };
            yield {
              custom_id: "monthly:u1:2026-09",
              result: { type: "errored", error: { message: "overloaded" } },
            };
          },
        },
      },
    },
  };
}

test("the default model is claude-opus-5 and selects the native provider", () => {
  delete process.env.ROAST_MODEL;
  assert.equal(resolveModel(), DEFAULT_ROAST_MODEL);
  assert.equal(DEFAULT_ROAST_MODEL, "claude-opus-5");
  assert.equal(providerFor(resolveModel()), "anthropic");
});

test("ROAST_MODEL overrides the default and drives provider selection", () => {
  process.env.ROAST_MODEL = "qwen/qwen3.8-max";
  assert.equal(resolveModel(), "qwen/qwen3.8-max");
  assert.equal(providerFor(resolveModel()), "openrouter");
  process.env.ROAST_MODEL = "  claude-sonnet-5  ";
  assert.equal(resolveModel(), "claude-sonnet-5");
  assert.equal(providerFor(resolveModel()), "anthropic");
  delete process.env.ROAST_MODEL;
});

test("an explicit request model beats the env var", () => {
  process.env.ROAST_MODEL = "claude-opus-5";
  assert.equal(resolveModel("moonshotai/kimi-k3"), "moonshotai/kimi-k3");
  delete process.env.ROAST_MODEL;
});

test("the voice block is the imported prompt text, never re-authored", () => {
  assert.equal(buildVoiceBlock(), ROAST_SYSTEM_PROMPT);
  assert.equal(
    buildVoiceBlock({ hasBirthTime: false }),
    ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
  );
  const preset = Object.keys(VOICE_PRESETS)[0];
  const withPreset = buildVoiceBlock({ voicePreset: preset });
  assert.ok(withPreset.startsWith(ROAST_SYSTEM_PROMPT));
  assert.ok(withPreset.includes(VOICE_PRESETS[preset]));
});

test("cache_control sits on the voice block and nothing else", () => {
  const body = buildAnthropicBody(
    { prompt: "today", system: "per-request brief" },
    "claude-opus-5",
  );
  assert.equal(body.system.length, 2);
  assert.equal(body.system[0].text, ROAST_SYSTEM_PROMPT);
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.equal(body.system[1].text, "per-request brief");
  assert.equal(body.system[1].cache_control, undefined);
  assert.deepEqual(body.messages, [{ role: "user", content: "today" }]);
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.temperature, undefined);
});

test("the OpenAI-compatible body carries the same cached voice prefix", () => {
  const body = buildOpenAIBody(
    { prompt: "today", maxTokens: 700, temperature: 1 },
    "qwen/qwen3.8-max",
  );
  assert.equal(body.model, "qwen/qwen3.8-max");
  assert.equal(body.max_tokens, 700);
  assert.equal(body.temperature, 1);
  const system = body.messages[0];
  assert.equal(system.role, "system");
  assert.deepEqual(system.content, [
    {
      type: "text",
      text: ROAST_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ]);
  assert.deepEqual(body.messages[1], { role: "user", content: "today" });
});

test("complete routes claude- models to the injected Anthropic client", async () => {
  const fake = fakeAnthropic();
  const result = await complete(
    { prompt: "roast me", model: "claude-opus-5" },
    { anthropic: fake.client },
  );
  assert.deepEqual(result, {
    text: "a roast",
    model: "claude-opus-5",
    provider: "anthropic",
  });
  assert.ok(fake.recorder.body);
});

test("complete routes everything else to OpenRouter over the injected fetch", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let seen: { url: string; auth: string; model: string } | null = null;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    seen = {
      url,
      auth: headers.authorization,
      model: JSON.parse(String(init.body)).model,
    };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: " qwen text " } }],
      }),
    };
  }) as unknown as typeof fetch;

  const result = await complete(
    { prompt: "roast me", model: "qwen/qwen3.8-max" },
    { fetch: fakeFetch },
  );
  assert.deepEqual(result, {
    text: "qwen text",
    model: "qwen/qwen3.8-max",
    provider: "openrouter",
  });
  assert.equal(seen!.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(seen!.auth, "Bearer test-key");
  assert.equal(seen!.model, "qwen/qwen3.8-max");
  delete process.env.OPENROUTER_API_KEY;
});

test("an OpenRouter error surfaces rather than returning empty text", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  const fakeFetch = (async () => ({
    ok: false,
    status: 402,
    text: async () => "insufficient credit",
  })) as unknown as typeof fetch;
  await assert.rejects(
    complete(
      { prompt: "x", model: "moonshotai/kimi-k3" },
      { fetch: fakeFetch },
    ),
    /openrouter_402/,
  );
  delete process.env.OPENROUTER_API_KEY;
});

test("a missing OpenRouter key fails loudly and never falls back", async () => {
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(
    complete({ prompt: "x", model: "qwen/qwen3.8-max" }, {}),
    /OPENROUTER_API_KEY missing/,
  );
});

test("submitBatch sends one custom_id-keyed request per item", async () => {
  const fake = fakeAnthropic();
  const { batchId, model } = await submitBatch(
    [
      { customId: "monthly:u1:2026-09", prompt: "u1", model: "claude-opus-5" },
      { customId: "monthly:u2:2026-09", prompt: "u2", model: "claude-opus-5" },
    ],
    { anthropic: fake.client },
  );
  assert.equal(batchId, "batch_123");
  assert.equal(model, "claude-opus-5");
  const body = fake.recorder.batch as {
    requests: {
      custom_id: string;
      params: ReturnType<typeof buildAnthropicBody>;
    }[];
  };
  assert.equal(body.requests.length, 2);
  assert.deepEqual(
    body.requests.map((r) => r.custom_id),
    ["monthly:u1:2026-09", "monthly:u2:2026-09"],
  );
  assert.deepEqual(body.requests[0].params.system[0].cache_control, {
    type: "ephemeral",
  });
  assert.equal(body.requests[1].params.messages[0].content, "u2");
});

test("batch is refused for a non-Anthropic model instead of silently degrading", async () => {
  await assert.rejects(
    submitBatch(
      [{ customId: "a", prompt: "x", model: "qwen/qwen3.8-max" }],
      {},
    ),
    /batch unsupported/,
  );
  await assert.rejects(submitBatch([], {}), /no items/);
});

test("collectBatch keys results back by custom_id, not by order", async () => {
  const fake = fakeAnthropic();
  const results = await collectBatch("batch_123", { anthropic: fake.client });
  assert.deepEqual(results, [
    { customId: "monthly:u2:2026-09", text: "second" },
    { customId: "monthly:u1:2026-09", error: "overloaded" },
  ]);
  assert.equal(
    await batchStatus("batch_123", { anthropic: fake.client }),
    "ended",
  );
});

test("no provider key is baked into the module", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    new URL("../lib/roast-model.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!/sk-[a-zA-Z0-9-]{8}/.test(src));
  assert.ok(src.includes("process.env.ANTHROPIC_API_KEY"));
  assert.ok(src.includes("process.env.OPENROUTER_API_KEY"));
});
