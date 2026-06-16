-- Track wallet connection events for analytics and support diagnostics.
-- This is intentionally lightweight and insert-only from the app.

CREATE TABLE IF NOT EXISTS wallet_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  wallet_type TEXT,
  chain_id INTEGER,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_connections_address_lower
  ON wallet_connections (lower(address));

CREATE INDEX IF NOT EXISTS idx_wallet_connections_connected_at_desc
  ON wallet_connections (connected_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_connections_wallet_type
  ON wallet_connections (wallet_type);

COMMENT ON TABLE wallet_connections IS 'Tracks wallet connection events from RainbowKit wallet sessions';
COMMENT ON COLUMN wallet_connections.address IS 'Lowercased wallet address that connected';
COMMENT ON COLUMN wallet_connections.wallet_type IS 'Connector or wallet name reported by wagmi/RainbowKit';
COMMENT ON COLUMN wallet_connections.chain_id IS 'Chain ID active at the moment of connection';
COMMENT ON COLUMN wallet_connections.connected_at IS 'Timestamp when the connection event was recorded';

ALTER TABLE wallet_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert wallet connection logs" ON wallet_connections;

CREATE POLICY "Anyone can insert wallet connection logs"
  ON wallet_connections
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
