import { createAgent, anthropic } from "@inngest/agent-kit";
import { ROAST_SYSTEM_PROMPT } from "@/lib/roast-prompt";

export const roastAgent = createAgent({
  name: "astro-roaster",
  description: "Generates brutally honest natal chart roasts",
  system: ROAST_SYSTEM_PROMPT,
  model: anthropic({
    model: "claude-sonnet-4-6",
    defaultParameters: { max_tokens: 4000 },
  }),
});
