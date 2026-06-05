interface SentryInitInput {
  dsn?: string;
  environment?: string;
  release?: string;
  nodeEnv?: string;
}

export interface SentryInitOptions {
  dsn?: string;
  enabled: boolean;
  environment?: string;
  release?: string;
  sendDefaultPii: false;
  tracesSampleRate: number;
}

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function buildSentryInitOptions({
  dsn,
  environment,
  release,
  nodeEnv,
}: SentryInitInput): SentryInitOptions {
  const cleanDsn = cleanEnv(dsn);
  const cleanEnvironment = cleanEnv(environment) || cleanEnv(nodeEnv);
  const cleanRelease = cleanEnv(release);

  return {
    ...(cleanDsn ? { dsn: cleanDsn } : {}),
    enabled: Boolean(cleanDsn),
    ...(cleanEnvironment ? { environment: cleanEnvironment } : {}),
    ...(cleanRelease ? { release: cleanRelease } : {}),
    sendDefaultPii: false,
    tracesSampleRate: nodeEnv === "development" ? 1 : 0.1,
  };
}
