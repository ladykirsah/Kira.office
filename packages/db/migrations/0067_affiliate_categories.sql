-- Affiliate cards get a managed category and an explicit homepage pin (owner, 2026-07-29).
--
-- Category is a real list, not free text: the owner creates one from the Add-an-item form and it
-- becomes a dropdown choice everywhere after, so the same shelf can't end up with "Gauges",
-- "gauge" and "Gauge set". Renaming later touches one row.
CREATE TABLE affiliate_categories (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL
);

-- Nullable: existing cards stay uncategorised until the owner files them.
ALTER TABLE affiliate_items ADD COLUMN category_id text REFERENCES affiliate_categories(id);

-- The homepage shelf used to be "whatever sorts first". Pinned cards lead it now.
ALTER TABLE affiliate_items ADD COLUMN pinned integer NOT NULL DEFAULT 0;
