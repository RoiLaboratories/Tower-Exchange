import { createClient } from "@supabase/supabase-js";

// Supabase configuration
// Add these to your .env.local file:
// NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase environment variables are not set. Activities will not be fetched from Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Activity type definitions matching the database schema
export interface ActivityRow {
  id: string;
  wallet_address: string;
  type: string;
  source_currency_ticker: string;
  source_network_name: string;
  destination_currency_ticker: string | null;
  destination_network_name: string | null;
  status: "Successful" | "Failed" | "Pending";
  timestamp: string;
  amount: number | null;
  transaction_hash: string | null;
  fee: number | null;
  fee_currency_ticker: string | null;
  created_at: string;
  updated_at: string;
}
