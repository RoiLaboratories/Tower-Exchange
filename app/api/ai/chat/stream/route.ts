/**
 * Next.js API Route - Streaming Proxy to Tower-Exchange-AI Backend
 * Handles streaming responses from the backend
 */

import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";
import { normalizeWalletAddress } from "@/lib/server/wallet";
import {
  aiBackendUnconfiguredResponse,
  getTowerAiAuthHeaders,
  getTowerAiStreamUrl,
  rejectNonFrontendAiRequest,
} from "@/lib/server/towerAiBackend";

const EVM_ADDRESS_IN_TEXT_PATTERN = /0x[a-fA-F0-9]{40}/g;

const readWalletProofFields = (payload: Record<string, unknown>) => {
  const signature =
    typeof payload.wallet_signature === "string"
      ? payload.wallet_signature.trim()
      : "";
  const timestamp =
    typeof payload.wallet_signature_timestamp === "string"
      ? payload.wallet_signature_timestamp.trim()
      : "";

  if (!signature.startsWith("0x") || !timestamp) {
    return {};
  }

  return {
    wallet_signature: signature,
    wallet_signature_timestamp: timestamp,
  };
};

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

    const streamUrl = getTowerAiStreamUrl();
    if (!streamUrl) {
      return aiBackendUnconfiguredResponse();
    }

    const rawBody = (await request.json()) as Record<string, unknown>;
    const rawMessage =
      typeof rawBody.message === "string" ? rawBody.message : undefined;
    const sanitizedMessage = rawMessage
      ? rawMessage.replace(EVM_ADDRESS_IN_TEXT_PATTERN, (match) => {
          const normalized = normalizeWalletAddress(match);
          return normalized && normalized === wallet ? match : wallet;
        })
      : rawMessage;

    const body = {
      ...rawBody,
      message: sanitizedMessage,
      wallet_address: wallet,
      walletAddress: wallet,
      userid: wallet,
      userId: wallet,
      ...readWalletProofFields(rawBody),
    };

    const response = await fetch(streamUrl, {
      method: "POST",
      headers: getTowerAiAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "AI stream failed",
      }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "Backend did not return a readable stream" },
        { status: 500 },
      );
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Streaming API Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
