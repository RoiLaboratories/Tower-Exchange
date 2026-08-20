import { NextRequest, NextResponse } from "next/server";
import { requireWalletAddress, walletError } from "@/lib/server/wallet";
import {
  attachWalletSessionCookie,
  verifyWalletLogin,
} from "@/lib/server/walletSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      walletAddress?: unknown;
      signature?: unknown;
      nonceToken?: unknown;
    };

    const { wallet, response } = requireWalletAddress(body.walletAddress);
    if (response || !wallet) {
      return response ?? walletError("Valid wallet address is required.");
    }

    if (typeof body.signature !== "string" || !body.signature.trim()) {
      return walletError("Signature is required.");
    }

    if (typeof body.nonceToken !== "string" || !body.nonceToken.trim()) {
      return walletError("Nonce token is required.");
    }

    const verified = await verifyWalletLogin({
      walletAddress: wallet,
      signature: body.signature,
      nonceToken: body.nonceToken,
    });

    if (!verified.ok) {
      return walletError(verified.error, 401);
    }

    const responseJson = NextResponse.json({
      success: true,
      wallet: verified.wallet,
      expiresInSeconds: verified.expiresInSeconds,
    });

    return attachWalletSessionCookie(
      responseJson,
      verified.sessionToken,
      verified.expiresInSeconds,
    );
  } catch (error) {
    console.error("POST /api/auth/wallet/verify failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to verify wallet",
      500,
    );
  }
}
