-- Slip verification (Payment auto-confirm, phase 1 of the PaymentConfirmer seam).
-- A verified bank-transfer slip upgrades a payment approved → confirmed and stores the bank's
-- transaction reference. The partial UNIQUE index is the anti-cheat core: one real transfer slip
-- can confirm exactly ONE payment — a reused slip (pocketing cash on a second sale while showing
-- the same transfer) is rejected at the database level, not just in application code.
ALTER TABLE payments ADD COLUMN slip_ref TEXT;
ALTER TABLE payments ADD COLUMN confirmed_at INTEGER;
ALTER TABLE payments ADD COLUMN verify_note TEXT;
CREATE UNIQUE INDEX payments_slip_ref_unique ON payments (slip_ref) WHERE slip_ref IS NOT NULL;
