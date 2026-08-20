-- Cleanup residual PoC rows from the tower-followup BOLA retest.
-- Run in Supabase SQL editor with a privileged role (service role / dashboard).

DELETE FROM public.swap_fees
WHERE id = '35d234bd-6516-4d13-a7e2-a334756179ea';

DELETE FROM public.activities
WHERE id = 'cfe1350b-f378-4fe8-bbae-f1b149eb3ac2';
