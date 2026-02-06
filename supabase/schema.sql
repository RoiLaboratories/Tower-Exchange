-- Supabase Schema for Tower Exchange Activities and AI Chat

-- ============================================================================
-- ACTIVITIES TABLE
-- ============================================================================

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
CREATE POLICY "Users can view their own activities"
  ON activities FOR SELECT
  USING (true);

-- Policy: Users can insert their own activities
CREATE POLICY "Users can insert their own activities"
  ON activities FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own activities (e.g., status changes)
CREATE POLICY "Users can update their own activities"
  ON activities FOR UPDATE
  USING (true);

-- ============================================================================
-- AI CHAT MESSAGES TABLE
-- ============================================================================

-- Create chat messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL, -- Wallet address of the user
  session_id UUID NOT NULL, -- Chat session identifier (groups related messages)
  message_text TEXT NOT NULL, -- The message content
  is_user_message BOOLEAN NOT NULL, -- true = user message, false = AI response
  message_type VARCHAR(50) DEFAULT 'text', -- e.g., 'text', 'chart', 'analysis'
  
  -- Metadata for tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_wallet_address ON ai_chat_messages(wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_session_id ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON ai_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user_message ON ai_chat_messages(is_user_message);

-- Enable Row Level Security for chat messages
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own chat messages
CREATE POLICY "Users can view their own chat messages"
  ON ai_chat_messages FOR SELECT
  USING (true);

-- Policy: Users can insert their own chat messages
CREATE POLICY "Users can insert their own chat messages"
  ON ai_chat_messages FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- CHAT SESSIONS TABLE
-- ============================================================================

-- Create chat sessions table to track conversation sessions
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL, -- Wallet address of the user
  title VARCHAR(255), -- Session title (auto-generated or custom)
  is_active BOOLEAN DEFAULT true, -- Whether the session is ongoing
  message_count INTEGER DEFAULT 0, -- Number of messages in this session
  last_message_at TIMESTAMPTZ, -- Timestamp of the last message
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for chat sessions
CREATE INDEX IF NOT EXISTS idx_session_wallet_address ON ai_chat_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_session_is_active ON ai_chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_session_created_at ON ai_chat_sessions(created_at DESC);

-- Enable Row Level Security for chat sessions
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON ai_chat_sessions FOR SELECT
  USING (true);

-- Policy: Users can create sessions
CREATE POLICY "Users can create sessions"
  ON ai_chat_sessions FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON ai_chat_sessions FOR UPDATE
  USING (true);

-- ============================================================================
-- FUNCTION TO UPDATE TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp (if not already created)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for activities
DROP TRIGGER IF EXISTS update_activities_updated_at ON activities;
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for chat messages
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON ai_chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for chat sessions
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON ai_chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON ai_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EXAMPLE INSERTS (FOR TESTING)
-- ============================================================================

-- Example: Insert a chat session
-- INSERT INTO ai_chat_sessions (wallet_address, title)
-- VALUES ('0x1234567890123456789012345678901234567890', 'My First Chat Session');

-- Example: Insert a user message
-- INSERT INTO ai_chat_messages (wallet_address, session_id, message_text, is_user_message, message_type)
-- VALUES (
--   '0x1234567890123456789012345678901234567890',
--   'session-uuid-here',
--   'What are my buy/sell positions?',
--   true,
--   'text'
-- );

-- Example: Insert an AI response
-- INSERT INTO ai_chat_messages (wallet_address, session_id, message_text, is_user_message, message_type)
-- VALUES (
--   '0x1234567890123456789012345678901234567890',
--   'session-uuid-here',
--   'You currently hold $1000 USDC and short $500 worth of ETH.',
--   false,
--   'text'
-- );

-- ============================================================================
-- RECURRING ORDERS TABLE (Recurring Buys and Sells)
-- ============================================================================

-- Create recurring orders table
CREATE TABLE IF NOT EXISTS recurring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL, -- Wallet address of the user
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')), -- 'buy' or 'sell'
  
  -- Token details
  source_token VARCHAR(10) NOT NULL, -- Token being spent/sold (e.g., 'USDC')
  target_token VARCHAR(10) NOT NULL, -- Token being purchased/received (e.g., 'ETH')
  
  -- Order details
  amount NUMERIC(20, 10) NOT NULL, -- Amount per order
  frequency VARCHAR(50) NOT NULL, -- e.g., 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'
  
  -- Scheduling
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(), -- When recurring order starts
  end_date TIMESTAMPTZ, -- When recurring order ends (nullable for ongoing orders)
  next_execution_date TIMESTAMPTZ, -- Next scheduled execution
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Whether the order is active
  execution_count INTEGER DEFAULT 0, -- Number of times executed
  
  -- Wallet authorization
  signature TEXT, -- EIP-191 personal_sign signature from wallet for authorization (nullable)
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for recurring orders
CREATE INDEX IF NOT EXISTS idx_recurring_wallet_address ON recurring_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_recurring_is_active ON recurring_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_next_execution ON recurring_orders(next_execution_date);
CREATE INDEX IF NOT EXISTS idx_recurring_order_type ON recurring_orders(order_type);

-- Enable Row Level Security for recurring orders
ALTER TABLE recurring_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own recurring orders
CREATE POLICY "Users can view their own recurring orders"
  ON recurring_orders FOR SELECT
  USING (true);

-- Policy: Users can create recurring orders
CREATE POLICY "Users can create recurring orders"
  ON recurring_orders FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own recurring orders
CREATE POLICY "Users can update their own recurring orders"
  ON recurring_orders FOR UPDATE
  USING (true);

-- Policy: Users can delete their own recurring orders
CREATE POLICY "Users can delete their own recurring orders"
  ON recurring_orders FOR DELETE
  USING (true);

-- ============================================================================
-- RECURRING ORDER EXECUTIONS TABLE (History/Logs)
-- ============================================================================

-- Create execution history table to track when orders are executed
CREATE TABLE IF NOT EXISTS recurring_order_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_order_id UUID NOT NULL REFERENCES recurring_orders(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL, -- Denormalized for easier querying
  
  -- Execution details
  execution_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(20, 10) NOT NULL, -- Amount executed
  source_token VARCHAR(10) NOT NULL,
  target_token VARCHAR(10) NOT NULL,
  
  -- Transaction details
  transaction_hash TEXT, -- Blockchain transaction hash
  status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Successful', 'Failed'
  error_message TEXT, -- Error details if execution failed
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for execution history
CREATE INDEX IF NOT EXISTS idx_execution_recurring_order_id ON recurring_order_executions(recurring_order_id);
CREATE INDEX IF NOT EXISTS idx_execution_wallet_address ON recurring_order_executions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_execution_date ON recurring_order_executions(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_execution_status ON recurring_order_executions(status);

-- Enable Row Level Security for execution history
ALTER TABLE recurring_order_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own execution history
CREATE POLICY "Users can view their own execution history"
  ON recurring_order_executions FOR SELECT
  USING (true);

-- Trigger to automatically update updated_at for recurring orders
DROP TRIGGER IF EXISTS update_recurring_orders_updated_at ON recurring_orders;
CREATE TRIGGER update_recurring_orders_updated_at
  BEFORE UPDATE ON recurring_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for execution history
DROP TRIGGER IF EXISTS update_execution_history_updated_at ON recurring_order_executions;
CREATE TRIGGER update_execution_history_updated_at
  BEFORE UPDATE ON recurring_order_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUPABASE EDGE FUNCTION SCHEDULING (pg_cron)
-- ============================================================================

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the execute-recurring-orders Edge Function to run every hour
-- This will check for orders due for execution and trigger them automatically
-- NOTE: Replace 'project-id' with your actual Supabase project ID
-- The function runs at 0 minutes past every hour
SELECT cron.schedule(
  'execute-recurring-orders-hourly',
  '0 * * * *', -- Run every hour at the top of the hour
  $$
  SELECT
    net.http_post(
      url := concat(
        'https://',
        current_setting('app.settings.supabase_project_id'),
        '.supabase.co/functions/v1/execute-recurring-orders'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', current_setting('app.settings.supabase_service_key'))
      ),
      body := jsonb_build_object(
        'timestamp', now()
      )
    ) as request_id;
  $$
);

-- Schedule to run every 30 minutes for more frequent execution
-- Uncomment if you want more frequent checks
-- SELECT cron.schedule(
--   'execute-recurring-orders-frequent',
--   '*/30 * * * *', -- Run every 30 minutes
--   $$
--   SELECT
--     net.http_post(
--       url := concat(
--         'https://',
--         current_setting('app.settings.supabase_project_id'),
--         '.supabase.co/functions/v1/execute-recurring-orders'
--       ),
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', concat('Bearer ', current_setting('app.settings.supabase_service_key'))
--       ),
--       body := jsonb_build_object(
--         'timestamp', now()
--       )
--     ) as request_id;
--   $$
-- );

-- View all scheduled cron jobs
-- SELECT * FROM cron.job;

-- Cancel a specific cron job (example)
-- SELECT cron.unschedule('execute-recurring-orders-hourly');

-- ============================================================================
-- EXAMPLE INSERTS (FOR TESTING)
-- ============================================================================

-- Example: Insert a recurring buy order
-- INSERT INTO recurring_orders (
--   wallet_address,
--   order_type,
--   source_token,
--   target_token,
--   amount,
--   frequency,
--   start_date,
--   end_date,
--   next_execution_date,
--   is_active
-- ) VALUES (
--   '0x1234567890123456789012345678901234567890',
--   'buy',
--   'USDC',
--   'ETH',
--   100.00,
--   'Weekly',
--   now(),
--   now() + interval '6 months',
--   now() + interval '1 week',
--   true
-- );

-- Example: Insert a recurring sell order
-- INSERT INTO recurring_orders (
--   wallet_address,
--   order_type,
--   source_token,
--   target_token,
--   amount,
--   frequency,
--   start_date,
--   end_date,
--   next_execution_date,
--   is_active
-- ) VALUES (
--   '0x1234567890123456789012345678901234567890',
--   'sell',
--   'ETH',
--   'USDC',
--   0.5,
--   'Monthly',
--   now(),
--   now() + interval '1 year',
--   now() + interval '1 month',
--   true
-- );
