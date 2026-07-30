-- The three shipping figures an order needs beyond what the customer was charged, so the owner can
-- see where a parcel's cost actually landed (owner's brief, 30 Jul 2026).
--
-- Until now sales_orders held exactly ONE shipping number, shipping_fee_satang (migration 0055) =
-- what we billed the customer. That is not enough to answer "did this order make money": Flash bills
-- what Flash bills, and the difference between our quote and their receipt is absorbed silently.
--
-- carrier and tracking_no already exist (migration 0030) and are NOT re-added here.
--
-- shipping_auto_satang — the Flash rate our own calculator quoted at checkout.
--   Persisted rather than recomputed on read, and that is not an optimisation: sales_order_lines
--   stores quantity, price and cost but NO weight and NO dimensions, so the quote cannot be rebuilt
--   from the order. Joining live product_dimensions would use TODAY's dimensions against a parcel
--   sold months ago and drift without anyone noticing.
--   NOT NULL DEFAULT 0 keeps the storefront's positional 20-column INSERT valid.
--   Backfilled from shipping_fee_satang: for every order that exists today we charged exactly what we
--   quoted, so that is the true historical value rather than a guess.
--
-- shipping_offer_satang — what we OFFERED the customer on a shared-fee order, when we deliberately
--   absorb part of a heavy parcel's cost. Nullable, and the null-ness carries the meaning: NULL is a
--   normal order, non-NULL marks the order as shared-fee. That avoids a separate boolean that could
--   disagree with the amount, and it is why the detail page can show the "Offered to customer" row
--   only where it applies. The auto-apply rule (by weight and order total) is not built yet — the
--   owner sets the figure by hand until the criteria are decided.
--
-- shipping_real_satang — what the carrier actually charged, entered from the receipt after drop-off.
--   Nullable because it is genuinely unknown until someone stands at the Flash counter; NULL and 0
--   must stay distinguishable, since 0 would claim delivery was free. No CHECK for >= 0 and no
--   clamping downstream: charging the customer more than the carrier billed is a real outcome and
--   shows as a negative shortfall rather than being hidden.
ALTER TABLE `sales_orders` ADD COLUMN `shipping_auto_satang` integer NOT NULL DEFAULT 0;
ALTER TABLE `sales_orders` ADD COLUMN `shipping_offer_satang` integer;
ALTER TABLE `sales_orders` ADD COLUMN `shipping_real_satang` integer;

UPDATE `sales_orders` SET `shipping_auto_satang` = `shipping_fee_satang`;
