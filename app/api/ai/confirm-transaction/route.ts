import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/devApiSupabase";
import { requireWalletSession } from "@/lib/server/walletSession";
import {
  getTowerAiAuthHeaders,
  getTowerAiChatUrl,
  rejectNonFrontendAiRequest,
} from "@/lib/server/towerAiBackend";

interface ConfirmationRequest {
  session_id: string;
  transaction_hash: string;
  block_number: number;
  status: "success" | "failed";
  gas_used: string;
}

export async function POST(request: NextRequest) {
  try {
    const frontendGate = rejectNonFrontendAiRequest(request);
    if (frontendGate) {
      return frontendGate;
    }

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

    const chatUrl = getTowerAiChatUrl();
    if (chatUrl) {
      const aiResponse = await fetch(chatUrl, {
        method: "POST",
        headers: getTowerAiAuthHeaders(),
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
