-- Track Telegram connection intents and completed wallet-to-Telegram links.

CREATE TABLE IF NOT EXISTS telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  telegram_chat_id BIGINT UNIQUE,
  token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_wallet_address_lower
  ON telegram_connections (lower(wallet_address));

CREATE INDEX IF NOT EXISTS idx_telegram_connections_token_expires_at
  ON telegram_connections (token_expires_at);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_connected_created_at
  ON telegram_connections (connected, created_at DESC);

COMMENT ON TABLE telegram_connections IS 'Tracks wallet to Telegram connection intents and confirmed links';
COMMENT ON COLUMN telegram_connections.wallet_address IS 'Lowercased wallet address associated with the Telegram connection flow';
COMMENT ON COLUMN telegram_connections.telegram_chat_id IS 'Telegram chat ID attached after the user completes the connection flow';
COMMENT ON COLUMN telegram_connections.token IS 'Unique short-lived token used to complete the Telegram connection handshake';
COMMENT ON COLUMN telegram_connections.token_expires_at IS 'Expiration time for the Telegram connection token';
COMMENT ON COLUMN telegram_connections.connected IS 'Whether the wallet has been successfully linked to Telegram';
COMMENT ON COLUMN telegram_connections.connected_at IS 'Timestamp when the Telegram connection was confirmed';
COMMENT ON COLUMN telegram_connections.created_at IS 'Timestamp when the Telegram connection intent was created';

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can create telegram connection intents" ON telegram_connections;
CREATE POLICY "Anon can create telegram connection intents"
  ON telegram_connections
  FOR INSERT
  TO anon
  WITH CHECK (
    wallet_address = lower(btrim(wallet_address))
    AND btrim(wallet_address) <> ''
    AND btrim(token) <> ''
    AND token_expires_at > now()
    AND connected = false
    AND connected_at IS NULL
  );

DROP POLICY IF EXISTS "Authenticated can create telegram connection intents" ON telegram_connections;
CREATE POLICY "Authenticated can create telegram connection intents"
  ON telegram_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    wallet_address = lower(btrim(wallet_address))
    AND btrim(wallet_address) <> ''
    AND btrim(token) <> ''
    AND token_expires_at > now()
    AND connected = false
    AND connected_at IS NULL
  );
