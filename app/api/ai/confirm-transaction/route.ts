import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_TOWER_AI_API ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.TOWER_AI_API_KEY || "";

interface ConfirmationRequest {
  wallet_address: string;
  session_id: string;
  transaction_hash: string;
  block_number: number;
  status: "success" | "failed";
  gas_used: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmationRequest = await request.json();
    const { wallet_address, session_id, transaction_hash, block_number, status, gas_used } = body;

    // Validation
    if (!wallet_address || !session_id || !transaction_hash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Received transaction confirmation:", {
      wallet_address,
      session_id,
      transaction_hash,
      status,
    });

    // Store confirmation in Supabase
    const { error: dbError } = await supabase
      .from("transaction_confirmations")
      .insert({
        wallet_address,
        session_id,
        transaction_hash,
        block_number,
        status,
        gas_used,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Error storing confirmation in Supabase:", dbError);
      // Don't fail the request - the confirmation was successful on-chain
    }

    // Create success message
    const successMessage = `The swap transaction has been confirmed on the blockchain! 
Transaction Hash: ${transaction_hash}
Block Number: ${block_number}
Gas Used: ${gas_used}

The swap has completed successfully. Your tokens are now in your wallet.`;

    // Send confirmation back to AI agent
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_KEY) {
      headers["endpoint_auth"] = API_KEY;
    }

    const chatUrl = `${BACKEND_URL}/api/v1/chat`;

    const aiResponse = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: `[System: Transaction confirmed - ${transaction_hash}] The user's swap transaction has been successfully confirmed on the blockchain.`,
        userid: wallet_address,
        session_id: session_id,
        wallet_address: wallet_address,
        chain_id: 5042002,
        enable_wallet_access: false,
        enable_swap_execution: false,
        enable_portfolio_analysis: false,
      }),
    });

    if (!aiResponse.ok) {
      console.error("Error notifying AI agent of confirmation");
      // Still return success - confirmation was successful on-chain
    }

    // Log confirmation to history
    const { error: historyError } = await supabase
      .from("ai_db")
      .insert({
        user_id: wallet_address,
        session_id: session_id,
        user_query: `[Transaction Confirmed]`,
        ai_response: successMessage,
      });

    if (historyError) {
      console.warn("Error logging confirmation to history:", historyError);
    }

    return NextResponse.json({
      success: true,
      message: "Transaction confirmation recorded",
      transaction_hash,
      block_number,
    });
  } catch (error) {
    console.error("Error processing transaction confirmation:", error);
    return NextResponse.json(
      { error: "Failed to process transaction confirmation" },
      { status: 500 }
    );
  }
}
