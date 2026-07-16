-- Home-page banners, managed in Kira admin. slot 'hero' = the top carousel; 'promo' = the wide
-- mid-page strip. Images live in R2 under banners/ (served via the public /img route, whose
-- allowlist is extended to admit that namespace).
CREATE TABLE banners (
  id text PRIMARY KEY NOT NULL,
  slot text NOT NULL CHECK (slot IN ('hero', 'promo')),
  image_key text,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at integer,
  ends_at integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at integer NOT NULL
);
