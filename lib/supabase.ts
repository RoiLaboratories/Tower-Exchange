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

/**
 * Token decimals mapping for Arc testnet
 * Used to convert wei amounts to human-readable token amounts
 */
const TOKEN_DECIMALS_MAP: Record<string, number> = {
  // Normalize addresses to lowercase
  '0x3600000000000000000000000000000000000000': 6, // USDC
  '0xd40fcaa5d2ce963c5dabc2bf59e268489ad7bce4': 6, // WUSDC (QuantumExchange)
  '0x911b4000d3422f482f4062a913885f7b035382df': 18, // WUSDC (Synthra)
  '0xcd304d2a421bfed31d45f0054af8e8a6a4cf3eae': 18, // QTM
  '0x89b50855aa3be2f677cd6303cec089b5f319d72a': 6, // EURC
  '0x175cdb1d338945f0d851a741ccf787d343e57952': 18, // USDT
  '0xf0c4a4ce82a5746abaad9425360ab04fbba432bf': 8, // cirBTC
  '0xc5124c846c6e6307986988dfb7e743327aa05f19': 18, // SYN
  '0xbe7477bf91526fc9988c8f33e91b6db687119d45': 6, // SWPRC
  '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c': 6, // USYC
};

/**
 * Get token decimals by address
 */
function getTokenDecimals(tokenAddress: string): number {
  const normalized = tokenAddress.toLowerCase();
  return TOKEN_DECIMALS_MAP[normalized] || 18; // Default to 18 if not found
}

/**
 * Convert wei amount to token amount based on decimals
 * @param amount - Amount in wei (as string or number)
 * @param decimals - Token decimals
 * @returns Amount in human-readable format (as number)
 */
export function formatTokenAmount(amount: string | number, decimals: number = 18): number {
  try {
    // Handle BigInt or regular number string
    let amountBigInt: bigint;
    
    if (typeof amount === 'string') {
      amountBigInt = BigInt(amount);
    } else {
      amountBigInt = BigInt(Math.floor(amount));
    }
    
    // Divide by 10^decimals
    const divisor = BigInt(10) ** BigInt(decimals);
    const result = Number(amountBigInt) / Number(divisor);
    
    return result;
  } catch (error) {
    console.error(`Error formatting token amount ${amount} with decimals ${decimals}:`, error);
    // Fallback: treat as already formatted
    return typeof amount === 'string' ? parseFloat(amount) : amount;
  }
}

/**
 * Convert wei amount to token amount using token address
 * @param amount - Amount in wei (as string or number)
 * @param tokenAddress - Token contract address
 * @returns Amount in human-readable format (as number)
 */
export function formatTokenAmountByAddress(amount: string | number, tokenAddress: string): number {
  const decimals = getTokenDecimals(tokenAddress);
  return formatTokenAmount(amount, decimals);
}

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
 * Automatically converts wei amounts to human-readable token amounts based on token decimals
 */
export async function registerSwapFee(
  params: SwapFeeParams
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    // Convert wei amounts to token amounts using token decimals
    const tokenDecimals = getTokenDecimals(params.tokenAddress);
    const formattedFeeAmount = formatTokenAmount(params.feeAmount, tokenDecimals);
    const formattedTotalAmount = formatTokenAmount(params.totalAmount, tokenDecimals);

    console.log(`[Supabase] Converting fee amounts for ${params.tokenSymbol} (${tokenDecimals} decimals):`, {
      feeAmountWei: params.feeAmount,
      feeAmountFormatted: formattedFeeAmount,
      totalAmountWei: params.totalAmount,
      totalAmountFormatted: formattedTotalAmount,
    });

    const { data, error } = await supabase.from("swap_fees").insert([
      {
        wallet_address: params.walletAddress.toLowerCase(),
        token_address: params.tokenAddress.toLowerCase(),
        token_symbol: params.tokenSymbol,
        fee_amount: formattedFeeAmount,
        fee_amount_usd: params.feeAmountUsd ? parseFloat(params.feeAmountUsd) : null,
        fee_basis_points: params.feeBasisPoints,
        total_amount: formattedTotalAmount,
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
    console.log("Swap fee registered successfully:", {
      id: feeId,
      token: params.tokenSymbol,
      feeAmount: formattedFeeAmount,
      feeAmountUsd: params.feeAmountUsd,
      totalAmount: formattedTotalAmount,
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
 * Format a swap fee row for display
 * Ensures fee amounts are properly formatted with appropriate decimal places
 */
export function formatSwapFeeForDisplay(
  fee: SwapFeeRow
): SwapFeeRow & { fee_amount_display: string; total_amount_display: string } {
  const decimals = getTokenDecimals(fee.token_address);
  
  return {
    ...fee,
    fee_amount_display: fee.fee_amount.toFixed(Math.min(decimals, 8)),
    total_amount_display: fee.total_amount.toFixed(Math.min(decimals, 8)),
  };
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
