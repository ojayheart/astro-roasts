"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions, Appearance } from "@stripe/stripe-js";
import * as Sentry from "@sentry/nextjs";
import { getStripeJs } from "@/lib/stripe-client";
import CheckoutForm from "./CheckoutForm";

interface CheckoutModalProps {
  roastId: string;
  open: boolean;
  onClose: () => void;
}

interface IntentState {
  clientSecret: string;
  amount: number;
  currency: string;
}

const APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#ff2a00",
    colorBackground: "#0a0a0a",
    colorText: "#e5e5e5",
    colorTextSecondary: "#a1a1a1",
    colorTextPlaceholder: "#737373",
    colorDanger: "#ff2a00",
    colorSuccess: "#e5e5e5",
    fontFamily: '"DM Mono", ui-monospace, SFMono-Regular, monospace',
    fontSizeBase: "14px",
    fontWeightNormal: "400",
    fontWeightBold: "600",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      backgroundColor: "#030303",
      border: "1px solid rgba(229,229,229,0.15)",
      padding: "14px 12px",
      transition: "border-color 0.2s",
    },
    ".Input:focus": {
      border: "1px solid #ff2a00",
      boxShadow: "none",
      outline: "none",
    },
    ".Input--invalid": {
      border: "1px solid #ff2a00",
    },
    ".Label": {
      fontFamily: '"DM Mono", monospace',
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "rgba(229,229,229,0.6)",
      marginBottom: "6px",
    },
    ".Tab": {
      backgroundColor: "#0a0a0a",
      border: "1px solid rgba(229,229,229,0.15)",
      borderRadius: "0px",
    },
    ".Tab--selected": {
      borderColor: "#ff2a00",
      color: "#e5e5e5",
    },
    ".Error": {
      color: "#ff2a00",
      fontFamily: '"DM Mono", monospace',
      fontSize: "11px",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },
};

export default function CheckoutModal({
  roastId,
  open,
  onClose,
}: CheckoutModalProps) {
  const [intent, setIntent] = useState<IntentState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || intent || loading) return;
    setLoading(true);
    setLoadError(null);

    fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roastId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          clientSecret?: string;
          amount?: number;
          currency?: string;
          error?: string;
        };
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error ?? "Could not start checkout.");
        }
        setIntent({
          clientSecret: data.clientSecret,
          amount: data.amount ?? 500,
          currency: data.currency ?? "usd",
        });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not start checkout.";
        setLoadError(message);
        Sentry.withScope((scope) => {
          scope.setTag("payment.provider", "stripe");
          scope.setContext("payment_intent_load", { roastId });
          Sentry.captureException(err);
        });
      })
      .finally(() => setLoading(false));
  }, [open, intent, loading, roastId]);

  // Reset on close so re-opening creates a fresh intent (price geo can change,
  // or the user might have abandoned mid-flow with an expired client_secret).
  useEffect(() => {
    if (!open) {
      setIntent(null);
      setLoadError(null);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const elementsOptions: StripeElementsOptions | null = intent
    ? {
        clientSecret: intent.clientSecret,
        appearance: APPEARANCE,
        loader: "auto",
      }
    : null;

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/roast/${roastId}?paid=1`
      : `/roast/${roastId}?paid=1`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-void/85 backdrop-blur-sm overflow-y-auto"
      style={{ height: "100vh", width: "100vw" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div
        className="relative w-full max-w-md bg-void border border-ash/15 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="interactive absolute top-4 right-4 text-ash/60 hover:text-blood transition-colors font-mono text-xs uppercase tracking-[0.2em] z-10"
        >
          [esc] close
        </button>

        <div className="px-6 pt-8 pb-6 border-b border-ash/10">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-blood">
            Unlock the dossier
          </span>
          <h2 className="font-syne text-2xl md:text-3xl font-extrabold uppercase tracking-tighter mt-2">
            Full roast.
            <br />
            Every planet.
          </h2>
        </div>

        <div className="px-6 py-8">
          {loadError ? (
            <div className="space-y-4">
              <p className="text-blood font-mono text-xs uppercase tracking-[0.15em]">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setIntent(null);
                }}
                className="interactive font-mono text-xs uppercase tracking-[0.2em] text-ash/60 underline hover:text-blood"
              >
                Try again
              </button>
            </div>
          ) : elementsOptions ? (
            <Elements
              stripe={getStripeJs()}
              options={elementsOptions}
              key={intent?.clientSecret}
            >
              <CheckoutForm
                roastId={roastId}
                amount={intent!.amount}
                currency={intent!.currency}
                returnUrl={returnUrl}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-12">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-ash/60">
                Preparing checkout…
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
