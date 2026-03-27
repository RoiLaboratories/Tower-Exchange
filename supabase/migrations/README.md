# Supabase Migrations

This directory contains database migrations for Tower Exchange.

## How to Apply Migrations

### Option 1: Using Supabase CLI (Recommended)
```bash
# Apply all pending migrations to your local development database
supabase db push

# Or apply migrations to a remote database
supabase db push --linked
```

### Option 2: Manual Execution
Copy and paste the migration SQL into the Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the migration SQL content
4. Run the query

## Migration History

- **20260327_add_amount_usd_to_activities.sql** - Adds `amount_usd` column to activities table for tracking USD value of transactions

## Notes

- All migrations use `IF NOT EXISTS` clauses to be idempotent (safe to run multiple times)
- Migrations preserve existing data - they only add new columns
- Each migration file is timestamped for version control
