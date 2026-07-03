-- Group roasts support: kind, gold_line, extra_placements, roast_subjects table
-- Applied manually 2026-07-02

ALTER TABLE roasts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'solo';
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS gold_line text;
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS extra_placements jsonb;

CREATE TABLE IF NOT EXISTS roast_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_id uuid NOT NULL REFERENCES roasts(id),
  user_id uuid NOT NULL REFERENCES users(id),
  position integer NOT NULL
);

CREATE INDEX IF NOT EXISTS roast_subjects_roast_idx ON roast_subjects(roast_id);
