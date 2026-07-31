-- Claim assignee (owner, 1 Aug 2026).
--
-- The defect-claim Zone A lets a super-admin or mechanic mark WHO is in charge of a claim — the
-- person handling the defect. There is no populated users table (per-staff logins are the later
-- Staff/RBAC phase), so this is a free-form name/label the reviewer picks from the mechanic list,
-- NOT a foreign key. It is also deliberately separate from `mechanic_name`, which means "who gave
-- the final verdict" — assignment and verdict are different moments.
--
-- Nullable, like every 0071 claim field; null = unassigned (the default and every existing row).
ALTER TABLE `order_claims` ADD COLUMN `assignee_name` text;
