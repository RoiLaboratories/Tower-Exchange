# Recurring Orders Quick Reference

## User Flow (What Users See)

```
1. User navigates to /recurring-orders
2. Selects order type: Buy or Sell
3. Fills in form:
   - Amount to trade
   - Token to pay with (Buy) / Token to sell (Sell)
   - Token to receive
   - Frequency (Daily/Weekly/Monthly)
   - Optional: End date
4. Clicks "Continue"
5. Wallet pops up asking to sign message
6. User approves signature
7. Order created successfully
8. Order executes automatically on schedule
```

## How Orders Execute Automatically

```
Scheduled (pg_cron)          Every hour at :00 (e.g., 3:00 PM, 4:00 PM)
         │
         ▼
Edge Function               Checks for orders where next_execution_date <= now()
         │
         ├──→ Gets QuantumExchange swap quote
         ├──→ [TODO: Signs transaction with wallet key]
         ├──→ [TODO: Sends to Arc blockchain]
         ├──→ Logs result to recurring_order_executions
         └──→ Updates next_execution_date
         │
         ▼
Result                      Successful or Failed (tracked in database)
```

## Database Queries

### View All Active Orders
```sql
SELECT id, wallet_address, source_token, target_token, amount, 
       frequency, next_execution_date, is_active
FROM recurring_orders
WHERE is_active = true
ORDER BY next_execution_date;
```

### View Recent Executions
```sql
SELECT e.id, e.recurring_order_id, e.status, e.execution_date, 
       e.transaction_hash, e.error_message,
       r.source_token, r.target_token
FROM recurring_order_executions e
JOIN recurring_orders r ON e.recurring_order_id = r.id
WHERE e.execution_date > now() - interval '7 days'
ORDER BY e.execution_date DESC;
```

### Find Failed Orders
```sql
SELECT ro.id, ro.wallet_address, COUNT(*) as failures, 
       MAX(roe.execution_date) as last_attempt
FROM recurring_order_executions roe
JOIN recurring_orders ro ON roe.recurring_order_id = ro.id
WHERE roe.status = 'Failed'
GROUP BY ro.id, ro.wallet_address
HAVING COUNT(*) > 2;
```

### Disable Auto-Execution for Testing
```sql
-- Pause a specific order
UPDATE recurring_orders SET is_active = false 
WHERE id = 'order-id';

-- Resume order
UPDATE recurring_orders SET is_active = true 
WHERE id = 'order-id';
```

## File Overview

| File | Purpose |
|------|---------|
| `supabase/functions/execute-recurring-orders/index.ts` | Main execution logic |
| `supabase/functions/execute-recurring-orders/config.ts` | Execution settings |
| `lib/recurringOrderService.ts` | Database operations |
| `components/reusable/RecurringBuys.tsx` | Buy order form UI |
| `components/reusable/RecurringSell.tsx` | Sell order form UI |
| `docs/RECURRING_ORDERS_EXECUTION.md` | Implementation guide |

## Common Tasks

### Deploy Edge Function
```bash
supabase functions deploy execute-recurring-orders --no-verify-jwt
```

### Test Execution
```bash
# Make an order due for immediate execution
UPDATE recurring_orders 
SET next_execution_date = now() - interval '1 hour'
WHERE id = 'test-order-id';

# Wait for next hour or check logs
SELECT * FROM recurring_order_executions 
WHERE recurring_order_id = 'test-order-id'
ORDER BY execution_date DESC;
```

### Check Cron Status
```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View recent job executions
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC LIMIT 10;

-- View logs of last execution
SELECT * FROM cron.job_run_details 
WHERE job_name = 'execute-recurring-orders-hourly'
ORDER BY start_time DESC LIMIT 1;
```

### Manually Trigger Execution
```bash
# Using Supabase CLI
supabase functions invoke execute-recurring-orders \
  --no-verify-jwt

# Using curl
curl -X POST https://your-project.supabase.co/functions/v1/execute-recurring-orders \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json"
```

## Frequencies Supported

- **Daily**: Executes every day at the same time
- **Weekly**: Executes once per week
- **Bi-weekly**: Executes every 2 weeks
- **Monthly**: Executes once per month

## Token Pairs Available

The system supports these token pairs:
- USDC, WUSDC, QTM, EURC, SWPRC, USDT, UNI, HYPE, ETH

(Determined by QuantumExchange API availability)

## Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| Pending | Order created, waiting for first execution | No action needed |
| Successful | Order executed, transaction confirmed | Normal operation |
| Failed | Order execution failed | Review error message, may auto-retry |

## Troubleshooting

### Orders Not Executing?
1. Check if order has `is_active = true`
2. Verify `next_execution_date` is in the past
3. Check Edge Function deployment status
4. Review cron job logs
5. Check database connection

### Transaction Fails with "No signature column"?
✅ **Fixed** - Removed signature insertion until database migration runs

### Orders Execute at Wrong Times?
- Check cron schedule setting (should be `0 * * * *` for hourly)
- Verify server timezone (UTC is default)
- Check if multiple cron jobs are scheduled

## Configuration

Edit in `supabase/functions/execute-recurring-orders/config.ts`:
- `MAX_ORDERS_PER_RUN`: How many orders per execution (default: 100)
- `ORDER_EXECUTION_TIMEOUT`: Max time per order (default: 30s)
- `MAX_RETRIES`: Retry attempts (default: 3)
- `ENABLE_LOGGING`: Log level (default: true)

## Performance

**Expected Performance:**
- Process up to 100 orders per hour
- ~100-500ms per order execution
- Can handle thousands of orders total

**Optimization Tips:**
- Reduce `MAX_ORDERS_PER_RUN` if database load is high
- Increase cron frequency if more real-time execution needed
- Monitor cron job duration and adjust schedule if needed

## Security Notes

⚠️ **Private Keys**: Not yet implemented - use KMS or Vault for production
⚠️ **Wallet Access**: Edge Function needs secure key storage
⚠️ **Authorization**: Service role key required for Edge Function

See [RECURRING_ORDERS_EXECUTION.md](./RECURRING_ORDERS_EXECUTION.md) for security setup.

## Next Steps

1. ✅ Create Edge Function (done)
2. ✅ Set up database schema (done)
3. ✅ Configure scheduling (done)
4. ⏳ **Implement wallet signing** (next)
5. ⏳ **Deploy to Supabase**
6. ⏳ **Test with real orders**
7. ⏳ **Monitor execution**

## Links

- [Main Implementation Guide](./RECURRING_ORDERS_EXECUTION.md)
- [Deployment Guide](../supabase/functions/execute-recurring-orders/README.md)
- [Setup Guide](./RECURRING_ORDERS_SETUP.md)
- [Dashboard Guide](./RECURRING_ORDERS_DASHBOARD.md)
