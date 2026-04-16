-- Fix invite code hashing on Supabase where pgcrypto functions live in the extensions schema.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION redeem_invite_code(
  input_code TEXT,
  redemption_wallet_address TEXT DEFAULT NULL,
  redemption_metadata JSONB DEFAULT '{}'::jsonb
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
  normalized_wallet TEXT := NULLIF(lower(btrim(COALESCE(redemption_wallet_address, ''))), '');
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
  WHERE code_hash = encode(extensions.digest(normalized_code, 'sha256'::text), 'hex')
  FOR UPDATE;

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

  IF normalized_wallet IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM invite_code_redemptions
      WHERE invite_code_id = target_code.id
        AND lower(wallet_address) = normalized_wallet
    )
  THEN
    RETURN QUERY
    SELECT
      true,
      'Wallet already redeemed this invite code.',
      GREATEST(target_code.max_uses - target_code.uses_count, 0),
      target_code.uses_count,
      target_code.max_uses;
    RETURN;
  END IF;

  INSERT INTO invite_code_redemptions (invite_code_id, wallet_address, metadata)
  VALUES (target_code.id, normalized_wallet, COALESCE(redemption_metadata, '{}'::jsonb));

  UPDATE invite_codes AS ic
  SET
    uses_count = ic.uses_count + 1,
    is_active = (ic.uses_count + 1) < ic.max_uses,
    updated_at = now()
  WHERE ic.id = target_code.id
  RETURNING * INTO target_code;

  RETURN QUERY
  SELECT
    true,
    'Invite code accepted.',
    GREATEST(target_code.max_uses - target_code.uses_count, 0),
    target_code.uses_count,
    target_code.max_uses;
END;
$$;
