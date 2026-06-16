-- Squire badge eligibility and claim tracking.

CREATE TABLE IF NOT EXISTS user_badges (
  wallet_address TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (wallet_address, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_wallet_address_lower
  ON user_badges (lower(wallet_address));

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_badges'
      AND policyname = 'Authenticated can claim own squire badge'
  ) THEN
    DROP POLICY "Authenticated can claim own squire badge" ON user_badges;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_badges'
      AND policyname = 'Authenticated can update own squire badge'
  ) THEN
    DROP POLICY "Authenticated can update own squire badge" ON user_badges;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_badges'
      AND policyname = 'Anyone can insert squire badge claims'
  ) THEN
    CREATE POLICY "Anyone can insert squire badge claims"
      ON user_badges
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        badge_id = 'squire'
        AND wallet_address = lower(btrim(wallet_address))
        AND btrim(wallet_address) <> ''
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_badges'
      AND policyname = 'Anyone can update squire badge claims'
  ) THEN
    CREATE POLICY "Anyone can update squire badge claims"
      ON user_badges
      FOR UPDATE
      TO anon, authenticated
      USING (badge_id = 'squire')
      WITH CHECK (
        badge_id = 'squire'
        AND wallet_address = lower(btrim(wallet_address))
        AND btrim(wallet_address) <> ''
      );
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_badges'
      AND policyname = 'Anyone can view user badges'
  ) THEN
    CREATE POLICY "Anyone can view user badges"
      ON user_badges FOR SELECT
      USING (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_squire_badge_status(
  input_wallet_address TEXT
)
RETURNS TABLE (
  wallet_address TEXT,
  badge_id TEXT,
  volume_usd NUMERIC,
  bridge_count BIGINT,
  swap_count BIGINT,
  recurring_orders_count BIGINT,
  ai_messages_sent_count BIGINT,
  criteria_met_count INTEGER,
  is_eligible BOOLEAN,
  is_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_wallet TEXT := NULLIF(lower(btrim(COALESCE(input_wallet_address, ''))), '');
  v_volume_usd NUMERIC := 0;
  v_bridge_count BIGINT := 0;
  v_swap_count BIGINT := 0;
  v_recurring_orders_count BIGINT := 0;
  v_ai_messages_sent_count BIGINT := 0;
  v_criteria_met_count INTEGER := 0;
  v_is_claimed BOOLEAN := false;
BEGIN
  IF normalized_wallet IS NULL THEN
    RETURN QUERY
    SELECT
      ''::TEXT,
      'squire'::TEXT,
      0::NUMERIC,
      0::BIGINT,
      0::BIGINT,
      0::BIGINT,
      0::BIGINT,
      0::INTEGER,
      false,
      false;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(COALESCE(a.amount_usd, a.amount, 0)), 0)
  INTO v_volume_usd
  FROM activities a
  WHERE lower(a.wallet_address) = normalized_wallet
    AND lower(a.status) = 'successful'
    AND (
      a.type ILIKE '%swap%'
      OR a.type ILIKE '%bridge%'
    );


  SELECT COUNT(*)
  INTO v_bridge_count
  FROM activities a2
  WHERE lower(a2.wallet_address) = normalized_wallet
    AND lower(a2.status) = 'successful'
    AND a2.type ILIKE '%bridge%';

  SELECT COUNT(*)
  INTO v_swap_count
  FROM activities a3
  WHERE lower(a3.wallet_address) = normalized_wallet
    AND lower(a3.status) = 'successful'
    AND a3.type ILIKE '%swap%';


  SELECT COUNT(*)
  INTO v_recurring_orders_count
  FROM recurring_orders
  WHERE lower(wallet_address) = normalized_wallet;

  SELECT COUNT(*)
  INTO v_ai_messages_sent_count
  FROM ai_db
  WHERE lower(user_id) = normalized_wallet;

  v_criteria_met_count :=
    CASE WHEN v_volume_usd >= 1 THEN 1 ELSE 0 END +
    CASE WHEN v_bridge_count >= 10 THEN 1 ELSE 0 END +
    CASE WHEN v_swap_count >= 5 THEN 1 ELSE 0 END +
    CASE WHEN v_recurring_orders_count >= 20 THEN 1 ELSE 0 END +
    CASE WHEN v_ai_messages_sent_count >= 1 THEN 1 ELSE 0 END;

  SELECT EXISTS (
    SELECT 1
    FROM user_badges
    WHERE lower(user_badges.wallet_address) = normalized_wallet
      AND user_badges.badge_id = 'squire'
  )
  INTO v_is_claimed;

  RETURN QUERY
  SELECT
    normalized_wallet,
    'squire'::TEXT,
    v_volume_usd,
    v_bridge_count,
    v_swap_count,
    v_recurring_orders_count,
    v_ai_messages_sent_count,
    v_criteria_met_count,
    v_criteria_met_count >= 3,
    v_is_claimed;
END;
$$;

CREATE OR REPLACE FUNCTION claim_squire_badge(
  input_wallet_address TEXT
)
RETURNS TABLE (
  wallet_address TEXT,
  badge_id TEXT,
  volume_usd NUMERIC,
  bridge_count BIGINT,
  swap_count BIGINT,
  recurring_orders_count BIGINT,
  ai_messages_sent_count BIGINT,
  criteria_met_count INTEGER,
  is_eligible BOOLEAN,
  is_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_row RECORD;
BEGIN
  SELECT *
  INTO status_row
  FROM get_squire_badge_status(input_wallet_address)
  LIMIT 1;

  IF status_row.is_eligible IS NOT TRUE THEN
    RETURN QUERY
    SELECT *
    FROM get_squire_badge_status(input_wallet_address);
    RETURN;
  END IF;

  INSERT INTO user_badges (wallet_address, badge_id, metadata)
  VALUES (
    status_row.wallet_address,
    'squire',
    jsonb_build_object(
      'volume_usd', status_row.volume_usd,
      'bridge_count', status_row.bridge_count,
      'swap_count', status_row.swap_count,
      'recurring_orders_count', status_row.recurring_orders_count,
      'ai_messages_sent_count', status_row.ai_messages_sent_count,
      'criteria_met_count', status_row.criteria_met_count
    )
  )
  ON CONFLICT (wallet_address, badge_id)
  DO UPDATE SET
    metadata = EXCLUDED.metadata,
    claimed_at = user_badges.claimed_at;

  RETURN QUERY
  SELECT *
  FROM get_squire_badge_status(input_wallet_address);
END;
$$;

REVOKE ALL ON FUNCTION get_squire_badge_status(TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION claim_squire_badge(TEXT) FROM PUBLIC;

-- Optional: Keep existing grants intact
GRANT EXECUTE ON FUNCTION get_squire_badge_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_squire_badge(TEXT) TO anon, authenticated;
