-- Create indexes on wallet_address columns for faster queries
CREATE INDEX IF NOT EXISTS idx_activities_wallet_address
  ON activities (wallet_address)
  WHERE status = 'Successful';

CREATE INDEX IF NOT EXISTS idx_activities_wallet_type
  ON activities (wallet_address, type)
  WHERE status = 'Successful';

CREATE INDEX IF NOT EXISTS idx_recurring_orders_wallet
  ON recurring_orders (wallet_address);

CREATE INDEX IF NOT EXISTS idx_ai_db_user_id
  ON ai_db (user_id);

-- Create an optimized RPC function for squire badge calculation
CREATE OR REPLACE FUNCTION get_squire_badge_status_optimized(input_wallet_address TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  badge_id TEXT,
  volume_usd NUMERIC,
  bridge_count BIGINT,
  swap_count BIGINT,
  recurring_orders_count BIGINT,
  ai_messages_sent_count BIGINT,
  criteria_met_count INT,
  is_eligible BOOLEAN,
  is_claimed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH activity_stats AS (
    SELECT
      COALESCE(SUM(CASE 
        WHEN type ILIKE '%bridge%' OR type ILIKE '%swap%' 
        THEN CAST(COALESCE(amount_usd, amount, 0) AS NUMERIC)
        ELSE 0
      END), 0) as total_volume,
      COUNT(CASE WHEN type ILIKE '%bridge%' THEN 1 END) as bridge_cnt,
      COUNT(CASE WHEN type ILIKE '%swap%' THEN 1 END) as swap_cnt
    FROM activities
    WHERE wallet_address = input_wallet_address
      AND status = 'Successful'
  ),
  recurring_orders_stats AS (
    SELECT COUNT(*) as recurring_cnt
    FROM recurring_orders
    WHERE wallet_address = input_wallet_address
  ),
  ai_messages_stats AS (
    SELECT COUNT(*) as ai_msg_cnt
    FROM ai_db
    WHERE user_id = input_wallet_address
  ),
  badge_claim_stats AS (
    SELECT EXISTS(
      SELECT 1
      FROM user_badges
      WHERE wallet_address = input_wallet_address
        AND badge_id = 'squire'
    ) as is_claimed_flag
  ),
  criteria_check AS (
    SELECT
      CAST(
        (CASE WHEN total_volume >= 1 THEN 1 ELSE 0 END +
         CASE WHEN bridge_cnt >= 10 THEN 1 ELSE 0 END +
         CASE WHEN swap_cnt >= 5 THEN 1 ELSE 0 END +
         CASE WHEN recurring_cnt >= 20 THEN 1 ELSE 0 END +
         CASE WHEN ai_msg_cnt >= 1 THEN 1 ELSE 0 END) AS INT
      ) as criteria_met
    FROM activity_stats, recurring_orders_stats, ai_messages_stats
  )
  SELECT
    input_wallet_address,
    'squire'::TEXT,
    (SELECT total_volume FROM activity_stats)::NUMERIC,
    (SELECT bridge_cnt FROM activity_stats),
    (SELECT swap_cnt FROM activity_stats),
    (SELECT recurring_cnt FROM recurring_orders_stats),
    (SELECT ai_msg_cnt FROM ai_messages_stats),
    (SELECT criteria_met FROM criteria_check),
    ((SELECT criteria_met FROM criteria_check) >= 3),
    (SELECT is_claimed_flag FROM badge_claim_stats);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute on the function to anon and authenticated
GRANT EXECUTE ON FUNCTION get_squire_badge_status_optimized(TEXT) TO anon, authenticated;
