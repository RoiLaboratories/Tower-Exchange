# Recurring Orders Automatic Execution - Implementation Guide

## Overview

This guide explains how the automatic recurring orders execution system works and what needs to be completed for production.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      pg_cron Scheduler                      │
│            (Runs Edge Function every hour)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          execute-recurring-orders Edge Function             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Query recurring_orders for due orders            │   │
│  │ 2. For each order:                                  │   │
│  │    a) Get swap quote from QuantumExchange API       │   │
│  │    b) Sign transaction with wallet credentials      │   │
│  │    c) Send transaction to Arc blockchain            │   │
│  │    d) Log execution result                          │   │
│  │    e) Update next_execution_date                    │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌───────────────┐
    │   Database   │  │ Blockchain   │  │    Logs       │
    │   Updates    │  │ Transactions │  │   Storage     │
    └──────────────┘  └──────────────┘  └───────────────┘
```

## Current Status

### ✅ Implemented
- Edge Function skeleton with order fetching logic
- Database schema with execution tracking
- pg_cron scheduling setup
- Quote fetching from QuantumExchange API
- Execution logging and result tracking
- Next execution date calculation

### ❌ Not Yet Implemented (CRITICAL FOR PRODUCTION)
- **Wallet Transaction Signing**: Private key management and transaction signing
- **Transaction Broadcasting**: Sending signed transactions to Arc blockchain
- **Transaction Confirmation**: Waiting for blockchain confirmation
- **Error Recovery**: Retry logic for failed transactions

## Step-by-Step Implementation

### Phase 1: Basic Transaction Signing (Week 1)

#### Option A: Using Ethers.js (Recommended)

```typescript
import { ethers } from 'https://esm.sh/ethers@6.7.1';

async function signAndSendTransaction(
  walletAddress: string,
  transactionData: any,
  privateKey: string
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // Create provider and signer
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
    const signer = new ethers.Wallet(privateKey, provider);

    // Verify signer matches wallet
    if (signer.address.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Private key does not match wallet address');
    }

    // Prepare transaction
    const tx = {
      to: transactionData.to,
      data: transactionData.data,
      value: transactionData.value || '0',
      chainId: 5042002,
    };

    // Estimate gas
    const gasEstimate = await provider.estimateGas(tx);
    tx.gasLimit = gasEstimate;

    // Get gas price
    const gasPrice = await provider.getGasPrice();
    tx.gasPrice = gasPrice;

    // Sign transaction
    const signedTx = await signer.signTransaction(tx);

    // Send transaction
    const response = await provider.broadcastTransaction(signedTx);
    const receipt = await response.wait();

    return {
      success: true,
      transactionHash: receipt?.hash || response.hash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

#### Option B: Using Privy Wallet (If Available)

```typescript
// If using Privy's embedded wallet
async function signWithPrivy(
  walletAddress: string,
  message: string
): Promise<string | null> {
  // This would require Privy to have server-side signing capabilities
  // Currently, Privy is client-side only
  // Consider using Privy's API or another wallet service
}
```

### Phase 2: Secure Key Management (Week 1-2)

#### Option A: AWS KMS (Recommended for Production)

```typescript
import { KMSClient, SignCommand } from 'https://esm.sh/@aws-sdk/client-kms@3.400.0';

const kmsClient = new KMSClient({
  region: Deno.env.get('AWS_REGION') || 'us-east-1',
});

async function signWithKMS(
  keyId: string,
  message: string
): Promise<string | null> {
  try {
    const command = new SignCommand({
      KeyId: keyId,
      Message: new TextEncoder().encode(message),
      SigningAlgorithm: 'ECDSA_SHA_256',
    });

    const response = await kmsClient.send(command);
    return Buffer.from(response.Signature || []).toString('hex');
  } catch (error) {
    console.error('KMS signing error:', error);
    return null;
  }
}
```

#### Option B: Supabase Vault (Easier Setup)

```sql
-- Store encrypted private keys in Supabase Vault
INSERT INTO vault.secrets (name, secret, description)
VALUES (
  'wallet_private_key_0x123',
  'your-encrypted-private-key',
  'Private key for wallet 0x123'
);

-- Retrieve in Edge Function
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'wallet_private_key_' || wallet_address;
```

### Phase 3: Transaction Confirmation & Retry Logic (Week 2)

```typescript
async function executeWithRetry(
  executeFunction: () => Promise<any>,
  maxRetries: number = 3,
  delayMs: number = 5000
): Promise<any> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      const result = await Promise.race([
        executeFunction(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 30000)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        console.log(`Retrying after ${backoffDelay}ms...`);
        await new Promise((r) => setTimeout(r, backoffDelay));
      }
    }
  }

  throw lastError;
}

// In executeOrder():
const txResult = await executeWithRetry(
  () => signAndSendTransaction(order.wallet_address, quoteData, privateKey),
  3,
  5000
);
```

## Environment Setup

### 1. Get Required Credentials

```bash
# Supabase credentials
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AWS credentials (if using KMS)
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Wallet private keys (encrypted)
export WALLET_PRIVATE_KEY="encrypted-or-kms-reference"
```

### 2. Deploy Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy execute-recurring-orders --no-verify-jwt

# Check deployment
supabase functions list
```

### 3. Set Environment Variables in Supabase

Go to Supabase Dashboard → Functions → execute-recurring-orders → Environment Variables

```
SUPABASE_URL = your-url
SUPABASE_SERVICE_ROLE_KEY = your-key
```

## Testing Checklist

- [ ] Retrieve and log active orders without errors
- [ ] Get swap quotes from QuantumExchange API
- [ ] Sign transactions with private key
- [ ] Send transaction to Arc RPC
- [ ] Wait for transaction confirmation
- [ ] Log execution results to database
- [ ] Update next_execution_date correctly
- [ ] Handle errors gracefully
- [ ] Retry failed orders
- [ ] Process multiple orders in batch
- [ ] Verify execution history tracking

## Monitoring & Alerts

### Query Recent Executions

```sql
SELECT 
  ro.id,
  ro.wallet_address,
  ro.source_token || '→' || ro.target_token as pair,
  roe.status,
  roe.execution_date,
  roe.transaction_hash,
  roe.error_message
FROM recurring_order_executions roe
JOIN recurring_orders ro ON roe.recurring_order_id = ro.id
WHERE roe.execution_date > now() - interval '24 hours'
ORDER BY roe.execution_date DESC;
```

### View Failed Orders

```sql
SELECT 
  ro.id,
  ro.wallet_address,
  COUNT(*) as failure_count,
  MAX(roe.execution_date) as last_failure,
  roe.error_message
FROM recurring_order_executions roe
JOIN recurring_orders ro ON roe.recurring_order_id = ro.id
WHERE roe.status = 'Failed'
GROUP BY ro.id, ro.wallet_address, roe.error_message
HAVING COUNT(*) >= 3;
```

## Security Checklist

- [ ] Private keys stored securely (KMS/Vault, never hardcoded)
- [ ] Environment variables in Supabase secrets
- [ ] Edge Function has authorization header validation
- [ ] RLS policies prevent unauthorized access
- [ ] Audit logs track all executions
- [ ] Rate limiting on API calls
- [ ] Input validation on all parameters
- [ ] Error messages don't leak sensitive info

## Known Limitations & Mitigations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| No wallet private key management | Cannot sign transactions | Implement KMS or Vault integration |
| Missing transaction confirmation | May double-execute | Add transaction receipt checking |
| No slippage protection | Could execute at bad prices | Implement price impact limits |
| Single wallet per function | Limited scalability | Support multiple wallets with key rotation |
| No gas optimization | Higher execution costs | Implement dynamic gas price calculation |

## Next Steps

1. **Implement wallet signing** using Ethers.js and your secure key management
2. **Add transaction confirmation** waiting and error handling
3. **Set up monitoring** and alerts for failed orders
4. **Test with real transactions** on Arc testnet
5. **Monitor gas costs** and optimize if needed
6. **Scale to production** with proper security measures

## Support Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Arc Network RPC](https://docs.arc.network/)
- [QuantumExchange API Docs](https://www.quantumexchange.app/docs)

## Questions?

Review the Edge Function code in `index.ts` for inline documentation and implementation details.
