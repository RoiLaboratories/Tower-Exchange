-- Harden invite-gate admission so wallet access is always verified server-side.

CREATE OR REPLACE FUNCTION validate_invite_code(
  input_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  remaining_uses INTEGER,
  total_uses INTEGER,
  max_uses INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT := upper(btrim(COALESCE(input_code, '')));
  target_code invite_codes%ROWTYPE;
BEGIN
  IF normalized_code = '' THEN
    RETURN QUERY
    SELECT false, 'Invite code is required.', NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT *
  INTO target_code
  FROM invite_codes
  WHERE code_hash = encode(extensions.digest(normalized_code, 'sha256'::text), 'hex');

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'Invalid invite code.', NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  IF NOT target_code.is_active OR target_code.uses_count >= target_code.max_uses THEN
    RETURN QUERY
    SELECT
      false,
      'This invite code has reached its usage limit.',
      GREATEST(target_code.max_uses - target_code.uses_count, 0),
      target_code.uses_count,
      target_code.max_uses;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    'Invite code accepted.',
    GREATEST(target_code.max_uses - target_code.uses_count, 0),
    target_code.uses_count,
    target_code.max_uses;
END;
$$;

REVOKE ALL ON FUNCTION validate_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_invite_code(TEXT) TO anon, authenticated;

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

  IF EXISTS (
    SELECT 1
    FROM activities
    WHERE lower(wallet_address) = normalized_wallet
  ) OR EXISTS (
    SELECT 1
    FROM ai_chat_messages
    WHERE lower(wallet_address) = normalized_wallet
  ) OR EXISTS (
    SELECT 1
    FROM ai_chat_sessions
    WHERE lower(wallet_address) = normalized_wallet
  ) OR EXISTS (
    SELECT 1
    FROM recurring_orders
    WHERE lower(wallet_address) = normalized_wallet
  ) OR EXISTS (
    SELECT 1
    FROM recurring_order_executions
    WHERE lower(wallet_address) = normalized_wallet
  ) OR EXISTS (
    SELECT 1
    FROM swap_fees
    WHERE lower(wallet_address) = normalized_wallet
  ) THEN
    RETURN QUERY
    SELECT true, 'legacy-wallet'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION check_wallet_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_wallet_access(TEXT) TO anon, authenticated;
