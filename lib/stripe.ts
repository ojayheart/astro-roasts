import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  cachedStripe = new Stripe(key, {
    typescript: true,
    appInfo: {
      name: "astro-roasts",
      url: "https://astroroast.com",
    },
  });

  return cachedStripe;
}

interface VerifyStripeEventInput {
  rawBody: string;
  signature: string;
  secret: string;
}

type VerifyStripeEventResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; error: string };

export function verifyStripeEvent({
  rawBody,
  signature,
  secret,
}: VerifyStripeEventInput): VerifyStripeEventResult {
  const stripe = getStripe();
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return { ok: false, error: message };
  }
}

interface ExtractRoastIdInput {
  event: Stripe.Event;
}

type ExtractRoastIdResult =
  | { ok: true; roastId: string }
  | { ok: false; error: string };

interface VerifyRoastPaymentInput {
  roastId: string;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}

type VerifyRoastPaymentResult = { paid: boolean; error?: string };

// Confirm a payment directly against Stripe using the id Stripe appends to the
// return/success URL (`session_id` for hosted Checkout, `payment_intent` for
// the embedded flow). This is independent of the async webhook, so a buyer who
// left no email still gets their roast unlocked on-page even if the webhook is
// delayed or failing. Requires the Stripe object's metadata.roastId to match,
// so one buyer can't unlock another roast.
export async function verifyRoastPayment({
  roastId,
  sessionId,
  paymentIntentId,
}: VerifyRoastPaymentInput): Promise<VerifyRoastPaymentResult> {
  const stripe = getStripe();
  try {
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return { paid: false, error: "Session not paid" };
      }
      if (session.metadata?.roastId !== roastId) {
        return { paid: false, error: "roastId mismatch" };
      }
      return { paid: true };
    }
    if (paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") {
        return { paid: false, error: "PaymentIntent not succeeded" };
      }
      if (intent.metadata?.roastId !== roastId) {
        return { paid: false, error: "roastId mismatch" };
      }
      return { paid: true };
    }
    return { paid: false, error: "No session or payment intent id" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe verify failed";
    return { paid: false, error: message };
  }
}

export function extractCompletedRoastId({
  event,
}: ExtractRoastIdInput): ExtractRoastIdResult {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return { ok: false, error: "Session not paid" };
    }
    const roastId = session.metadata?.roastId;
    if (typeof roastId !== "string" || !roastId) {
      return { ok: false, error: "Missing roastId in metadata" };
    }
    return { ok: true, roastId };
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.status !== "succeeded") {
      return { ok: false, error: "PaymentIntent not succeeded" };
    }
    const roastId = intent.metadata?.roastId;
    if (typeof roastId !== "string" || !roastId) {
      return { ok: false, error: "Missing roastId in metadata" };
    }
    return { ok: true, roastId };
  }

  return { ok: false, error: "Unsupported event" };
}
