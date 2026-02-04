-- Supabase Schema for Tower Exchange Activities
-- Run this SQL in your Supabase SQL Editor to create the activities table

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL, -- Wallet address from Privy (e.g., Ethereum address)
  type VARCHAR(50) NOT NULL, -- e.g., 'Swap', 'Deposit', 'Withdraw', 'Transfer'
  
  -- Source details
  source_currency_ticker VARCHAR(10) NOT NULL, -- e.g., 'USDC', 'ETH'
  source_network_name VARCHAR(50) NOT NULL DEFAULT 'Arc', -- e.g., 'Arc', 'Ethereum Mainnet'
  
  -- Destination details (for swap, transfer; null for deposit/withdraw)
  destination_currency_ticker VARCHAR(10), -- e.g., 'ETH', can be NULL
  destination_network_name VARCHAR(50) DEFAULT 'Arc', -- e.g., 'Arc', can be NULL
  
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- e.g., 'Successful', 'Failed', 'Pending'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), -- Date and time of the activity
  
  -- Additional fields
  amount NUMERIC(20, 10), -- The amount of source currency involved
  transaction_hash TEXT, -- Hash of the blockchain transaction
  fee NUMERIC(20, 10), -- Transaction fee
  fee_currency_ticker VARCHAR(10), -- Currency of the fee
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on wallet_address for faster queries
CREATE INDEX IF NOT EXISTS idx_activities_wallet_address ON activities(wallet_address);

-- Create index on timestamp for sorting
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

-- Enable Row Level Security
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own activities (by wallet address)
-- Note: This assumes you'll pass the wallet address in the query
-- For production, you may want to integrate with Supabase Auth
CREATE POLICY "Users can view their own activities"
  ON activities FOR SELECT
  USING (true); -- For now, allow all reads. Update this when auth is integrated.

-- Policy: Users can insert their own activities
CREATE POLICY "Users can insert their own activities"
  ON activities FOR INSERT
  WITH CHECK (true); -- For now, allow all inserts. Update this when auth is integrated.

-- Policy: Users can update their own activities (e.g., status changes)
CREATE POLICY "Users can update their own activities"
  ON activities FOR UPDATE
  USING (true); -- For now, allow all updates. Update this when auth is integrated.

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Example insert (for testing)
-- INSERT INTO activities (
--   wallet_address,
--   type,
--   source_currency_ticker,
--   source_network_name,
--   destination_currency_ticker,
--   destination_network_name,
--   status,
--   amount,
--   transaction_hash
-- ) VALUES (
--   '0x1234567890123456789012345678901234567890',
--   'Swap',
--   'USDC',
--   'Arc',
--   'ETH',
--   'Arc',
--   'Successful',
--   100.50,
--   '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
-- );
