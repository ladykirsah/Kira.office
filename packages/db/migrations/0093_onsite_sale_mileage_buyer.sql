-- Two optional facts on an on-site bill, for the new ทำบิล page:
--   mileage_km  — the customer's car mileage (km) when it came in. Stored on each bill, so the bill's
--                 own created_at dates the reading and the car's page can show its last mileage.
--   buyer_name  — the mechanic's name on a ช่าง / B2B bill (the buyer is not the car's owner).
-- Both nullable: NULL = not recorded. Older bills and drafts keep NULL; nothing else changes.
ALTER TABLE onsite_sales ADD COLUMN mileage_km INTEGER;
ALTER TABLE onsite_sales ADD COLUMN buyer_name TEXT;
