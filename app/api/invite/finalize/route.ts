import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PENDING_INVITE_COOKIE = "tower_pending_invite_code";

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

const clearPendingInviteCookie = (response: NextResponse) => {
  response.cookies.set(PENDING_INVITE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();
    const normalizedWalletAddress =
      typeof walletAddress === "string" && walletAddress.trim()
        ? walletAddress.trim().toLowerCase()
        : null;
    const pendingInviteCode = request.cookies
      .get(PENDING_INVITE_COOKIE)
      ?.value?.trim()
      .toUpperCase();

    if (!normalizedWalletAddress) {
      return NextResponse.json(
        { success: false, message: "Wallet address is required." },
        { status: 400 },
      );
    }

    if (!pendingInviteCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing invite session. Enter your invite code again.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseRouteClient();
    const { data, error } = await supabase.rpc("redeem_invite_code", {
      input_code: pendingInviteCode,
      redemption_wallet_address: normalizedWalletAddress,
      redemption_metadata: {
        source: "invite-gate-finalize",
        finalized_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Invite finalization failed:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Unable to finalize invite access right now.",
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
          message: "Invite finalization returned an empty response.",
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

    const response = NextResponse.json({
      success: true,
      message: result.message,
      remainingUses: result.remaining_uses,
      totalUses: result.total_uses,
      maxUses: result.max_uses,
    });

    clearPendingInviteCookie(response);
    return response;
  } catch (error) {
    console.error("Unexpected invite finalization error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error while finalizing invite access.",
      },
      { status: 500 },
    );
  }
}
