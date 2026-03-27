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
  amount_usd: number | null;
  transaction_hash: string | null;
  fee: number | null;
  fee_currency_ticker: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for registering bridge transactions
export interface BridgeActivityParams {
  walletAddress: string;
  fromChain: string;
  toChain: string;
  amount: string;
  token: string;
  transactionHash?: string;
  fee?: string;
  status?: "Successful" | "Failed" | "Pending";
}

/**
 * Register a bridge transaction in the activities table
 */
export async function registerBridgeActivity(
  params: BridgeActivityParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.from("activities").insert([
      {
        wallet_address: params.walletAddress.toLowerCase(),
        type: "Bridge",
        source_currency_ticker: params.token,
        source_network_name: params.fromChain,
        destination_currency_ticker: params.token,
        destination_network_name: params.toChain,
        amount: parseFloat(params.amount),
        amount_usd: parseFloat(params.amount), // USDC is 1:1 with USD
        transaction_hash: params.transactionHash || null,
        fee: params.fee ? parseFloat(params.fee) : null,
        fee_currency_ticker: params.fee ? params.token : null,
        status: params.status || "Successful",
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Error registering bridge activity:", error);
      return { success: false, error: error.message };
    }

    console.log("Bridge activity registered:", data);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error registering bridge activity:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
