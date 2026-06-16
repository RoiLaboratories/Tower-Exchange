-- Restore automatic invite-gate admission for wallets that already redeemed an invite.
-- Also keeps the access check working if optional legacy tables are missing in an environment.

CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_wallet_address_lower
  ON invite_code_redemptions (lower(wallet_address))
  WHERE wallet_address IS NOT NULL AND btrim(wallet_address) <> '';

CREATE OR REPLACE FUNCTION check_wallet_access(
  input_wallet_address TEXT
)
RETURNS TABLE (
  is_registered BOOLEAN,
  access_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_wallet TEXT := NULLIF(lower(btrim(COALESCE(input_wallet_address, ''))), '');
  legacy_table TEXT;
  has_legacy_access BOOLEAN;
BEGIN
  IF normalized_wallet IS NULL THEN
    RETURN QUERY
    SELECT false, NULL::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invite_code_redemptions
    WHERE lower(wallet_address) = normalized_wallet
  ) THEN
    RETURN QUERY
    SELECT true, 'invite-redemption'::TEXT;
    RETURN;
  END IF;

  FOREACH legacy_table IN ARRAY ARRAY[
    'activities',
    'ai_chat_messages',
    'ai_chat_sessions',
    'recurring_orders',
    'recurring_order_executions',
    'swap_fees'
  ]
  LOOP
    IF to_regclass(format('public.%I', legacy_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I WHERE lower(wallet_address) = $1)',
      legacy_table
    )
    INTO has_legacy_access
    USING normalized_wallet;

    IF has_legacy_access THEN
      RETURN QUERY
      SELECT true, 'legacy-wallet'::TEXT;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT false, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION check_wallet_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_wallet_access(TEXT) TO anon, authenticated;
