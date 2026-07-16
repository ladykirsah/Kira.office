-- Mechanic-tools affiliate: curated outbound cards managed in admin, clicks tracked in Kira so
-- per-item clicks can be correlated with the affiliate income the owner records in the finance
-- channel (channel = 'affiliate', money-only). price_text is freeform display text ("฿1,290") —
-- not our money, never used in math.
CREATE TABLE affiliate_items (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  image_key text,
  price_text text,
  source text NOT NULL DEFAULT 'other' CHECK (source IN ('shopee', 'lazada', 'other')),
  target_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at integer NOT NULL
);

CREATE TABLE affiliate_clicks (
  id text PRIMARY KEY NOT NULL,
  item_id text NOT NULL REFERENCES affiliate_items(id),
  created_at integer NOT NULL
);
CREATE INDEX affiliate_clicks_item_idx ON affiliate_clicks (item_id);
