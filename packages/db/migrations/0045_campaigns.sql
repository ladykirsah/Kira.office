-- Flash-sale campaigns: real timed discounts (price + window + optional stock cap).
-- Price resolution is time-based in code (core resolveEffectivePrice) — no cron needed; the
-- campaign price simply stops applying when the window ends.
CREATE TABLE campaigns (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  starts_at integer NOT NULL,
  ends_at integer NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at integer NOT NULL
);

CREATE TABLE campaign_prices (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  product_variant_id text NOT NULL REFERENCES product_variants(id),
  campaign_price_satang integer NOT NULL CHECK (campaign_price_satang > 0),
  stock_cap integer,
  sold_count integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL
);
CREATE UNIQUE INDEX campaign_prices_variant_uq ON campaign_prices (campaign_id, product_variant_id);
CREATE INDEX campaign_prices_variant_idx ON campaign_prices (product_variant_id);
