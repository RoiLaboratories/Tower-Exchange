import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LEGACY_ACCESS_TABLES = [
  "activities",
  "ai_chat_messages",
  "ai_chat_sessions",
  "recurring_orders",
  "recurring_order_executions",
  "swap_fees",
] as const;

type CheckWalletAccessRow = {
  is_registered: boolean;
  access_source: string | null;
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

const isIgnorableQueryError = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find") ||
    normalized.includes("schema cache") ||
    normalized.includes("permission denied")
  );
};

async function hasWalletRecord(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  table: (typeof LEGACY_ACCESS_TABLES)[number],
  normalizedWalletAddress: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("wallet_address")
    .ilike("wallet_address", normalizedWalletAddress)
    .limit(1);

  if (error) {
    if (isIgnorableQueryError(error.message)) {
      console.warn(`Skipping legacy wallet lookup for ${table}:`, error.message);
      return false;
    }

    throw new Error(`Failed to query ${table}: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function getLegacyWalletAccess(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  normalizedWalletAddress: string,
) {
  const matches = await Promise.all(
    LEGACY_ACCESS_TABLES.map((table) =>
      hasWalletRecord(supabase, table, normalizedWalletAddress),
    ),
  );

  return matches.some(Boolean);
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

    let isRegistered = false;
    let accessSource: string | null = null;

    const { data, error } = await supabase.rpc("check_wallet_access", {
      input_wallet_address: normalizedWalletAddress,
    });

    if (error) {
      console.warn("RPC wallet registration check failed, falling back:", error);
    } else {
      const result = Array.isArray(data)
        ? (data[0] as CheckWalletAccessRow | undefined)
        : (data as CheckWalletAccessRow | null);

      isRegistered = result?.is_registered === true;
      accessSource = result?.access_source ?? null;
    }

    if (!isRegistered) {
      const hasLegacyWalletAccess = await getLegacyWalletAccess(
        supabase,
        normalizedWalletAddress,
      );

      if (hasLegacyWalletAccess) {
        isRegistered = true;
        accessSource = accessSource ?? "legacy-wallet";
      }
    }

    return NextResponse.json({
      success: true,
      isRegistered,
      walletAddress: normalizedWalletAddress,
      accessSource,
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
