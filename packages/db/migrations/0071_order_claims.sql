-- Claims (เคลม): a customer reporting a wrongly-sent or defective product, and everything that
-- follows. The owner's flow (30 Jul 2026):
--
--   customer clicks claim on AirPlus → admin contacts them → admin approves to continue
--   → customer sends the product back → mechanic investigates → mechanic approves
--   → create the claim product delivery
--
-- SUPERSEDES the unmerged 0049_order_returns.sql on branch claude/airplus-returns. That table
-- predates this design: four Thai status values, no mechanic field, no admin gate, no line item, and
-- no shipping columns in either direction — it cannot express a two-gate flow. Deliberately numbered
-- 0071: the mainline has a five-wide hole at 0048–0052 and TWO conflicting 0048/0049 pairs exist on
-- unmerged branches, so reusing those numbers would collide.
--
-- Why a child table and not columns on sales_orders: a claim is not a property of an order. One
-- order can be claimed more than once over its life (a replacement can itself fail), a claim covers
-- ONE line or SEVERAL ("can be both", per the owner), and the claim carries its own two shipping
-- legs. The order keeps only a coarse status (claim_pending / claimed / claim_rejected), derived by
-- orderStatusForClaim in packages/core/src/claimState.ts.

CREATE TABLE `order_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `sales_order_id` text NOT NULL,

  -- The two reasons the owner named. Both are our fault or the product's, never the customer's.
  `kind` text NOT NULL CHECK (`kind` IN ('wrong_item', 'defect')),

  -- Mirrors ClaimState in packages/core/src/claimState.ts. CHECK-constrained on purpose: the one
  -- existing free-text status field in this codebase (the admin's Sales tab) is exactly how
  -- unclassifiable values got written, so this column refuses them.
  `state` text NOT NULL DEFAULT 'requested' CHECK (`state` IN (
    'requested', 'approved', 'received', 'mechanic_approved',
    'shipped', 'done', 'cancelled', 'mechanic_rejected'
  )),

  -- What the customer told us, in their words, plus any photo keys in R2 (the published /returns
  -- policy promises photo evidence).
  `reason_note` text,
  `photo_keys` text,

  -- GATE 1 — admin: approve to continue, or cancel because it closed after a conversation.
  `admin_email` text,
  `admin_decided_at` integer,
  `admin_note` text,

  -- GATE 2 — mechanic: the technical verdict on goods we are physically holding. Kept separate from
  -- the admin fields because they are different people making different decisions, and a claim that
  -- reached a refund must be able to show WHO passed it.
  `mechanic_name` text,
  `mechanic_decided_at` integer,
  `mechanic_note` text,

  -- How it resolved once the mechanic passed it. refund_satang is nullable and need not be the full
  -- order value — the owner's policy allows a partial refund.
  `resolution` text CHECK (`resolution` IS NULL OR `resolution` IN ('exchange', 'refund')),
  `refund_satang` integer CHECK (`refund_satang` IS NULL OR `refund_satang` >= 0),

  -- LEG 1, customer → us: how their product came back.
  `return_tracking_no` text,
  `return_received_at` integer,

  -- LEG 2, us → customer: the claim product delivery. These are the fields the owner listed.
  `receive_address` text,
  `carrier` text,
  `tracking_no` text,
  `dropped_off_at` integer,

  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,

  FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- The read patterns: this order's claims, and the work queue by state.
CREATE INDEX `order_claims_order_idx` ON `order_claims` (`sales_order_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `order_claims_state_idx` ON `order_claims` (`state`, `created_at`);
--> statement-breakpoint

-- Which items the claim covers. One row for a single-item claim, several for a whole-order claim —
-- the owner said it can be either. replacement_variant_id allows the exchange to send a different
-- variant from the one that came back.
CREATE TABLE `order_claim_lines` (
  `id` text PRIMARY KEY NOT NULL,
  `claim_id` text NOT NULL,
  `sales_order_line_id` text NOT NULL,
  `quantity` integer NOT NULL CHECK (`quantity` > 0),
  `replacement_variant_id` text,
  FOREIGN KEY (`claim_id`) REFERENCES `order_claims`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`sales_order_line_id`) REFERENCES `sales_order_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_claim_lines_claim_idx` ON `order_claim_lines` (`claim_id`);
--> statement-breakpoint
-- One claim cannot list the same order line twice.
CREATE UNIQUE INDEX `order_claim_lines_unique` ON `order_claim_lines` (`claim_id`, `sales_order_line_id`);
