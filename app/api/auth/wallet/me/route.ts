import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { readWalletSession } from "@/lib/server/walletSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = readWalletSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    wallet: session.wallet,
  });
}
