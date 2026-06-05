-- Rename users.paddle_customer_id → users.stripe_customer_id.
-- Project switched payment provider from Paddle (rejected) to Stripe.
-- The column was always nullable and never populated in production
-- (Paddle was sandbox-only), so this is a pure rename.

ALTER TABLE "users" RENAME COLUMN "paddle_customer_id" TO "stripe_customer_id";
