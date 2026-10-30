-- The bill a counter payment paid for, so the Payment page can show "บิล DAS…" on its row
-- (owner, 30 Oct 2026). Sent by ทำบิล and Scan when a bill is paid by PromptPay; a QR made on the
-- Payment page itself has no bill and stays NULL, as do all payments recorded before this column.
ALTER TABLE payments ADD COLUMN sale_number TEXT;
