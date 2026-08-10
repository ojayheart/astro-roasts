import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateRoast } from "@/inngest/pipeline";
import { generateAnnotations } from "@/inngest/annotations";
import {
  fanOutDailyRoasts,
  generateDailyRoast,
  generateMonthlyForecasts,
  generateYearlyForecasts,
} from "@/inngest/subscription";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateRoast,
    generateAnnotations,
    fanOutDailyRoasts,
    generateDailyRoast,
    generateMonthlyForecasts,
    generateYearlyForecasts,
  ],
});
