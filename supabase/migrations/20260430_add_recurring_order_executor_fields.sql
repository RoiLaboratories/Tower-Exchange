ALTER TABLE recurring_orders
  ADD COLUMN IF NOT EXISTS onchain_order_key TEXT,
  ADD COLUMN IF NOT EXISTS executor_address TEXT,
  ADD COLUMN IF NOT EXISTS approval_transaction_hash TEXT,
  ADD COLUMN IF NOT EXISTS authorization_transaction_hash TEXT,
  ADD COLUMN IF NOT EXISTS execution_transaction_hash TEXT,
  ADD COLUMN IF NOT EXISTS onchain_authorized BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_recurring_onchain_authorized
  ON recurring_orders(onchain_authorized);

CREATE INDEX IF NOT EXISTS idx_recurring_onchain_order_key
  ON recurring_orders(onchain_order_key);
