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

// Interface for swap fee recording
export interface SwapFeeParams {
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  feeAmount: string;
  feeAmountUsd?: string;
  feeBasisPoints: number;
  totalAmount: string;
  transactionHash?: string;
  blockNumber?: number;
  status?: "Pending" | "Recorded" | "Confirmed" | "Failed";
  errorMessage?: string;
  activityId?: string;
}

// Swap fee row type from database
export interface SwapFeeRow {
  id: string;
  wallet_address: string;
  swap_activity_id: string | null;
  token_address: string;
  token_symbol: string;
  fee_amount: number;
  fee_amount_usd: number | null;
  fee_basis_points: number;
  total_amount: number;
  transaction_hash: string | null;
  block_number: number | null;
  status: "Pending" | "Recorded" | "Confirmed" | "Failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
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

/**
 * Register a swap fee in the swap_fees table
 * Records platform fees collected from swap transactions for tracking and analytics
 */
export async function registerSwapFee(
  params: SwapFeeParams
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { data, error } = await supabase.from("swap_fees").insert([
      {
        wallet_address: params.walletAddress.toLowerCase(),
        token_address: params.tokenAddress.toLowerCase(),
        token_symbol: params.tokenSymbol,
        fee_amount: parseFloat(params.feeAmount),
        fee_amount_usd: params.feeAmountUsd ? parseFloat(params.feeAmountUsd) : null,
        fee_basis_points: params.feeBasisPoints,
        total_amount: parseFloat(params.totalAmount),
        transaction_hash: params.transactionHash || null,
        block_number: params.blockNumber || null,
        swap_activity_id: params.activityId || null,
        status: params.status || "Recorded",
        error_message: params.errorMessage || null,
      },
    ]).select();

    if (error) {
      console.error("Error registering swap fee:", error);
      return { success: false, error: error.message };
    }

    const feeId = data?.[0]?.id;
    console.log("Swap fee registered:", {
      id: feeId,
      token: params.tokenSymbol,
      feeAmount: params.feeAmount,
      feeAmountUsd: params.feeAmountUsd,
      transactionHash: params.transactionHash,
    });
    return { success: true, id: feeId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error registering swap fee:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get swap fees for a specific wallet
 */
export async function getSwapFeesByWallet(
  walletAddress: string,
  limit: number = 50
): Promise<{ success: boolean; fees?: SwapFeeRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("swap_fees")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching swap fees:", error);
      return { success: false, error: error.message };
    }

    return { success: true, fees: data || [] };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching swap fees:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update swap fee status and block number after fee collection transaction is confirmed
 */
export async function updateSwapFeeConfirmation(
  feeId: string,
  transactionHash: string,
  blockNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("swap_fees")
      .update({
        transaction_hash: transactionHash,
        block_number: blockNumber,
        status: "Confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId);

    if (error) {
      console.error("Error updating swap fee confirmation:", error);
      return { success: false, error: error.message };
    }

    console.log("Swap fee confirmation updated:", { feeId, transactionHash, blockNumber });
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating swap fee confirmation:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
