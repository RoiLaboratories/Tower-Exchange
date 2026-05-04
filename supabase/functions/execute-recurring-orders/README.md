# Execute Recurring Orders - Supabase Edge Function

This Edge Function automatically executes recurring buy/sell orders on a scheduled basis.

## ⚠️ REQUIRED SETUP

**The cron job must be set up manually in Supabase!** See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for details.

## Quick Setup

### 1. Deploy the Edge Function

```bash
supabase functions deploy execute-recurring-orders
```

### 2. Set Up Cron Job (CRITICAL!)

Follow the instructions in [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) to set up the cron job in Supabase SQL Editor.

**Without this step, recurring orders will NOT execute automatically.**

### 3. Verify Setup

Run in Supabase SQL Editor:
```sql
-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname LIKE '%recurring%';

-- Check recent executions
SELECT * FROM cron.job_run_details 
WHERE job_name = 'execute-recurring-orders-15min' 
ORDER BY start_time DESC LIMIT 5;
```

## System Architecture

### Execution Flow

```
Cron Job (every 15 min)
    ↓
Edge Function (execute-recurring-orders)
    ↓
Query: Get active orders due for execution
    ↓
For each order:
  • Get swap quote from the Tower swap backend
  • Build transaction
  • Sign via Privy
  • Broadcast to Arc RPC
  • Update next_execution_date
  • Log execution
```

## What Gets Executed

Orders are executed when:
- `is_active = true`
- `next_execution_date <= current_time`
- Wallet has sufficient balance
- No errors during transaction building/signing

## Common Issues

### "No orders to execute"
✅ Normal - means no orders are due yet

### Cron job not in list
❌ **Critical** - Run the setup SQL from SETUP_INSTRUCTIONS.md

### "Failed to get quote"
- Tower swap backend API is down
- `TOWER_BACKEND_URL` is missing or points to the Tower-Exchange-AI chat service
- The swap backend requires auth but `TOWER_BACKEND_API_KEY` is missing
- Order tokens might not be supported
- Check function logs for the resolved `swapBackendHost`

### "Transaction build failed"
- Invalid token combination
- Insufficient liquidity
- Check Tower swap backend API response

## Configuration

Edit [config.ts](config.ts) to adjust:
- `MAX_ORDERS_PER_RUN`: How many orders to process per execution (default: 100)
- `BATCH_SIZE`: Parallel execution (default: 1, recommend keeping at 1)
- `ORDER_EXECUTION_TIMEOUT`: Timeout per order (default: 30s)
- `LOG_LEVEL`: Debug verbosity (default: 'info')

## Monitoring

### View Execution History

```sql
SELECT * FROM recurring_order_executions 
WHERE status = 'Failed'
ORDER BY execution_date DESC
LIMIT 20;
```

### View Active Orders

```sql
SELECT id, wallet_address, source_token, target_token, frequency, 
       next_execution_date, execution_count
FROM recurring_orders
WHERE is_active = true
ORDER BY next_execution_date ASC;
```

### View Edge Function Logs

In Supabase Dashboard:
1. Go to **Functions**
2. Click **execute-recurring-orders**
3. Check **Logs** tab

Logs include:
- Orders fetched
- Execution attempts
- Success/failure status
- Error details

## Scaling

For production with many orders:

1. **Increase execution frequency:**
```sql
-- Change to every 5 minutes (more aggressive)
SELECT cron.unschedule('execute-recurring-orders-15min');
SELECT cron.schedule(
  'execute-recurring-orders-5min',
  '*/5 * * * *',
  ...
);
```

2. **Implement exponential backoff** for failed orders

3. **Add rate limiting** to Tower swap backend calls

4. **Consider splitting by wallet** for parallel execution

## Environment Variables

Add to Supabase Function Settings:
- `TOWER_BACKEND_URL` - Swap backend base URL, for example `https://tower-backend.vercel.app`
- `TOWER_BACKEND_API_KEY` - Optional server-only API key if `/api/swap/quote` and `/api/swap/build-tx` are protected
- `TOWER_BACKEND_AUTH_HEADER` - Optional auth header name, defaults to `Authorization`
- `RECURRING_ORDER_EXECUTOR_ADDRESS` - Deployed recurring order executor
- `RECURRING_ORDER_RELAYER_PRIVATE_KEY` - Relayer wallet private key
- `ARC_TESTNET_RPC_URL` - Arc RPC URL

## Security

⚠️ **Important:**
- Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase)
- Cron job stores service key in database - ensure pgcrypto encryption
- Consider rotating service role keys regularly
- Never commit credentials to git

## Troubleshooting Checklist

- [ ] Edge Function deployed successfully
- [ ] Cron job created in SQL Editor (run: `SELECT * FROM cron.job`)
- [ ] `pg_cron` extension enabled
- [ ] `http` extension enabled
- [ ] Recurring orders exist and `is_active = true`
- [ ] Orders' `next_execution_date` is in the past
- [ ] Edge Function logs show execution attempts
- [ ] Network connectivity to Tower swap backend and Arc RPC

## Next Steps

See [SETUP_INSTRUCTIONS.md](/SETUP_INSTRUCTIONS.md) for the complete manual setup guide.

- Implement strict access controls

⚠️ **Authorization**:
- Verify requests come from your cron scheduler
- Consider adding additional authentication layers
- Log all execution attempts for audit trails

## Testing

### Test the Edge Function Manually

```bash
# Deploy first
supabase functions deploy execute-recurring-orders

# Invoke with curl
curl -X POST https://your-project.supabase.co/functions/v1/execute-recurring-orders \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Create Test Orders

```sql
INSERT INTO recurring_orders (
  wallet_address,
  order_type,
  source_token,
  target_token,
  amount,
  frequency,
  next_execution_date,
  is_active
) VALUES (
  '0x742d35Cc6634C0532925a3b844Bc8e9dC9aB0aC3',
  'buy',
  'USDC',
  'QTM',
  10.0,
  'Weekly',
  now() - interval '1 hour', -- Set to past so it executes immediately
  true
);
```

### View Execution Results

```sql
SELECT * FROM recurring_order_executions 
ORDER BY execution_date DESC 
LIMIT 10;
```

## Monitoring

### Check Cron Job Logs

```sql
-- View cron job execution logs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Monitor Order Executions

```sql
-- Recent executions
SELECT 
  e.id,
  e.recurring_order_id,
  e.status,
  e.execution_date,
  r.source_token,
  r.target_token,
  r.amount
FROM recurring_order_executions e
JOIN recurring_orders r ON e.recurring_order_id = r.id
WHERE e.execution_date > now() - interval '24 hours'
ORDER BY e.execution_date DESC;
```

### Check Failed Orders

```sql
SELECT * FROM recurring_order_executions 
WHERE status = 'Failed' 
ORDER BY execution_date DESC;
```

## Troubleshooting

### Function Not Executing?

1. Check that pg_cron is enabled:
   ```sql
   SELECT * FROM cron.job;
   ```

2. Verify the Edge Function is deployed:
   ```bash
   supabase functions list
   ```

3. Check cron job logs:
   ```sql
   SELECT * FROM cron.job_run_details LIMIT 10;
   ```

### Transactions Not Being Sent?

The current implementation has a placeholder for `sendSwapTransaction()`. You need to:

1. Implement actual wallet signing
2. Connect to Arc RPC to send transactions
3. Handle transaction confirmations

See "Wallet Signing & Transaction Sending" section above.

### Database Connection Issues?

- Verify service role key is correct
- Check that the database is accessible from Edge Functions
- Review Supabase logs for any errors

## Future Enhancements

- [ ] Implement actual wallet signing (with secure key management)
- [ ] Add transaction confirmation waiting
- [ ] Implement retry logic for failed executions
- [ ] Add webhook notifications when orders execute
- [ ] Support more token pairs and swap protocols
- [ ] Add gas price optimization
- [ ] Implement slippage protection
