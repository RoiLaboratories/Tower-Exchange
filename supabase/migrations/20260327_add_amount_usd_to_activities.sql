-- Migration: Add amount_usd column to activities table
-- Description: Adds USD value column to track monetary value of all transactions
-- Date: 2026-03-27

-- Add amount_usd column to activities table if it doesn't exist
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(20, 2);

-- Add comment for documentation
COMMENT ON COLUMN activities.amount_usd IS 'USD value of the transaction - used to track monetary value across all transaction types (Swap, Bridge, etc.)';
