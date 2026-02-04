# Supabase Setup for Tower Exchange Activities

This guide will help you set up Supabase to store and fetch user activity data.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Setup Steps

### 1. Create the Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `schema.sql` in this folder
4. Paste and run the SQL in the SQL Editor
5. This will create:
   - The `activities` table
   - Indexes for performance
   - Row Level Security (RLS) policies
   - Automatic timestamp triggers

### 2. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

### 3. Add Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Install Supabase Client

Run this command in your project root:

```bash
npm install @supabase/supabase-js
```

### 5. Restart Your Dev Server

After adding the environment variables, restart your Next.js dev server:

```bash
npm run dev
```

## Testing

### Insert Test Data

You can insert test data using the SQL Editor in Supabase:

```sql
INSERT INTO activities (
  wallet_address,
  type,
  source_currency_ticker,
  source_network_name,
  destination_currency_ticker,
  destination_network_name,
  status,
  amount,
  transaction_hash
) VALUES (
  '0x1234567890123456789012345678901234567890', -- Replace with your wallet address
  'Swap',
  'USDC',
  'Arc',
  'ETH',
  'Arc',
  'Successful',
  100.50,
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
);
```

## Schema Overview

The `activities` table stores:

- **wallet_address**: User's wallet address (from Privy)
- **type**: Activity type (Swap, Deposit, Withdraw, Transfer)
- **source_currency_ticker**: Source token (USDC, ETH, etc.)
- **source_network_name**: Source network (Arc, Ethereum, etc.)
- **destination_currency_ticker**: Destination token (nullable)
- **destination_network_name**: Destination network (nullable)
- **status**: Transaction status (Successful, Failed, Pending)
- **timestamp**: When the activity occurred
- **amount**: Transaction amount
- **transaction_hash**: Blockchain transaction hash
- **fee**: Transaction fee
- **fee_currency_ticker**: Fee currency

## Security Notes

- The current RLS policies allow all reads/writes. For production, you should:
  - Integrate Supabase Auth with Privy
  - Update RLS policies to restrict access by authenticated user ID
  - Consider using service role key for server-side operations

## Troubleshooting

- **"Failed to load activities"**: Check that your Supabase URL and anon key are correct in `.env.local`
- **"Table not found"**: Make sure you've run the `schema.sql` file in the SQL Editor
- **No data showing**: Verify your wallet address matches the `wallet_address` in the database (case-insensitive)
