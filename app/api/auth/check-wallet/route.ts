import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Check if the wallet address has redeemed an invite code
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

    // Wallet is registered if there's at least one redemption record
    const isRegistered = data && data.length > 0;

    return NextResponse.json({
      success: true,
      isRegistered,
      walletAddress: normalizedWalletAddress,
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
