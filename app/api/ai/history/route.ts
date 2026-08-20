import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.AI_AGENT_API_KEY || "";

export async function GET(request: NextRequest) {
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

    const sessionId = request.headers.get("X-Session-ID");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
      "X-Wallet-Address": wallet,
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/history`, {
      method: "GET",
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
