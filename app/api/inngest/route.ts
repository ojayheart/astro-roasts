import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateRoast } from "@/inngest/pipeline";
import { generateAnnotations } from "@/inngest/annotations";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateRoast, generateAnnotations],
});
