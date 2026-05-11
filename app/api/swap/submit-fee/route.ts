/**
 * Next.js API Route: POST /api/swap/submit-fee
 * 
 * Proxies fee submission requests to Tower-Backend
 * After swap completes on-chain, frontend calls this route to trigger fee collection
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSwapBackendUrl } from "@/lib/resolveSwapBackendUrl";

const BACKEND_URL = resolveSwapBackendUrl();

export async function POST(request: NextRequest) {
  try {
    console.log("[FeeSubmit API] Received fee submission request");

    // Parse request body
    const body = await request.json();
    console.log("[FeeSubmit API] Request body:", {
      outputToken: body.outputToken?.substring(0, 6) + "...",
      totalAmount: body.totalAmount,
      userAddress: body.userAddress?.substring(0, 6) + "...",
      feeBps: body.feeBps,
    });

    // Validate required fields
    if (!body.outputToken || !body.totalAmount || !body.userAddress || body.feeBps === undefined) {
      console.error("[FeeSubmit API] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: outputToken, totalAmount, userAddress, feeBps" },
        { status: 400 }
      );
    }

    // Forward to Tower-Backend
    const backendUrl = `${BACKEND_URL}/api/swap/submit-fee`;
    console.log("[FeeSubmit API] Forwarding to Tower-Backend:", backendUrl);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        outputToken: body.outputToken,
        totalAmount: body.totalAmount,
        userAddress: body.userAddress,
        feeBps: body.feeBps,
      }),
    });

    const responseData = await response.json();
    console.log("[FeeSubmit API] Tower-Backend response status:", response.status);
    console.log("[FeeSubmit API] Tower-Backend response:", responseData);

    if (!response.ok) {
      console.error("[FeeSubmit API] Tower-Backend returned error:", responseData);
      return NextResponse.json(responseData, { status: response.status });
    }

    console.log("[FeeSubmit API] Fee submission successful!");
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("[FeeSubmit API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to submit fee", details: errorMessage },
      { status: 500 }
    );
  }
}
