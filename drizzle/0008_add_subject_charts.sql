-- Full natal charts for every subject of a group roast, in position order.
-- chart_json already holds person 1's chart and stays the source of truth for
-- solo roasts and for the loading wheel's first paint; this column is what the
-- synastry bi-wheel needs, since person 2's chart was previously never computed
-- at all (only their sun/moon/rising landed in extra_placements).
--
-- NatalChart[] — index 0 is person 1, matching roast_subjects.position.
-- Null on solo roasts and on group rows created before this column existed.
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS subject_charts jsonb;
