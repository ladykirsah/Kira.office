-- Append-only timeline of order status transitions, so the /orders/:id detail page can show what
-- actually happened to an order instead of only its current state.
--
-- Why not audit_logs (0016): that table records every non-GET request, but writeAuditLog hardcodes
-- before_json to NULL and the PATCH /orders/:id route passes no detail, so a row proves only that
-- SOMEONE patched the order — not what changed. Checkout and the slip route write straight to D1
-- from the storefront and bypass the API's audit wrapper entirely, and expireUnpaidOrders runs
-- inside a GET, which the wrapper does not audit. audit_logs stays the compliance record; this is
-- the timeline.
--
-- Each row is a SNAPSHOT of both axes, not a delta: the page can render "ยืนยันแล้ว · ชำระแล้ว" at any
-- point without replaying the whole history. Both status columns are nullable, mirroring
-- sales_orders where they already are, so a legacy row is recorded faithfully rather than invented.

CREATE TABLE `order_status_history` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `order_status` text,
  `payment_status` text,
  -- Closed vocabulary from packages/core/src/orderHistory.ts (historyEventFor derives it).
  `event` text NOT NULL,
  -- Cloudflare Access email of whoever caused it; NULL means the system did (e.g. the 48h sweep).
  `actor_email` text,
  `note` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- The only read pattern is "this order's timeline, newest first".
CREATE INDEX `order_status_history_order_idx` ON `order_status_history` (`order_id`, `created_at`);
--> statement-breakpoint

-- Backfill: one opening row per existing AirPlus order, so no order opens with an empty timeline.
-- Shopee rows are excluded — that channel is managed on /sales and its statuses are display-only
-- CSV text. hex(randomblob(16)) stands in for a UUID; these rows are synthetic by construction and
-- are marked 'created' with a NULL actor because we genuinely do not know who placed them.
INSERT INTO `order_status_history`
  (`id`, `order_id`, `order_status`, `payment_status`, `event`, `actor_email`, `note`, `created_at`)
SELECT
  hex(randomblob(16)),
  `id`,
  `order_status`,
  `payment_status`,
  'created',
  NULL,
  'backfilled from the order row by migration 0070',
  COALESCE(`order_created_at`, `imported_at`)
FROM `sales_orders`
WHERE `channel` = 'airplus';
