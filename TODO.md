# Tower-Finance - TODO

- [ ] Inspect existing RLS/policies for `user_badges` in `supabase/migrations/20260611_create_squire_badge_claims.sql`.
- [ ] Add RLS policy for authenticated users to insert/claim their own Squire badge rows (and optionally update their own rows).
- [ ] Ensure policies align with existing `SECURITY DEFINER` functions and don’t block them.
- [ ] Update the SQL file and keep grants intact.
- [ ] (Optional) Validate with Supabase SQL lint/compile or run a quick smoke-check query (manual).

