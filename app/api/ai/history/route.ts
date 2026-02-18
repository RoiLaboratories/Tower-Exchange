import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "https://tower-exchange-ai-production.up.railway.app";
const API_KEY = process.env.AI_AGENT_API_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get("X-Session-ID");
    const walletAddress = request.headers.get("X-Wallet-Address");

    if (!sessionId || !walletAddress) {
      return NextResponse.json(
        { error: "Missing sessionId or walletAddress" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
      "X-Wallet-Address": walletAddress,
    };

    // Add API key if available
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
      { status: 500 }
    );
  }
}
