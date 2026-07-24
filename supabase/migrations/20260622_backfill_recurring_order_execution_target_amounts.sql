-- Backfill recurring order execution rows that were stored with 18-decimal
-- normalized target amounts instead of native token-decimal amounts.
--
-- Safeguard:
-- Only updates rows where target_amount_usd is wildly larger than
-- source_amount_usd, which is the signature of the normalization bug.
WITH rows_to_fix AS (
  SELECT
    id,
    CASE UPPER(target_token)
      WHEN 'USDC' THEN 1000000000000::numeric
      WHEN 'EURC' THEN 1000000000000::numeric
      WHEN 'USYC' THEN 1000000000000::numeric
      WHEN 'SWPRC' THEN 1000000000000::numeric
      WHEN 'CIRBTC' THEN 10000000000::numeric
      ELSE 1::numeric
    END AS scale_divisor,
    CASE UPPER(target_token)
      WHEN 'USDC' THEN 1::numeric
      WHEN 'WUSDC' THEN 1::numeric
      WHEN 'EURC' THEN 1.08::numeric
      WHEN 'USYC' THEN 1::numeric
      WHEN 'USDT' THEN 1::numeric
      WHEN 'CIRBTC' THEN 404000::numeric
      ELSE NULL::numeric
    END AS usd_price
  FROM recurring_order_executions
  WHERE target_amount IS NOT NULL
    AND target_amount_usd IS NOT NULL
    AND source_amount_usd IS NOT NULL
    AND target_amount_usd > source_amount_usd * 1000
)
UPDATE recurring_order_executions AS executions
SET
  target_amount = executions.target_amount / rows_to_fix.scale_divisor,
  target_amount_usd = CASE
    WHEN rows_to_fix.usd_price IS NOT NULL THEN ROUND((executions.target_amount / rows_to_fix.scale_divisor) * rows_to_fix.usd_price, 2)
    ELSE ROUND(executions.target_amount_usd / rows_to_fix.scale_divisor, 2)
  END
FROM rows_to_fix
WHERE executions.id = rows_to_fix.id
  AND rows_to_fix.scale_divisor > 1;