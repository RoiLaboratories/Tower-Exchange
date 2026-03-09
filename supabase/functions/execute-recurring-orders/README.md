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

## Integration with Tower-Exchange-AI (Option A - Active)

This Edge Function now integrates with **Tower-Exchange-AI** for all swap operations:

### How It Works

1. **Quote Retrieval** 
   - Calls Tower-Exchange-AI `/api/v1/chat` endpoint
   - AI agent returns accurate swap quote with price impact
   - Uses same routing and DEX discovery as frontend

2. **Transaction Building**
   - Calls Tower-Exchange-AI with `enable_wallet_access: true`
   - Gets transaction object with: `to`, `data`, `value`, `gasLimit`
   - Transaction is ready for signing via Arc RPC

3. **Transaction Execution (TODO)**
   - ⚠️ **Transaction signing not yet implemented**
   - Options to complete:
     - **Option 1 (Recommended)**: Privy Server Wallet API
       ```typescript
       const tx = await privy.signAndSendTransaction({
         transaction: txData,
         wallet: walletAddress
       });
       ```
     - **Option 2**: AWS KMS or Supabase Vault for private key storage
       ```typescript
       const signer = new ethers.Wallet(privateKey, provider);
       const tx = await signer.sendTransaction(txData);
       ```
     - **Option 3**: Delegate to separate service (recommended for production)

### Current Status

✅ Quote retrieval - WORKING
✅ Transaction building - WORKING  
⏳ Transaction signing/sending - PENDING IMPLEMENTATION

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

## Implementation Notes

### Transaction Signing Architecture

The Edge Function currently:
1. ✅ Fetches quotes from Tower-Exchange-AI
2. ✅ Builds transactions using Tower-Exchange-AI's transaction builder
3. ⏳ **Needs**: Secure signing mechanism for on-chain transaction

### Recommended Implementation: Privy Server Wallet

**Setup:**
```bash
# Install Privy SDK
npm install @privy-io/server-node

# Set environment variables in Supabase
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
```

**Usage in Edge Function:**
```typescript
import { PrivyClient } from '@privy-io/server-node';

const privy = new PrivyClient({
  appId: deno.env.get('PRIVY_APP_ID'),
  appSecret: deno.env.get('PRIVY_APP_SECRET'),
});

// In sendSwapTransaction():
const txHash = await privy.sendTransaction({
  walletAddress: walletAddress,
  chainId: 5042002, // Arc testnet
  transaction: {
    to: txData.to,
    from: txData.from,
    data: txData.data,
    value: txData.value,
    gasLimit: txData.gasLimit,
  },
});
```

### Alternative: AWS KMS Signing

Store private keys in AWS KMS or Supabase Vault and sign transactions server-side using ethers.js.

⚠️ **Security Consideration**: Private key management requires secure infrastructure. Use KMS, HashiCorp Vault, or similar.



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
