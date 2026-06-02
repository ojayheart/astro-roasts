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

interface PaddleCheckoutErrorInput {
  roastId?: string;
  priceId?: string;
  eventName?: string;
  eventData?: unknown;
}

export interface PaddleCheckoutErrorContext {
  [key: string]: unknown;
  roastId?: string;
  priceId?: string;
  eventName?: string;
  checkoutStatus?: string;
  transactionId?: string;
}

function cleanEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

export function buildPaddleCheckoutErrorContext({
  roastId,
  priceId,
  eventName,
  eventData,
}: PaddleCheckoutErrorInput): PaddleCheckoutErrorContext {
  const data = readObject(eventData);

  return {
    ...(roastId ? { roastId } : {}),
    ...(priceId ? { priceId } : {}),
    ...(eventName ? { eventName } : {}),
    ...(readString(data.status)
      ? { checkoutStatus: readString(data.status) }
      : {}),
    ...(readString(data.transaction_id) || readString(data.transactionId)
      ? {
          transactionId:
            readString(data.transaction_id) || readString(data.transactionId),
        }
      : {}),
  };
}
