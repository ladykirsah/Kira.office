-- AirPlus storefront traffic events (owner, 4 Aug 2026 — "all as Shopee").
--
-- The half of Shopee's Business Insights that Kira had no data for: ผู้เข้าชม, ยอดการมองเห็นสินค้า,
-- จำนวนคลิก, อัตราการเพิ่มในรถเข็น, อัตราการซื้อสินค้า and ที่มาของการเข้าชม. Every one of those needs a
-- record that somebody LOOKED, and until now the storefront recorded only what somebody BOUGHT.
--
-- PRIVACY — read before adding a column. There is deliberately no cookie, no localStorage id, no IP
-- and no user-agent stored here. `visitor_hash` is computed server-side per request as
-- sha256(bangkok-day + client-ip + user-agent + secret) and truncated: it is stable for one Bangkok
-- day and unrecoverable afterwards, so the shop can count "how many different people came today"
-- without ever holding an identifier that could follow one of them to tomorrow, or be joined back to
-- a person. That is what keeps this table outside the consent-banner question entirely (AirPlus has
-- no cookie banner in main — see the parked claude/airplus-returns branch) and what makes it
-- PDPA-quiet by construction rather than by policy.
--
-- The price of that choice, stated plainly because a metric nobody can audit is worse than no
-- metric: because the hash rotates at Bangkok midnight, COUNT(DISTINCT visitor_hash) over a 7- or
-- 30-day window is the SUM OF DAILY UNIQUES, not deduplicated people. A visitor who comes back on
-- three days counts three times. Single-day figures (Real-time, เมื่อวาน) are exact. The admin says
-- so on the tile rather than pretending otherwise.
CREATE TABLE `storefront_events` (
  `id` text PRIMARY KEY NOT NULL,

  -- Epoch ms, stamped by the SERVER. A client clock is wrong often enough (and forgeable always)
  -- that trusting it would let one bad device smear its visits across the wrong hour or the wrong
  -- day, and the whole chart is built on this column.
  `occurred_at` integer NOT NULL,

  -- What happened. CHECK, not convention: the aggregation counts by exact string, so one typo'd
  -- kind from a future caller would silently vanish from every total instead of failing loudly.
  --   page_view      — any storefront page opened
  --   product_view   — a product detail page opened      → ยอดการมองเห็นสินค้า
  --   click          — a product card clicked in a list  → จำนวนคลิก
  --   add_to_cart    — added to the cart                 → ผู้เข้าชมที่เพิ่มในรถเข็น
  --   checkout_start — the checkout form opened
  `kind` text NOT NULL CHECK (
    `kind` IN ('page_view', 'product_view', 'click', 'add_to_cart', 'checkout_start')
  ),

  -- Pseudonymous, day-scoped. See the PRIVACY note above before changing how this is derived.
  `visitor_hash` text NOT NULL,

  -- Where the arrival came from, already classified by core's `trafficSource` at write time:
  -- direct | search | social | ai | referral | internal. Classified on the way IN rather than at
  -- read time so no raw referrer URL — which can carry a search query, and so personal data — is
  -- ever persisted.
  `source` text NOT NULL,

  -- The path viewed ("/products/abc"). Path only: never the query string, which is where tracking
  -- parameters and typed search terms live.
  `path` text,

  -- The product this event is about, for product_view / click / add_to_cart. NULL for page_view.
  -- Not a foreign key on purpose: an event is a historical fact and must survive the product being
  -- archived, or the row would disappear from last month's ranking when the part is discontinued.
  `product_id` text
);

-- The three shapes every query here takes: a window scan, a window scan filtered by kind, and the
-- per-product ranking. occurred_at leads all three because the window is always the first filter.
CREATE INDEX `storefront_events_time_idx` ON `storefront_events` (`occurred_at`);
CREATE INDEX `storefront_events_kind_time_idx` ON `storefront_events` (`kind`, `occurred_at`);
CREATE INDEX `storefront_events_product_time_idx` ON `storefront_events` (`product_id`, `occurred_at`);
