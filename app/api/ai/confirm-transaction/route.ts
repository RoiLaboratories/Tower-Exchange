import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/devApiSupabase";
import { requireWalletSession } from "@/lib/server/walletSession";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_TOWER_AI_API ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.TOWER_AI_API_KEY || "";

interface ConfirmationRequest {
  session_id: string;
  transaction_hash: string;
  block_number: number;
  status: "success" | "failed";
  gas_used: string;
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, response: sessionError } = requireWalletSession(request);
    if (sessionError || !wallet) {
      return (
        sessionError ??
        NextResponse.json(
          { error: "Wallet session required. Please sign in." },
          { status: 401 },
        )
      );
    }

    const body = (await request.json()) as ConfirmationRequest;
    const { session_id, transaction_hash, block_number, status, gas_used } =
      body;

    if (!session_id || !transaction_hash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log("Received transaction confirmation:", {
      wallet_address: wallet,
      session_id,
      transaction_hash,
      status,
    });

    const { error: dbError } = await supabaseAdmin
      .from("transaction_confirmations")
      .insert({
        wallet_address: wallet,
        session_id,
        transaction_hash,
        block_number,
        status,
        gas_used,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Error storing confirmation in Supabase:", dbError);
    }

    const successMessage = `The swap transaction has been confirmed on the blockchain! 
Transaction Hash: ${transaction_hash}
Block Number: ${block_number}
Gas Used: ${gas_used}

The swap has completed successfully. Your tokens are now in your wallet.`;

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
        userid: wallet,
        session_id,
        wallet_address: wallet,
        chain_id: 5042002,
        enable_wallet_access: false,
        enable_swap_execution: false,
        enable_portfolio_analysis: false,
      }),
    });

    if (!aiResponse.ok) {
      console.error("Error notifying AI agent of confirmation");
    }

    const { error: historyError } = await supabaseAdmin.from("ai_db").insert({
      user_id: wallet,
      session_id,
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
      { status: 500 },
    );
  }
}
