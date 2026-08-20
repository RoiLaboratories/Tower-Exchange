-- Lock down sensitive tables exposed via the public anon key.
-- Root cause: RLS was enabled but policies used USING (true) / WITH CHECK (true).
--
-- After this migration:
--   - anon / authenticated have NO direct table access on listed relations
--   - service_role (API routes, Edge Functions) retains access (bypasses RLS)
--   - SECURITY DEFINER RPCs (invite gate, squire badge) keep working as owner
--
-- REQUIRED APP FOLLOW-UP before/at deploy:
--   Move browser anon-client reads/writes for these tables behind authenticated
--   API routes that use SUPABASE_SERVICE_ROLE_KEY (scoped by verified wallet).

-- ---------------------------------------------------------------------------
-- Helper: drop every policy on a table (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tmp_drop_all_policies(target_table REGCLASS)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pol RECORD;
  table_name TEXT;
BEGIN
  SELECT c.relname
  INTO table_name
  FROM pg_class c
  WHERE c.oid = target_table;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = table_name
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %s',
      pol.policyname,
      target_table
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helper: enable RLS, force it, revoke client roles, grant service_role
-- Accepts schema-qualified name as text so missing tables can be skipped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tmp_lock_table_to_service_role(target_name TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_table REGCLASS := to_regclass(target_name);
BEGIN
  IF target_table IS NULL THEN
    RAISE NOTICE 'Skipping missing table: %', target_name;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target_table);

  PERFORM public._tmp_drop_all_policies(target_table);

  EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', target_table);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', target_table);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM authenticated', target_table);
  EXECUTE format('GRANT ALL ON TABLE %s TO service_role', target_table);
END;
$$;

-- ---------------------------------------------------------------------------
-- P0: full CRUD was open to anon
-- ---------------------------------------------------------------------------
SELECT public._tmp_lock_table_to_service_role('public.recurring_orders');
SELECT public._tmp_lock_table_to_service_role('public.recurring_order_executions');
SELECT public._tmp_lock_table_to_service_role('public.activities');
SELECT public._tmp_lock_table_to_service_role('public.ai_db');
SELECT public._tmp_lock_table_to_service_role('public.ai_chat_messages');
SELECT public._tmp_lock_table_to_service_role('public.ai_chat_sessions');

-- ---------------------------------------------------------------------------
-- P0/P1: fee + badge + connection telemetry
-- ---------------------------------------------------------------------------
SELECT public._tmp_lock_table_to_service_role('public.swap_fees');
SELECT public._tmp_lock_table_to_service_role('public.bridge_fees');
SELECT public._tmp_lock_table_to_service_role('public.user_badges');
SELECT public._tmp_lock_table_to_service_role('public.wallet_connections');
SELECT public._tmp_lock_table_to_service_role('public.telegram_connections');

-- ---------------------------------------------------------------------------
-- P1: catalog / BI / secrets that must not be anon-readable
-- (skip silently if a relation does not exist in this environment)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rel TEXT;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'subscription_plans',
    'api_products',
    'scopes',
    'api_keys',
    'audit_logs',
    'webhooks',
    'payment_methods',
    'rate_limit_counters',
    'security_flags',
    'transaction_confirmations',
    'bridge_wallet',
    'execution_notification_cursor',
    'mv_pairs',
    'mv_daily_new_users'
  ]
  LOOP
    IF to_regclass(format('public.%I', rel)) IS NOT NULL THEN
      -- Views / MVs: revoke client grants; enable RLS only on ordinary tables
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', rel);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', rel);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', rel);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', rel);

      IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = rel
          AND c.relkind = 'r' -- ordinary table only
      ) THEN
        PERFORM public._tmp_lock_table_to_service_role(format('public.%I', rel));
      END IF;
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Cleanup helpers (do not leave privileged DDL helpers around)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public._tmp_lock_table_to_service_role(TEXT);
DROP FUNCTION IF EXISTS public._tmp_drop_all_policies(REGCLASS);
