-- Create bridge_fees table to track bridge platform and protocol fees with detailed breakdowns

CREATE TABLE IF NOT EXISTS bridge_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  bridge_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  from_chain TEXT NOT NULL,
  to_chain TEXT NOT NULL,
  source_token_address TEXT,
  destination_token_address TEXT,
  token_symbol TEXT NOT NULL,
  bridge_amount NUMERIC(30, 8) NOT NULL,
  platform_fee_amount NUMERIC(30, 8) NOT NULL DEFAULT 0,
  platform_fee_amount_usd NUMERIC(20, 2),
  protocol_fee_amount NUMERIC(30, 8) NOT NULL DEFAULT 0,
  protocol_fee_amount_usd NUMERIC(20, 2),
  total_fee_amount NUMERIC(30, 8) NOT NULL DEFAULT 0,
  total_fee_amount_usd NUMERIC(20, 2),
  amount_received NUMERIC(30, 8),
  source_debit_total NUMERIC(30, 8),
  fee_type TEXT NOT NULL DEFAULT 'Flat' CHECK (fee_type IN ('Flat', 'BasisPoints', 'Mixed')),
  fee_basis_points INTEGER CHECK (fee_basis_points IS NULL OR fee_basis_points >= 0),
  fee_recipient_address TEXT,
  protocol_provider TEXT DEFAULT 'Circle',
  transaction_hash TEXT,
  block_number INTEGER,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Recorded', 'Confirmed', 'Failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bridge_fees_wallet_address ON bridge_fees(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_from_chain ON bridge_fees(from_chain);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_to_chain ON bridge_fees(to_chain);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_token_symbol ON bridge_fees(token_symbol);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_status ON bridge_fees(status);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_created_at ON bridge_fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_transaction_hash ON bridge_fees(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bridge_fees_bridge_activity_id ON bridge_fees(bridge_activity_id);

-- Add comments for documentation
COMMENT ON TABLE bridge_fees IS 'Tracks bridge platform and protocol fees with transaction, chain, and fee breakdown details';
COMMENT ON COLUMN bridge_fees.wallet_address IS 'User wallet address that initiated the bridge (lowercase)';
COMMENT ON COLUMN bridge_fees.bridge_activity_id IS 'Optional reference to the activities row created for the bridge transaction';
COMMENT ON COLUMN bridge_fees.from_chain IS 'Human-readable source chain name for the bridge route';
COMMENT ON COLUMN bridge_fees.to_chain IS 'Human-readable destination chain name for the bridge route';
COMMENT ON COLUMN bridge_fees.source_token_address IS 'Token contract or mint address on the source chain';
COMMENT ON COLUMN bridge_fees.destination_token_address IS 'Token contract or mint address on the destination chain';
COMMENT ON COLUMN bridge_fees.token_symbol IS 'Shared symbol of the bridged token (e.g., USDC)';
COMMENT ON COLUMN bridge_fees.bridge_amount IS 'Source transfer amount before any protocol fee deduction';
COMMENT ON COLUMN bridge_fees.platform_fee_amount IS 'Custom Tower bridge fee collected for the transaction';
COMMENT ON COLUMN bridge_fees.platform_fee_amount_usd IS 'USD value of the custom Tower bridge fee';
COMMENT ON COLUMN bridge_fees.protocol_fee_amount IS 'Protocol fee charged by the bridge provider (for example, Circle CCTP)';
COMMENT ON COLUMN bridge_fees.protocol_fee_amount_usd IS 'USD value of the protocol fee charged by the bridge provider';
COMMENT ON COLUMN bridge_fees.total_fee_amount IS 'Combined platform and protocol fees for the bridge';
COMMENT ON COLUMN bridge_fees.total_fee_amount_usd IS 'USD value of the combined platform and protocol fees';
COMMENT ON COLUMN bridge_fees.amount_received IS 'Estimated token amount expected on the destination chain after protocol fee deduction';
COMMENT ON COLUMN bridge_fees.source_debit_total IS 'Total source-side debit including the bridge amount and any additional platform fee';
COMMENT ON COLUMN bridge_fees.fee_type IS 'How the Tower fee was configured for the transaction';
COMMENT ON COLUMN bridge_fees.fee_basis_points IS 'Optional fee rate in basis points when a bridge fee is percentage-based';
COMMENT ON COLUMN bridge_fees.fee_recipient_address IS 'Recipient wallet address for the custom Tower bridge fee';
COMMENT ON COLUMN bridge_fees.protocol_provider IS 'Bridge protocol provider responsible for the protocol fee';
COMMENT ON COLUMN bridge_fees.transaction_hash IS 'Transaction hash of the bridge transfer or fee collection transaction';
COMMENT ON COLUMN bridge_fees.block_number IS 'Block number where the bridge fee record was confirmed';
COMMENT ON COLUMN bridge_fees.status IS 'Status of fee recording (Pending, Recorded, Confirmed, Failed)';
COMMENT ON COLUMN bridge_fees.error_message IS 'Error message if bridge fee recording failed';

-- Enable Row Level Security
ALTER TABLE bridge_fees ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bridge fees
CREATE POLICY "Users can view their own bridge fees"
  ON bridge_fees FOR SELECT
  USING (true);

-- Policy: Authenticated service can insert bridge fees
CREATE POLICY "Service can insert bridge fees"
  ON bridge_fees FOR INSERT
  WITH CHECK (true);

-- Policy: Service can update bridge fees
CREATE POLICY "Service can update bridge fees"
  ON bridge_fees FOR UPDATE
  USING (true);
