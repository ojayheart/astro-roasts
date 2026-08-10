-- iOS subscription foundation (plan §2): subscriptions, daily_roasts, forecasts,
-- devices, duos, plus two column adds on users.
--
-- Additive only. users.tz already exists and is reused; devices.tz is separate
-- on purpose — the account timezone and a handset's timezone diverge the moment
-- someone travels, and the daily push follows the handset.
--
-- daily_roasts is keyed on (user_id, for_date) rather than a timestamp: the
-- unique constraint is the idempotency guard, so a double-fired cron or a retry
-- still leaves exactly one roast per day.
--
-- NOT YET APPLIED — apply manually against Neon.

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  platform text NOT NULL,
  original_txn_id text UNIQUE,
  product_id text NOT NULL,
  status text NOT NULL,
  expires_at timestamptz,
  environment text NOT NULL DEFAULT 'production',
  raw_latest jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status, expires_at);

CREATE TABLE IF NOT EXISTS daily_roasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  for_date date NOT NULL,
  title text,
  body text,
  gold_line text,
  transits jsonb,
  status text NOT NULL DEFAULT 'generating',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, for_date)
);

CREATE TABLE IF NOT EXISTS forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text,
  body text,
  highlights jsonb,
  avoid jsonb,
  status text NOT NULL DEFAULT 'generating',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_start)
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  apns_token text NOT NULL UNIQUE,
  tz text NOT NULL,
  notify_hour integer NOT NULL DEFAULT 8,
  build text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);

CREATE TABLE IF NOT EXISTS duos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  subject_id uuid NOT NULL REFERENCES users(id),
  relationship text NOT NULL,
  roast_id uuid REFERENCES roasts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duos_owner_idx ON duos(owner_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
