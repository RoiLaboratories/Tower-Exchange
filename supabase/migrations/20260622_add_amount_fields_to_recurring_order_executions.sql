ALTER TABLE recurring_order_executions
ADD COLUMN IF NOT EXISTS source_amount_usd NUMERIC(20, 2),
ADD COLUMN IF NOT EXISTS target_amount NUMERIC(38, 18),
ADD COLUMN IF NOT EXISTS target_amount_usd NUMERIC(20, 2);

COMMENT ON COLUMN recurring_order_executions.source_amount_usd IS
  'USD value of the executed source token amount.';

COMMENT ON COLUMN recurring_order_executions.target_amount IS
  'Target token amount captured for the recurring order execution.';

COMMENT ON COLUMN recurring_order_executions.target_amount_usd IS
  'USD value of the target token amount.';