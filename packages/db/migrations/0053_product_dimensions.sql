-- Parcel dimensions for carrier rating. Shippop and GoShip both price on VOLUMETRIC weight
-- (width × length × height ÷ 5000), not scale weight — a big light box (a condenser, a fan shroud)
-- costs more to send than it weighs — so no carrier can quote a shipping fee without these.
-- products.weight_grams already exists and Shippop's `weight` field is in grams, so that half maps
-- across with no conversion; these are the missing half.
--
-- Stored in MILLIMETRES as integers, mirroring weight_grams: the admin form takes centimetres
-- (a real box is 12.5cm, not 12), and carrying cm as a float into a value that decides money is
-- how rounding errors get into invoices. mm ÷ 10 = the cm Shippop wants.
--
-- NULLABLE with no default, deliberately: 0×0×0 is a *claim* (a zero-size parcel) whereas NULL is
-- "not measured yet". Every existing product predates this, and 500 SKUs are about to be entered by
-- hand — an unmeasured box must fail loudly at quote time, not silently price as an envelope.
ALTER TABLE `products` ADD COLUMN `width_mm` integer;
ALTER TABLE `products` ADD COLUMN `length_mm` integer;
ALTER TABLE `products` ADD COLUMN `height_mm` integer;
