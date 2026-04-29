import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PENDING_INVITE_COOKIE = "tower_pending_invite_code";
const PENDING_INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 30;

type InviteCodeResponseRow = {
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

const extractInviteCodeResult = (data: unknown) => {
  if (Array.isArray(data)) {
    return (data[0] as InviteCodeResponseRow | undefined) ?? null;
  }

  return (data as InviteCodeResponseRow | null) ?? null;
};

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
    const rpcName = normalizedWalletAddress
      ? "redeem_invite_code"
      : "validate_invite_code";
    const rpcArgs = normalizedWalletAddress
      ? {
          input_code: normalizedCode,
          redemption_wallet_address: normalizedWalletAddress,
          redemption_metadata: {
            source: "invite-gate",
            redeemed_at: new Date().toISOString(),
          },
        }
      : {
          input_code: normalizedCode,
        };

    const { data, error } = await supabase.rpc(rpcName, rpcArgs);

    if (error) {
      console.error("Invite code flow failed:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Unable to validate invite code right now.",
        },
        { status: 500 },
      );
    }

    const result = extractInviteCodeResult(data);

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

    const response = NextResponse.json({
      success: true,
      message: result.message,
      remainingUses: result.remaining_uses,
      totalUses: result.total_uses,
      maxUses: result.max_uses,
      requiresWalletConnection: !normalizedWalletAddress,
    });

    if (normalizedWalletAddress) {
      clearPendingInviteCookie(response);
      return response;
    }

    response.cookies.set(PENDING_INVITE_COOKIE, normalizedCode, {
      httpOnly: true,
      maxAge: PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
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
