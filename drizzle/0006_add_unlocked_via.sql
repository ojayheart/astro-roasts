-- How a roast's paywall was lifted: stripe | share | admin. Null = legacy
-- rows unlocked before this column existed.
-- Applied manually 2026-07-12.
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS unlocked_via text;
