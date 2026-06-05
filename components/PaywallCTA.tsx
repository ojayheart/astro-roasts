"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

interface PaywallCTAProps {
  roastId: string;
}

export default function PaywallCTA({ roastId }: PaywallCTAProps) {
  const [loading, setLoading] = useState(false);

  const captureCheckoutError = (error: unknown) => {
    Sentry.withScope((scope) => {
      scope.setTag("payment.provider", "stripe");
      scope.setContext("stripe_checkout", { roastId });
      Sentry.captureException(error);
    });
  };

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roastId }),
      });

      if (!res.ok) {
        let message = "Checkout could not start.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* ignore parse errors */
        }
        const error = new Error(`Checkout failed: ${message}`);
        captureCheckoutError(error);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        captureCheckoutError(new Error("Checkout response missing url"));
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      captureCheckoutError(error);
      setLoading(false);
    }
  };

  return (
    <div className="paywall-ui fixed bottom-0 left-0 w-full pt-32 pb-8 px-6 paywall-gradient z-50 flex flex-col items-center justify-end pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md flex flex-col items-center">
        <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
          Full dossier: every planet, house, aspect, and callback.
        </span>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 text-center text-lg md:text-xl hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
            {loading ? "Opening checkout…" : "Unlock the full roast — $5"}
          </span>
        </button>
        <span className="text-[10px] font-mono tracking-[0.15em] text-ash/40 mt-3 uppercase text-center">
          Entertainment only · satire · not advice
        </span>
      </div>
    </div>
  );
}
