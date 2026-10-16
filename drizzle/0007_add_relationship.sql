-- What the subjects of a group roast are to each other: partners, lovers,
-- siblings, friends, colleagues... Distinct from `kind`, which only says how
-- many charts we priced. Null on solo roasts and on group rows created before
-- this column existed (those fall back to `kind` when building the prompt).
-- Applied manually 2026-07-31.
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS relationship text;
