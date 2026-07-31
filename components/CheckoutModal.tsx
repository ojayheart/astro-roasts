"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions, Appearance } from "@stripe/stripe-js";
import * as Sentry from "@sentry/nextjs";
import { getStripeJs } from "@/lib/stripe-client";
import { track } from "@/lib/track";
import CheckoutForm from "./CheckoutForm";

interface CheckoutModalProps {
  roastId: string;
  open: boolean;
  onClose: () => void;
  /** Called when a 100%-off code unlocked the roast without a card. */
  onUnlocked?: () => void;
}

interface IntentState {
  clientSecret: string;
  amount: number;
  currency: string;
}

type CodeState = "idle" | "checking" | "applied" | "unlocked";

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
    fontSizeBase: "16px",
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
      fontSize: "16px",
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
  onUnlocked,
}: CheckoutModalProps) {
  const [intent, setIntent] = useState<IntentState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [appliedPercent, setAppliedPercent] = useState<number | null>(null);

  // Codes are resolved server-side. A 100%-off code never reaches Stripe —
  // /api/redeem-code flips the roast and we reveal it straight away. Anything
  // less rebuilds the PaymentIntent at the discounted amount.
  const applyCode = async () => {
    const entered = code.trim();
    if (!entered || codeState === "checking") return;
    setCodeState("checking");
    setCodeError(null);
    track("promo_code_submitted", { roastId });

    try {
      const res = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roastId, code: entered }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        unlocked?: boolean;
        requiresPayment?: boolean;
        percentOff?: number;
        error?: string;
      };

      if (res.ok && data.unlocked) {
        track("promo_code_unlocked", { roastId });
        setCodeState("unlocked");
        onUnlocked?.();
        onClose();
        return;
      }

      if (res.ok && data.requiresPayment && data.percentOff) {
        track("promo_code_discounted", {
          roastId,
          percentOff: data.percentOff,
        });
        setAppliedPercent(data.percentOff);
        setCodeState("applied");
        setIntent(null);
        return;
      }

      setCodeState("idle");
      setCodeError(
        res.status === 429
          ? "Too many tries. Give it an hour."
          : "That code doesn't work.",
      );
    } catch {
      setCodeState("idle");
      setCodeError("Couldn't check that code. Try again.");
    }
  };

  useEffect(() => {
    if (!open || intent || loading) return;
    setLoading(true);
    setLoadError(null);
    track("checkout_modal_opened", { roastId });

    fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roastId,
        ...(appliedPercent ? { code: code.trim() } : {}),
      }),
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
        track("checkout_intent_loaded", {
          roastId,
          amount: data.amount ?? 500,
          currency: data.currency ?? "usd",
        });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Could not start checkout.";
        setLoadError(message);
        track("checkout_intent_failed", { roastId, error: message });
        Sentry.withScope((scope) => {
          scope.setTag("payment.provider", "stripe");
          scope.setContext("payment_intent_load", { roastId });
          Sentry.captureException(err);
        });
      })
      .finally(() => setLoading(false));
  }, [open, intent, loading, roastId, appliedPercent, code]);

  // Reset on close so re-opening creates a fresh intent (price geo can change,
  // or the user might have abandoned mid-flow with an expired client_secret).
  useEffect(() => {
    if (!open) {
      setIntent(null);
      setLoadError(null);
      setCode("");
      setCodeState("idle");
      setCodeError(null);
      setAppliedPercent(null);
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

  // Lock body scroll while open. iOS ignores `overflow: hidden`, so pin body
  // with `position: fixed` and restore scroll on close.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Backdrop close: require pointerdown AND pointerup on the backdrop itself,
  // so a drag that started inside the panel doesn't dismiss + reset intent.
  const pointerDownTarget = useRef<EventTarget | null>(null);

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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-void/85 backdrop-blur-sm overflow-y-auto overscroll-contain"
      style={{ height: "100dvh", width: "100vw" }}
      onPointerDown={(e) => {
        pointerDownTarget.current = e.target;
      }}
      onPointerUp={(e) => {
        if (
          pointerDownTarget.current === e.currentTarget &&
          e.target === e.currentTarget
        ) {
          onClose();
        }
        pointerDownTarget.current = null;
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div
        className="relative w-full max-w-md bg-void border border-ash/15 max-h-[95dvh] overflow-y-auto overscroll-contain"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="interactive absolute top-2 right-2 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-ash/60 hover:text-blood transition-colors font-mono text-xs uppercase tracking-[0.2em] z-10"
        >
          <span aria-hidden="true" className="hidden sm:inline">
            [esc]&nbsp;
          </span>
          close
        </button>

        <div className="px-6 pt-8 pb-6 border-b border-ash/10">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-blood">
            Unlock the full set
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

          {/* Promo code */}
          <div className="mt-8 pt-6 border-t border-ash/10">
            {appliedPercent ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-blood">
                {appliedPercent}% off applied
              </p>
            ) : (
              <>
                <label
                  htmlFor="promo-code"
                  className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ash/50 mb-2"
                >
                  Got a code?
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    name="promo-code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyCode();
                      }
                    }}
                    disabled={codeState === "checking"}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="CODE"
                    className="flex-1 min-w-0 bg-void border border-ash/15 text-ash font-mono text-sm uppercase tracking-[0.1em] px-3 py-3 focus:border-blood focus-visible:outline-none transition-colors placeholder:text-ash/25 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void applyCode()}
                    disabled={!code.trim() || codeState === "checking"}
                    className="interactive px-5 min-h-[44px] border border-ash/20 text-ash font-mono text-xs uppercase tracking-[0.15em] hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {codeState === "checking" ? "…" : "Apply"}
                  </button>
                </div>
                {codeError && (
                  <p
                    role="alert"
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-blood mt-2"
                  >
                    {codeError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
