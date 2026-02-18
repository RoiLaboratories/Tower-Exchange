# Execute Recurring Orders - Supabase Edge Function

This Edge Function automatically executes recurring buy/sell orders on a scheduled basis.

## Setup Instructions

### 1. Deploy the Edge Function

```bash
supabase functions deploy execute-recurring-orders
```

### 2. Enable pg_cron Extension

Run this SQL in the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 3. Set Up Cron Job Scheduling

The cron scheduling is already configured in `schema.sql`. It will:
- Check for orders due for execution every hour
- Automatically trigger the Edge Function to process them

To view all scheduled jobs:

```sql
SELECT * FROM cron.job;
```

To unschedule a job:

```sql
SELECT cron.unschedule('execute-recurring-orders-hourly');
```

## How It Works

1. **Scheduler** (pg_cron): Every hour, calls the Edge Function
2. **Edge Function** (this file): 
   - Fetches all active orders where `next_execution_date <= now()`
   - Calls QuantumExchange API to get swap quotes
   - Sends swap transactions to Arc blockchain
   - Logs execution results in `recurring_order_executions` table
   - Updates `next_execution_date` for next scheduled execution

## Environment Variables

Required for the Edge Function:
- `SUPABASE_URL`: Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role API key (auto-provided)

## Key Features

✅ **Automatic Execution** - Orders execute automatically without user intervention
✅ **Error Handling** - Failed orders are logged with error messages
✅ **Frequency Support** - Daily, Weekly, Bi-weekly, Monthly
✅ **Transaction Logging** - All executions tracked in execution history
✅ **Batch Processing** - Handles up to 100 orders per run

## Important Notes

### Wallet Signing & Transaction Sending

**Current Implementation (Placeholder):**
The `sendSwapTransaction()` function is a placeholder that returns mock transaction hashes. 

**For Production, you need to:**

1. **Sign Transactions**: 
   - Store wallet private keys securely (e.g., AWS KMS, Vault)
   - Use ethers.js or Web3.js to sign transactions
   - Or use a service like Privy's key management

2. **Send to Blockchain**:
   ```typescript
   // Example using ethers.js
   const provider = new ethers.JsonRpcProvider(arcRpcUrl);
   const signer = new ethers.Wallet(privateKey, provider);
   const tx = await signer.sendTransaction(transactionData);
   const receipt = await tx.wait();
   ```

3. **Handle Confirmations**:
   - Wait for transaction confirmation
   - Update execution status accordingly
   - Implement retry logic for failed transactions

### Security Considerations

⚠️ **Private Key Management**: 
- Never hardcode private keys in the Edge Function
- Use Supabase Vault or AWS KMS for secure key storage
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
