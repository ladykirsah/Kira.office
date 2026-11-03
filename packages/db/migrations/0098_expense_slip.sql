-- An expense can carry its slip (owner, 2 Nov 2026: "able to insert slip for expenses").
--
-- The R2 key of the slip image, put by PUT /finance/expenses/:id/slip and shown by GET on the
-- same path. Optional: a cash expense, or one booked before this, has none (NULL). The image is
-- stored in R2 before this column is set, so a row never names a slip whose upload failed.
ALTER TABLE `expenses` ADD COLUMN `slip_key` text;
