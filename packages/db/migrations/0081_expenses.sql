-- Finance expenses (owner, 3 Aug 2026).
--
-- Money OUT that isn't tied to a sale: a refund on a Den Air Service bill, an AI-package
-- subscription on AirPlus, gateway fees, and so on. Each expense is tagged to ONE channel and, on
-- the Finance page, lowers that channel's (and the Total) net Profit and shows as a row in the
-- channel's table. `conversion` is the owner's free-text label for the expense (shown verbatim as
-- the row's identity, in place of an order id). Amounts are stored in satang like every other money
-- column. Soft-deleted via `archived` (see the soft-delete invariant); no hard deletes.
CREATE TABLE `expenses` (
  `id` text PRIMARY KEY NOT NULL,

  -- Which channel bears the cost. Only the two Finance channels; CHECK refuses anything else.
  `channel` text NOT NULL CHECK (`channel` IN ('onsite', 'airplus')),

  -- The owner's free-text label for the expense ("AI package", "refund DA-25080203"). Shown as-is.
  `conversion` text NOT NULL,

  -- Cost in satang; always positive (the negative sign is applied in the UI as a negative Profit).
  `amount_satang` integer NOT NULL,

  `note` text,

  -- When the expense happened (epoch ms) — the date the owner picks; drives the period filter.
  `occurred_at` integer NOT NULL,

  `created_at` integer NOT NULL,

  -- Soft-delete: 1 = archived. Every list query filters `archived = 0`.
  `archived` integer NOT NULL DEFAULT 0
);

CREATE INDEX `idx_expenses_channel_occurred` ON `expenses` (`channel`, `occurred_at`);
