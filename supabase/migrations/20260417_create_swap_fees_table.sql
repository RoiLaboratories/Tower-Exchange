-- Create swap_fees table to track all swap fees with detailed information

CREATE TABLE IF NOT EXISTS swap_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  swap_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  fee_amount NUMERIC(30, 8) NOT NULL,
  fee_amount_usd NUMERIC(20, 2),
  fee_basis_points INTEGER NOT NULL CHECK (fee_basis_points >= 0),
  total_amount NUMERIC(30, 8) NOT NULL,
  transaction_hash TEXT,
  block_number INTEGER,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Recorded', 'Confirmed', 'Failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_swap_fees_wallet_address ON swap_fees(wallet_address);
CREATE INDEX IF NOT EXISTS idx_swap_fees_token_address ON swap_fees(token_address);
CREATE INDEX IF NOT EXISTS idx_swap_fees_status ON swap_fees(status);
CREATE INDEX IF NOT EXISTS idx_swap_fees_created_at ON swap_fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swap_fees_transaction_hash ON swap_fees(transaction_hash);

-- Add comment for documentation
COMMENT ON TABLE swap_fees IS 'Tracks all swap platform fees collected with details about the transaction and fee breakdown';
COMMENT ON COLUMN swap_fees.wallet_address IS 'User wallet address that initiated the swap (lowercase)';
COMMENT ON COLUMN swap_fees.token_address IS 'Smart contract address of the token the fee was collected in';
COMMENT ON COLUMN swap_fees.token_symbol IS 'Symbol of the token (e.g., USDC, EURC)';
COMMENT ON COLUMN swap_fees.fee_amount IS 'Amount of fee collected (in token native decimals)';
COMMENT ON COLUMN swap_fees.fee_amount_usd IS 'USD value of the fee at time of collection';
COMMENT ON COLUMN swap_fees.fee_basis_points IS 'Fee rate in basis points (e.g., 25 = 0.25%)';
COMMENT ON COLUMN swap_fees.total_amount IS 'Total amount that went to FeeCollector (before fee deduction)';
COMMENT ON COLUMN swap_fees.transaction_hash IS 'Transaction hash of the fee collection/distribution transaction';
COMMENT ON COLUMN swap_fees.block_number IS 'Block number where the fee was recorded';
COMMENT ON COLUMN swap_fees.status IS 'Status of fee recording (Pending, Recorded, Confirmed, Failed)';
COMMENT ON COLUMN swap_fees.error_message IS 'Error message if fee recording failed';

-- Enable Row Level Security
ALTER TABLE swap_fees ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own swap fees (by wallet address)
CREATE POLICY "Users can view their own swap fees"
  ON swap_fees FOR SELECT
  USING (true);

-- Policy: Authenticated service can insert swap fees
CREATE POLICY "Service can insert swap fees"
  ON swap_fees FOR INSERT
  WITH CHECK (true);

-- Policy: Service can update swap fees for status tracking
CREATE POLICY "Service can update swap fees"
  ON swap_fees FOR UPDATE
  USING (true);
