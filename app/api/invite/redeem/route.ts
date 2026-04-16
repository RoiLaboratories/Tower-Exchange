import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RedeemInviteCodeResponseRow = {
  success: boolean;
  message: string;
  remaining_uses: number | null;
  total_uses: number | null;
  max_uses: number | null;
};

function createSupabaseRouteClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { code, walletAddress } = await request.json();
    const normalizedCode =
      typeof code === "string" ? code.trim().toUpperCase() : "";
    const normalizedWalletAddress =
      typeof walletAddress === "string" && walletAddress.trim()
        ? walletAddress.trim().toLowerCase()
        : null;

    if (!normalizedCode) {
      return NextResponse.json(
        { success: false, message: "Invite code is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseRouteClient();
    const { data, error } = await supabase.rpc("redeem_invite_code", {
      input_code: normalizedCode,
      redemption_wallet_address: normalizedWalletAddress,
      redemption_metadata: {
        source: "invite-gate",
        redeemed_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Invite code redemption failed:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Unable to validate invite code right now.",
        },
        { status: 500 },
      );
    }

    const result = Array.isArray(data)
      ? (data[0] as RedeemInviteCodeResponseRow | undefined)
      : (data as RedeemInviteCodeResponseRow | null);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message: "Invite validation returned an empty response.",
        },
        { status: 500 },
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          remainingUses: result.remaining_uses,
          totalUses: result.total_uses,
          maxUses: result.max_uses,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      remainingUses: result.remaining_uses,
      totalUses: result.total_uses,
      maxUses: result.max_uses,
    });
  } catch (error) {
    console.error("Unexpected invite redemption error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error while validating invite code.",
      },
      { status: 500 },
    );
  }
}
