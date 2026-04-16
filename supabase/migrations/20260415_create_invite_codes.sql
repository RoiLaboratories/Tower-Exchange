-- Secure invite code storage and redemption tracking.
-- Plain invite codes are NOT stored in the database. Only SHA-256 hashes are stored.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT UNIQUE,
  batch_name TEXT,
  max_uses INTEGER NOT NULL DEFAULT 11 CHECK (max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS batch_name TEXT,
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS uses_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invite_codes'
      AND column_name = 'code'
  ) THEN
    EXECUTE $sql$
      UPDATE invite_codes
      SET code_hash = encode(extensions.digest(upper(btrim(code)), 'sha256'::text), 'hex')
      WHERE code_hash IS NULL AND code IS NOT NULL
    $sql$;
  END IF;
END
$$;

UPDATE invite_codes
SET is_active = uses_count < max_uses
WHERE is_active IS DISTINCT FROM (uses_count < max_uses);

ALTER TABLE invite_codes
  ALTER COLUMN code_hash SET NOT NULL;

ALTER TABLE invite_codes
  DROP CONSTRAINT IF EXISTS invite_codes_code_uppercase;

ALTER TABLE invite_codes
  DROP CONSTRAINT IF EXISTS invite_codes_usage_limit;

ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_usage_limit CHECK (uses_count <= max_uses);

DROP INDEX IF EXISTS idx_invite_codes_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_code_hash
  ON invite_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active
  ON invite_codes(is_active);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invite_codes'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE invite_codes DROP COLUMN code;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS invite_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  wallet_address TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_code_redemptions
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_code_id
  ON invite_code_redemptions(invite_code_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_code_redemptions_unique_wallet
  ON invite_code_redemptions(invite_code_id, lower(wallet_address))
  WHERE wallet_address IS NOT NULL AND btrim(wallet_address) <> '';

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_code_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_codes'
      AND policyname = 'Anyone can view invite codes'
  ) THEN
    DROP POLICY "Anyone can view invite codes" ON invite_codes;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_code_redemptions'
      AND policyname = 'Anyone can view invite code redemptions'
  ) THEN
    DROP POLICY "Anyone can view invite code redemptions" ON invite_code_redemptions;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_code_redemptions'
      AND policyname = 'Anyone can insert invite code redemptions'
  ) THEN
    DROP POLICY "Anyone can insert invite code redemptions" ON invite_code_redemptions;
  END IF;
END
$$;

REVOKE ALL ON invite_codes FROM anon, authenticated;
REVOKE ALL ON invite_code_redemptions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

REVOKE ALL ON FUNCTION redeem_invite_code(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT, TEXT, JSONB) TO anon, authenticated;

DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON invite_codes;
CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
