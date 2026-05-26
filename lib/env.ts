type PublicEnvSource = Record<string, string | undefined>;

function cleanEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

// Read each NEXT_PUBLIC_* var via direct process.env access so Next.js
// can statically replace it at build time. Indirect access (e.g. via a
// destructured parameter) leaves the lookup at runtime, which returns
// undefined in client bundles.
export function getPublicEnv(env?: PublicEnvSource) {
  if (env) {
    return {
      paddleClientToken: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
      paddlePriceId: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_PRICE_ID),
      paddleEnvironment: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_ENVIRONMENT),
    };
  }

  return {
    paddleClientToken: cleanEnvValue(
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    ),
    paddlePriceId: cleanEnvValue(process.env.NEXT_PUBLIC_PADDLE_PRICE_ID),
    paddleEnvironment: cleanEnvValue(
      process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT,
    ),
  };
}
