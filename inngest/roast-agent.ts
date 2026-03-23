import { createAgent, anthropic } from "@inngest/agent-kit";
import {
  ROAST_SYSTEM_PROMPT,
  ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
} from "@/lib/roast-prompt";

export const roastAgent = createAgent({
  name: "astro-roaster",
  description: "Generates narrative-woven comedic natal chart roasts",
  system: ROAST_SYSTEM_PROMPT,
  model: anthropic({
    model: "claude-sonnet-4-6",
    defaultParameters: { max_tokens: 4000 },
  }),
});

export const roastAgentNoBirthTime = createAgent({
  name: "astro-roaster-no-birthtime",
  description: "Generates comedic natal chart roasts without birth time data",
  system: ROAST_SYSTEM_PROMPT_NO_BIRTHTIME,
  model: anthropic({
    model: "claude-sonnet-4-6",
    defaultParameters: { max_tokens: 4000 },
  }),
});
