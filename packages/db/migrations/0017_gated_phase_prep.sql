-- Gated later phases: Shopee linkage, Thai T&C tables, variant option axes.
-- All additive / nullable — safe to apply before UI or live API work lands.

-- Variant axes (editor still single-variant until Phase 2b UI)
ALTER TABLE product_variants ADD COLUMN option_1_name text;
ALTER TABLE product_variants ADD COLUMN option_1_value text;
ALTER TABLE product_variants ADD COLUMN option_2_name text;
ALTER TABLE product_variants ADD COLUMN option_2_value text;

-- Shopee connection (gated Phase 5)
CREATE TABLE shop_connections (
  id text PRIMARY KEY NOT NULL,
  provider text NOT NULL DEFAULT 'shopee',
  shop_id text,
  shop_name text,
  region text NOT NULL DEFAULT 'TH',
  partner_id_reference text,
  access_token_secret_reference text,
  refresh_token_secret_reference text,
  token_expires_at integer,
  status text NOT NULL DEFAULT 'disconnected',
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE shopee_listings (
  id text PRIMARY KEY NOT NULL,
  shop_connection_id text NOT NULL REFERENCES shop_connections(id),
  product_id text NOT NULL REFERENCES products(id),
  shopee_item_id text,
  listing_status text,
  last_synced_at integer,
  sync_status text NOT NULL DEFAULT 'unlinked',
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE shopee_listing_models (
  id text PRIMARY KEY NOT NULL,
  shopee_listing_id text NOT NULL REFERENCES shopee_listings(id),
  product_variant_id text NOT NULL REFERENCES product_variants(id),
  shopee_model_id text,
  shopee_model_sku text,
  shopee_stock integer,
  last_synced_at integer
);

CREATE UNIQUE INDEX shopee_listing_models_variant_uq ON shopee_listing_models(product_variant_id);

-- Thai T&C patterns + per-product generated bodies (gated Phase 2b)
CREATE TABLE terms_patterns (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'th',
  body_template text NOT NULL,
  required_fields_json text,
  status text NOT NULL DEFAULT 'active',
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

ALTER TABLE products ADD COLUMN default_terms_pattern_id text REFERENCES terms_patterns(id);

CREATE TABLE product_terms (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL REFERENCES products(id),
  terms_pattern_id text REFERENCES terms_patterns(id),
  generated_body text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  approved_by_user_id text REFERENCES users(id),
  approved_at integer,
  created_at integer NOT NULL
);

CREATE INDEX product_terms_product_idx ON product_terms(product_id);
