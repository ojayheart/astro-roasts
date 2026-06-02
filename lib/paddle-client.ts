export interface PaddleEvent {
  name?: string;
  data?: unknown;
}

export interface PaddleInitializeOptions {
  token: string;
  eventCallback?: (event: PaddleEvent) => void;
}

export interface PaddleBrowserApi {
  Environment?: {
    set: (environment: "sandbox") => void;
  };
  Initialize: (options: PaddleInitializeOptions) => void;
  Checkout: {
    open: (options: Record<string, unknown>) => void;
  };
}

interface InitializePaddleCheckoutInput {
  paddle: PaddleBrowserApi;
  token: string;
  environment?: string;
  eventCallback?: (event: PaddleEvent) => void;
}

function getPaddleEnvironment(environment: string | undefined) {
  return environment?.trim() === "sandbox" ? "sandbox" : undefined;
}

export function initializePaddleCheckout({
  paddle,
  token,
  environment,
  eventCallback,
}: InitializePaddleCheckoutInput) {
  const paddleEnvironment = getPaddleEnvironment(environment);

  if (paddleEnvironment) {
    if (!paddle.Environment?.set) {
      throw new Error("Paddle sandbox environment API is unavailable.");
    }

    paddle.Environment.set(paddleEnvironment);
  }

  paddle.Initialize({
    token: token.trim(),
    eventCallback,
  });
}

export function isPaddleCheckoutReady({
  paddle,
  priceId,
  initialized,
}: {
  paddle?: PaddleBrowserApi;
  priceId?: string;
  initialized?: boolean;
}) {
  return Boolean(paddle && priceId?.trim() && initialized);
}
