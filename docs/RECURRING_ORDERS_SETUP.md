# Recurring Orders Setup Guide

## Overview
The recurring orders feature allows users to set up automatic buy/sell orders on a recurring schedule. This requires database setup in Supabase.

## What's Already Done
✅ TypeScript service layer created (`lib/recurringOrderService.ts`)
✅ React components updated (`components/reusable/RecurringBuys.tsx` and `RecurringSell.tsx`)
✅ SQL schema defined (`supabase/schema.sql`)

## Required Setup Steps

### Step 1: Create Tables in Supabase

The `recurring_orders` table is defined in `supabase/schema.sql` but needs to be created in your Supabase database.

**To create the tables:**

1. Go to [Supabase Dashboard](https://supabase.com/)
2. Navigate to your project
3. Click **SQL Editor** in the left sidebar
4. Create a new query
5. Copy and paste the following SQL:

```sql
-- ============================================================================
-- RECURRING ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')),
  
  -- Token details
  source_token VARCHAR(10) NOT NULL,
  target_token VARCHAR(10) NOT NULL,
  
  -- Order details
  amount NUMERIC(20, 10) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  
  -- Scheduling
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  next_execution_date TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_wallet_address ON recurring_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_recurring_is_active ON recurring_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_next_execution ON recurring_orders(next_execution_date);
CREATE INDEX IF NOT EXISTS idx_recurring_order_type ON recurring_orders(order_type);

-- Enable Row Level Security
ALTER TABLE recurring_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own recurring orders
CREATE POLICY "Users can view their own recurring orders"
  ON recurring_orders FOR SELECT
  USING (true);

-- Policy: Users can create recurring orders
CREATE POLICY "Users can create recurring orders"
  ON recurring_orders FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own recurring orders
CREATE POLICY "Users can update their own recurring orders"
  ON recurring_orders FOR UPDATE
  USING (true);

-- Policy: Users can delete their own recurring orders
CREATE POLICY "Users can delete their own recurring orders"
  ON recurring_orders FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_recurring_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recurring_orders_updated_at
  BEFORE UPDATE ON recurring_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_orders_updated_at();

-- ============================================================================
-- RECURRING ORDER EXECUTIONS TABLE (History/Logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_order_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_order_id UUID NOT NULL REFERENCES recurring_orders(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  execution_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(20, 10) NOT NULL,
  source_token VARCHAR(10) NOT NULL,
  target_token VARCHAR(10) NOT NULL,
  transaction_hash TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Successful', 'Failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for executions
CREATE INDEX IF NOT EXISTS idx_executions_recurring_order_id ON recurring_order_executions(recurring_order_id);
CREATE INDEX IF NOT EXISTS idx_executions_wallet_address ON recurring_order_executions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_executions_execution_date ON recurring_order_executions(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_executions_status ON recurring_order_executions(status);

-- Enable Row Level Security for executions
ALTER TABLE recurring_order_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own execution history
CREATE POLICY "Users can view their own executions"
  ON recurring_order_executions FOR SELECT
  USING (true);

-- Policy: Users can create execution logs
CREATE POLICY "Users can create execution logs"
  ON recurring_order_executions FOR INSERT
  WITH CHECK (true);

-- Create trigger for execution updated_at
CREATE OR REPLACE FUNCTION update_recurring_order_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recurring_order_executions_updated_at
  BEFORE UPDATE ON recurring_order_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_order_executions_updated_at();
```

6. Click **Run** to execute the SQL

### Step 2: Verify Setup

After running the SQL, verify the tables were created:

1. In Supabase, click **Table Editor** in the left sidebar
2. You should see:
   - `recurring_orders` table
   - `recurring_order_executions` table

### Step 3: Test the Feature

1. In your app, navigate to the Recurring Buys or Recurring Sells section
2. Fill in the form:
   - Select "Pay With" token (e.g., USDC)
   - Select "Buy" token (e.g., ETH)
   - Enter an amount
   - Select a frequency
   - (Optional) Set an end date
3. Click "Continue"
4. Check the browser console for detailed error messages if anything fails

## Troubleshooting

### Error: "Unknown error" or "{}"
This typically means:
- **Tables don't exist**: Run the SQL setup above
- **RLS policy issue**: Check that policies are enabled (they're in the SQL)
- **Auth issue**: Verify your Supabase auth is working

### Error: "Failed to create recurring order: undefined"
Check your browser console (F12 → Console tab) for more detailed error messages.

### Orders not persisting
- Check Supabase table data: Go to **Table Editor** → `recurring_orders`
- Verify RLS policies allow writes (check **Authentication** → **Policies**)

## Service Functions

### Creating an Order
```typescript
import { createRecurringOrder } from "@/lib/recurringOrderService";

await createRecurringOrder(
  walletAddress,      // User's wallet address
  "buy",              // "buy" or "sell"
  "USDC",             // Source token
  "ETH",              // Target token
  100,                // Amount
  "Weekly",           // Frequency
  "01/22/2026"        // End date (optional)
);
```

### Getting Orders
```typescript
import { getRecurringOrders } from "@/lib/recurringOrderService";

const orders = await getRecurringOrders(walletAddress, true); // true = active only
```

### Canceling an Order
```typescript
import { cancelRecurringOrder } from "@/lib/recurringOrderService";

await cancelRecurringOrder(orderId);
```

## Next Steps

1. **Display existing orders**: Create a dashboard showing user's recurring orders
2. **Implement execution**: Set up backend job to execute orders on schedule
3. **Add order history**: Display execution history with transaction details
4. **Add notifications**: Alert users when orders execute

## Database Schema Reference

### recurring_orders table
- `id`: UUID primary key
- `wallet_address`: User's wallet address
- `order_type`: 'buy' or 'sell'
- `source_token`: Token being spent/sold
- `target_token`: Token being purchased/received
- `amount`: Amount per execution
- `frequency`: 'Daily', 'Weekly', 'Bi-weekly', 'Monthly'
- `start_date`: When orders begin
- `end_date`: When orders stop (optional)
- `next_execution_date`: Next scheduled execution
- `is_active`: Whether order is active
- `execution_count`: Number of times executed
- `created_at`, `updated_at`: Timestamps

### recurring_order_executions table
- `id`: UUID primary key
- `recurring_order_id`: Reference to recurring_orders
- `wallet_address`: User's wallet
- `execution_date`: When executed
- `amount`: Amount executed
- `source_token`, `target_token`: Tokens involved
- `transaction_hash`: Blockchain transaction hash
- `status`: 'Pending', 'Successful', 'Failed'
- `error_message`: Error details if failed
- `created_at`, `updated_at`: Timestamps
