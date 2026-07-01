-- Drop the unused commission_profiles table. It modelled layered marketplace fees (commission +
-- transaction + service + fixed, shopee-only) but was never referenced by any code — the live
-- commission is the single pricing_profiles.online_commission_bp field. Accurate per-order fees will
-- come from the Shopee CSV import (order_fee) now and the v2 API later, not a per-product fee config.
DROP TABLE IF EXISTS commission_profiles;
