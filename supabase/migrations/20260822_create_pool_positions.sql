-- Store Tower AMM liquidity provider positions and optional position events.
-- Browser clients must access this data through signed wallet-session API routes.

CREATE TABLE IF NOT EXISTS pool_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 5042002,
  dex_id TEXT NOT NULL DEFAULT 'tower-dex',
  pool_id TEXT NOT NULL,
  pair_label TEXT,
  pair_address TEXT,
  router_address TEXT,
  token0_symbol TEXT NOT NULL,
  token1_symbol TEXT NOT NULL,
  token0_address TEXT NOT NULL,
  token1_address TEXT NOT NULL,
  fee_tier_bps INTEGER NOT NULL DEFAULT 30 CHECK (fee_tier_bps >= 0),
  lp_token_amount NUMERIC(78, 0) NOT NULL DEFAULT 0 CHECK (lp_token_amount >= 0),
  liquidity_usd NUMERIC(30, 8),
  token0_amount NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (token0_amount >= 0),
  token1_amount NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (token1_amount >= 0),
  claimable_fee0_amount NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (claimable_fee0_amount >= 0),
  claimable_fee1_amount NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (claimable_fee1_amount >= 0),
  claimable_fee_usd NUMERIC(30, 8),
  apr_percent NUMERIC(20, 8),
  min_price NUMERIC(38, 18),
  max_price NUMERIC(38, 18),
  current_price NUMERIC(38, 18),
  status TEXT NOT NULL DEFAULT 'in-range' CHECK (status IN ('in-range', 'out-of-range', 'closed')),
  opened_transaction_hash TEXT,
  last_transaction_hash TEXT,
  last_block_number BIGINT,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pool_positions_unique_wallet_pool UNIQUE (wallet_address, chain_id, dex_id, pool_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_positions_wallet_address
  ON pool_positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_pool_positions_pool_id
  ON pool_positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_positions_status
  ON pool_positions(status);
CREATE INDEX IF NOT EXISTS idx_pool_positions_updated_at
  ON pool_positions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pool_positions_last_tx
  ON pool_positions(last_transaction_hash);

CREATE TABLE IF NOT EXISTS pool_position_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_position_id UUID REFERENCES pool_positions(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 5042002,
  dex_id TEXT NOT NULL DEFAULT 'tower-dex',
  pool_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('add', 'remove', 'claim', 'sync', 'close')),
  token0_amount NUMERIC(38, 18),
  token1_amount NUMERIC(38, 18),
  lp_token_amount NUMERIC(78, 0),
  fee0_amount NUMERIC(38, 18),
  fee1_amount NUMERIC(38, 18),
  amount_usd NUMERIC(30, 8),
  transaction_hash TEXT,
  block_number BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_position_events_position_id
  ON pool_position_events(pool_position_id);
CREATE INDEX IF NOT EXISTS idx_pool_position_events_wallet_address
  ON pool_position_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_pool_position_events_pool_id
  ON pool_position_events(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_position_events_created_at
  ON pool_position_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pool_position_events_tx
  ON pool_position_events(transaction_hash);

COMMENT ON TABLE pool_positions IS 'Current wallet-scoped Tower AMM liquidity positions. API routes update this after add/remove/claim/sync operations.';
COMMENT ON COLUMN pool_positions.lp_token_amount IS 'Raw LP token balance or minted LP amount, stored as an integer string-compatible numeric.';
COMMENT ON COLUMN pool_positions.claimable_fee0_amount IS 'Estimated/unclaimed fees in token0 units when an indexer or sync job is available.';
COMMENT ON COLUMN pool_positions.claimable_fee1_amount IS 'Estimated/unclaimed fees in token1 units when an indexer or sync job is available.';
COMMENT ON COLUMN pool_positions.liquidity_usd IS 'Optional USD valuation at last sync; null means not indexed yet.';
COMMENT ON TABLE pool_position_events IS 'Append-only history for liquidity add/remove/claim/sync events associated with pool_positions.';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pool_positions_updated_at ON pool_positions;
CREATE TRIGGER update_pool_positions_updated_at
  BEFORE UPDATE ON pool_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pool_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE pool_position_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_position_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pool_positions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE pool_position_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE pool_positions TO service_role;
GRANT ALL ON TABLE pool_position_events TO service_role;
