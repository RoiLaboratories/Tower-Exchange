/**
 * Next.js API Route - Streaming Proxy to Tower-Exchange-AI Backend
 * Handles streaming responses from the backend
 */

import { NextRequest, NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/server/walletSession";
import { normalizeWalletAddress } from "@/lib/server/wallet";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_TOWER_AI_API ||
  "https://tower-exchange-ai-production-5811.up.railway.app";
const API_KEY = process.env.TOWER_AI_API_KEY || "";
const EVM_ADDRESS_IN_TEXT_PATTERN = /0x[a-fA-F0-9]{40}/g;

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
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const streamUrl = `${BACKEND_URL}/api/v1/chat/stream`;

    console.log("Sending streaming request to:", streamUrl);

    const response = await fetch(streamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Backend streaming error:", errorData);
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
