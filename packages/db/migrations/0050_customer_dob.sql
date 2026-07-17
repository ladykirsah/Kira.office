-- Date of birth for AirPlus storefront customers — collected at registration to enforce the 20+
-- age gate (Terms of Service §2 / Civil & Commercial Code §19). Stored as an ISO date "YYYY-MM-DD".
-- Nullable: accounts created before this migration have none, and login is not blocked retroactively
-- (the gate applies to NEW registrations). @l-shopee/core ageInYears computes age from it.
ALTER TABLE storefront_customers ADD COLUMN date_of_birth text;
