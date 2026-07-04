-- Owner reconciliation. When the owner returns and has checked the batch of payments staff handled
-- against the receiving bank account, they "Clear" them: the rows drop out of the Payment page's
-- Recent-payments working list but are NEVER deleted — the payment record IS the anti-cheat trail.
-- cleared_at is that reconciliation marker (null = not yet cleared).
ALTER TABLE payments ADD COLUMN cleared_at INTEGER;
