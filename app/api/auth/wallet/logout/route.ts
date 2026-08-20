import { NextResponse } from "next/server";
import { clearWalletSessionCookie } from "@/lib/server/walletSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearWalletSessionCookie(response);
}
