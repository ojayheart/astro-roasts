import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "./lib/sentry-config";

Sentry.init(
  buildSentryInitOptions({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
    nodeEnv: process.env.NODE_ENV,
  }),
);
