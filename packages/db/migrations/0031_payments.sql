-- Payment approvals (the anti-cheat trail). Staff take payment on the Payment page: pick a
-- PromptPay method (owner/mom/dad — configured in Shop info), enter the amount, show the QR,
-- then APPROVE once the customer's banking app confirms. Each approval is a row here, so the
-- owner can reconcile approvals against the receiving bank account from anywhere.
-- status is future-proofed for auto-confirmation (PaymentConfirmer): pending → confirmed.
CREATE TABLE payments (
  id text PRIMARY KEY NOT NULL,
  method_label text NOT NULL, -- who got paid, as labelled in Shop info ("ร้าน", "แม่"…)
  promptpay_id text NOT NULL, -- the target account snapshot (survives later method edits)
  amount_satang integer NOT NULL CHECK (amount_satang > 0),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'confirmed', 'void')),
  note text,
  created_at integer NOT NULL,
  approved_at integer
);
CREATE INDEX payments_created_idx ON payments (created_at);
