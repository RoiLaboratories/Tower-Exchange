import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";
import {
  aiBackendUnconfiguredResponse,
  getTowerAiAuthHeaders,
  getTowerAiBaseUrl,
  rejectNonFrontendAiRequest,
} from "@/lib/server/towerAiBackend";

export async function GET(request: NextRequest) {
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

    const backendUrl = getTowerAiBaseUrl();
    if (!backendUrl) {
      return aiBackendUnconfiguredResponse();
    }

    const sessionId = request.headers.get("X-Session-ID");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 },
      );
    }

    const response = await fetch(`${backendUrl}/api/chat/history`, {
      method: "GET",
      headers: {
        ...getTowerAiAuthHeaders(),
        "X-Session-ID": sessionId,
        "X-Wallet-Address": wallet,
      },
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
