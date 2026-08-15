import { NextRequest, NextResponse } from "next/server";
import { requireWalletAddress, walletError } from "@/lib/server/wallet";
import { issueWalletNonce } from "@/lib/server/walletSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      walletAddress?: unknown;
    };
    const { wallet, response } = requireWalletAddress(body.walletAddress);
    if (response || !wallet) {
      return response ?? walletError("Valid wallet address is required.");
    }

    const nonce = issueWalletNonce(wallet);
    return NextResponse.json({
      success: true,
      wallet: nonce.wallet,
      nonce: nonce.nonce,
      nonceToken: nonce.token,
      message: nonce.message,
      expiresInSeconds: nonce.expiresInSeconds,
    });
  } catch (error) {
    console.error("POST /api/auth/wallet/nonce failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to issue nonce",
      500,
    );
  }
}
