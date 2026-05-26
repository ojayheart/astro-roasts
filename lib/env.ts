type PublicEnvSource = Record<string, string | undefined>;

function cleanEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getPublicEnv(env: PublicEnvSource = process.env) {
  return {
    paddleClientToken: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
    paddlePriceId: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_PRICE_ID),
    paddleEnvironment: cleanEnvValue(env.NEXT_PUBLIC_PADDLE_ENVIRONMENT),
  };
}
