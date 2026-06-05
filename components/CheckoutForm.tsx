"use client";

import { useState, type FormEvent } from "react";
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type {
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementOptions,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";
import * as Sentry from "@sentry/nextjs";

interface CheckoutFormProps {
  roastId: string;
  amount: number;
  currency: string;
  returnUrl: string;
}

const EXPRESS_OPTIONS: StripeExpressCheckoutElementOptions = {
  buttonHeight: 48,
  buttonTheme: {
    applePay: "black",
    googlePay: "black",
    paypal: "black",
  },
  buttonType: {
    applePay: "buy",
    googlePay: "buy",
    paypal: "paypal",
  },
};

const PAYMENT_OPTIONS: StripePaymentElementOptions = {
  layout: "tabs",
  wallets: { applePay: "never", googlePay: "never" },
};

function formatAmount(amount: number, currency: string): string {
  const value = amount / 100;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "symbol",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(0)}`;
  }
}

export default function CheckoutForm({
  roastId,
  amount,
  currency,
  returnUrl,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const captureCheckoutError = (error: unknown, source: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("payment.provider", "stripe");
      scope.setTag("payment.source", source);
      scope.setContext("stripe_checkout", { roastId, amount, currency });
      Sentry.captureException(error);
    });
  };

  const handleExpressConfirm = async (
    event: StripeExpressCheckoutElementConfirmEvent,
  ) => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setErrorMessage(error.message ?? "Payment could not be completed.");
      captureCheckoutError(error, "express");
      setSubmitting(false);
    }
    // On success, Stripe redirects to return_url. No further client work.
  };

  const handleCardSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setErrorMessage(error.message ?? "Payment could not be completed.");
      captureCheckoutError(error, "card");
      setSubmitting(false);
    }
  };

  const priceLabel = formatAmount(amount, currency);

  return (
    <form onSubmit={handleCardSubmit} className="space-y-6">
      <div className="space-y-2">
        <ExpressCheckoutElement
          options={EXPRESS_OPTIONS}
          onConfirm={handleExpressConfirm}
        />
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-ash/40 text-center">
          One-tap wallets
        </p>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.25em] text-ash/40">
        <span className="flex-1 h-px bg-ash/15" />
        <span>or pay by card</span>
        <span className="flex-1 h-px bg-ash/15" />
      </div>

      <PaymentElement options={PAYMENT_OPTIONS} />

      {errorMessage ? (
        <p className="text-blood font-mono text-xs uppercase tracking-[0.15em]">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || submitting}
        aria-busy={submitting}
        className="interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 min-h-[44px] text-center text-lg md:text-xl hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Processing…" : `Pay ${priceLabel} — Unlock`}
      </button>

      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-ash/40 text-center">
        Entertainment only · satire · not advice
      </p>
    </form>
  );
}
