"use client";

import * as Sentry from "@sentry/nextjs";
import Script from "next/script";
import {
  initializePaddleCheckout,
  type PaddleBrowserApi,
} from "@/lib/paddle-client";
import { buildPaddleCheckoutErrorContext } from "@/lib/sentry-config";

declare global {
  interface Window {
    Paddle?: PaddleBrowserApi;
    __astroRoastsPaddleInitialized?: boolean;
  }
}

const paddleClientToken =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? "";
const paddleEnvironment =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT?.trim() ?? "";

function initializePaddle() {
  window.__astroRoastsPaddleInitialized = false;

  if (!window.Paddle || !paddleClientToken) {
    const error = new Error("Paddle checkout is not ready.");
    console.error(error.message);
    Sentry.captureException(error);
    return;
  }

  try {
    initializePaddleCheckout({
      paddle: window.Paddle,
      token: paddleClientToken,
      environment: paddleEnvironment,
      eventCallback: (event) => {
        if (event?.name === "checkout.payment.failed") {
          Sentry.withScope((scope) => {
            scope.setTag("payment.provider", "paddle");
            scope.setContext(
              "paddle_checkout",
              buildPaddleCheckoutErrorContext({
                eventName: event.name,
                eventData: event.data,
              }),
            );
            Sentry.captureMessage("Paddle checkout payment failed", "error");
          });
        }

        if (event?.name === "checkout.completed") {
          document.dispatchEvent(
            new CustomEvent("paddle:checkout:completed", {
              detail: { name: event.name, data: event.data },
            }),
          );
        }
      },
    });
    window.__astroRoastsPaddleInitialized = true;
  } catch (error) {
    console.error("Paddle checkout initialization failed:", error);
    Sentry.captureException(error);
  }
}

export default function PaddleScript() {
  return (
    <Script
      src="https://cdn.paddle.com/paddle/v2/paddle.js"
      strategy="afterInteractive"
      onLoad={initializePaddle}
      onReady={initializePaddle}
    />
  );
}
