/**
 * Provider-agnostic completion for subscription generation.
 *
 * Native Anthropic when ROAST_MODEL starts with "claude-", OpenAI-compatible
 * against OpenRouter otherwise. The voice block is always the first system
 * block and carries cache_control so the shared ~2k tokens read at 0.1×.
 * Monthly and yearly go through the Batch API (50% off, not latency-bound).
 */

import {
  ROAST_SYSTEM_PROMPT,
  ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
} from "./roast-prompt.ts";
import { VOICE_PRESETS } from "../inngest/prompts.ts";

export const DEFAULT_ROAST_MODEL = "claude-opus-5";
const DEFAULT_MAX_TOKENS = 4096;
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export type Provider = "anthropic" | "openrouter";

export type VoiceOptions = {
  hasBirthTime?: boolean;
  voicePreset?: string;
};

export type CompletionRequest = {
  prompt: string;
  voice?: VoiceOptions;
  /** Per-request system text appended after the cached voice block. */
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export type CompletionResult = {
  text: string;
  model: string;
  provider: Provider;
};

export type BatchItem = CompletionRequest & { customId: string };

export type BatchResult =
  { customId: string; text: string } | { customId: string; error: string };

type TextBlock = { type: "text"; text: string; cache_control?: CacheControl };
type CacheControl = { type: "ephemeral" };

type AnthropicRequestBody = {
  model: string;
  max_tokens: number;
  temperature?: number;
  system: TextBlock[];
  messages: { role: "user"; content: string }[];
};

type AnthropicMessage = { content: { type: string; text?: string }[] };

type AnthropicBatchEntry = {
  custom_id: string;
  result: {
    type: string;
    message?: AnthropicMessage;
    error?: { message?: string };
  };
};

/** The slice of the Anthropic SDK this module uses — lets tests inject a fake. */
export type AnthropicLike = {
  messages: {
    create(body: AnthropicRequestBody): Promise<AnthropicMessage>;
    batches: {
      create(body: {
        requests: { custom_id: string; params: AnthropicRequestBody }[];
      }): Promise<{ id: string }>;
      retrieve(id: string): Promise<{ processing_status: string }>;
      results(
        id: string,
      ):
        | AsyncIterable<AnthropicBatchEntry>
        | Promise<AsyncIterable<AnthropicBatchEntry>>;
    };
  };
};

export type Deps = {
  anthropic?: AnthropicLike;
  fetch?: typeof fetch;
};

export function resolveModel(model?: string): string {
  return (model || process.env.ROAST_MODEL || "").trim() || DEFAULT_ROAST_MODEL;
}

export function providerFor(model: string): Provider {
  return model.startsWith("claude-") ? "anthropic" : "openrouter";
}

/** The shared cached prefix — imported verbatim, never re-authored here. */
export function buildVoiceBlock(voice: VoiceOptions = {}): string {
  const base =
    voice.hasBirthTime === false
      ? ROAST_SYSTEM_PROMPT_NO_BIRTHTIME
      : ROAST_SYSTEM_PROMPT;
  const preset = voice.voicePreset
    ? VOICE_PRESETS[voice.voicePreset]
    : undefined;
  return preset ? `${base}\n\n## ${preset}` : base;
}

function systemBlocks(req: CompletionRequest): TextBlock[] {
  const blocks: TextBlock[] = [
    {
      type: "text",
      text: buildVoiceBlock(req.voice),
      cache_control: { type: "ephemeral" },
    },
  ];
  if (req.system) blocks.push({ type: "text", text: req.system });
  return blocks;
}

export function buildAnthropicBody(
  req: CompletionRequest,
  model: string,
): AnthropicRequestBody {
  return {
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
    system: systemBlocks(req),
    messages: [{ role: "user", content: req.prompt }],
  };
}

export function buildOpenAIBody(req: CompletionRequest, model: string) {
  return {
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
    messages: [
      { role: "system", content: systemBlocks(req) },
      { role: "user", content: req.prompt },
    ],
  };
}

function textOf(message: AnthropicMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
}

async function anthropicClient(deps: Deps): Promise<AnthropicLike> {
  if (deps.anthropic) return deps.anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: key }) as unknown as AnthropicLike;
}

async function completeOpenRouter(
  req: CompletionRequest,
  model: string,
  deps: Deps,
): Promise<CompletionResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing");
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(buildOpenAIBody(req, model)),
  });
  if (!res.ok) {
    throw new Error(
      `openrouter_${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return {
    text: (json.choices?.[0]?.message?.content || "").trim(),
    model,
    provider: "openrouter",
  };
}

export async function complete(
  req: CompletionRequest,
  deps: Deps = {},
): Promise<CompletionResult> {
  const model = resolveModel(req.model);
  if (providerFor(model) === "openrouter") {
    return completeOpenRouter(req, model, deps);
  }
  const client = await anthropicClient(deps);
  const message = await client.messages.create(buildAnthropicBody(req, model));
  return { text: textOf(message), model, provider: "anthropic" };
}

/**
 * Monthly and yearly only. OpenRouter has no batch surface, so a non-Anthropic
 * ROAST_MODEL falls back to serial `complete` calls at the caller's discretion
 * rather than silently losing the 50% discount.
 */
export async function submitBatch(
  items: BatchItem[],
  deps: Deps = {},
): Promise<{ batchId: string; model: string }> {
  if (!items.length) throw new Error("submitBatch: no items");
  const model = resolveModel(items[0].model);
  if (providerFor(model) !== "anthropic") {
    throw new Error(`batch unsupported for model ${model}`);
  }
  const client = await anthropicClient(deps);
  const batch = await client.messages.batches.create({
    requests: items.map((item) => ({
      custom_id: item.customId,
      params: buildAnthropicBody(item, resolveModel(item.model)),
    })),
  });
  return { batchId: batch.id, model };
}

export async function batchStatus(
  batchId: string,
  deps: Deps = {},
): Promise<string> {
  const client = await anthropicClient(deps);
  const batch = await client.messages.batches.retrieve(batchId);
  return batch.processing_status;
}

/** Results key back to the caller's custom_id — never to list order. */
export async function collectBatch(
  batchId: string,
  deps: Deps = {},
): Promise<BatchResult[]> {
  const client = await anthropicClient(deps);
  const stream = await client.messages.batches.results(batchId);
  const out: BatchResult[] = [];
  for await (const entry of stream) {
    if (entry.result.type === "succeeded" && entry.result.message) {
      out.push({
        customId: entry.custom_id,
        text: textOf(entry.result.message),
      });
    } else {
      out.push({
        customId: entry.custom_id,
        error: entry.result.error?.message || entry.result.type,
      });
    }
  }
  return out;
}
