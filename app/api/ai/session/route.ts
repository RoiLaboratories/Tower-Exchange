import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.AI_AGENT_API_KEY || "";

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

    const rawBody = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const body = {
      ...rawBody,
      wallet_address: wallet,
      walletAddress: wallet,
      userid: wallet,
      userId: wallet,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/chat/session`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating AI session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}
