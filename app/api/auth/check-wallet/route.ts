import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LEGACY_ACCESS_TABLES = [
  "activities",
  "ai_chat_messages",
  "ai_chat_sessions",
  "recurring_orders",
] as const;

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

async function hasWalletRecord(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  table: (typeof LEGACY_ACCESS_TABLES)[number],
  normalizedWalletAddress: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .ilike("wallet_address", normalizedWalletAddress)
    .limit(1);

  if (error) {
    throw new Error(`Failed to query ${table}: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();
    const normalizedWalletAddress =
      typeof walletAddress === "string" && walletAddress.trim()
        ? walletAddress.trim().toLowerCase()
        : null;

    if (!normalizedWalletAddress) {
      return NextResponse.json(
        { success: false, message: "Wallet address is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseRouteClient();

    // First honor invite-code redemptions from the gate flow.
    const { data, error } = await supabase
      .from("invite_code_redemptions")
      .select("id")
      .eq("wallet_address", normalizedWalletAddress)
      .limit(1);

    if (error) {
      console.error("Failed to check wallet registration:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify wallet registration.",
        },
        { status: 500 },
      );
    }

    const hasInviteRedemption = Array.isArray(data) && data.length > 0;
    const legacyMatches = hasInviteRedemption
      ? []
      : await Promise.all(
          LEGACY_ACCESS_TABLES.map((table) =>
            hasWalletRecord(supabase, table, normalizedWalletAddress),
          ),
        );

    // Treat existing Privy-era wallets with app history as already admitted.
    const isRegistered =
      hasInviteRedemption || legacyMatches.some((match) => match);

    return NextResponse.json({
      success: true,
      isRegistered,
      walletAddress: normalizedWalletAddress,
      accessSource: hasInviteRedemption
        ? "invite-redemption"
        : isRegistered
          ? "legacy-wallet"
          : null,
    });
  } catch (error) {
    console.error("Error checking wallet registration:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while checking wallet registration.",
      },
      { status: 500 },
    );
  }
}
