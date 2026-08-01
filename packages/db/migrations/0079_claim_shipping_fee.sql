-- The replacement drop-off (exchange resolution) records what WE paid the carrier to send the new
-- part out. It is a real cost of the claim, so it lands here on the claim (nullable — refunds and
-- pre-shipment claims have none) and orderMoney subtracts it from that order's profit.
ALTER TABLE `order_claims` ADD COLUMN `shipping_fee_satang` integer;
