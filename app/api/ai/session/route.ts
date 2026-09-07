import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";
import {
  aiBackendUnconfiguredResponse,
  getTowerAiAuthHeaders,
  getTowerAiBaseUrl,
  rejectNonFrontendAiRequest,
} from "@/lib/server/towerAiBackend";

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

    const backendUrl = getTowerAiBaseUrl();
    if (!backendUrl) {
      return aiBackendUnconfiguredResponse();
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

    const response = await fetch(`${backendUrl}/api/chat/session`, {
      method: "POST",
      headers: getTowerAiAuthHeaders(),
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
