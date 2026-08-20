import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LEGACY_ACCESS_TABLES = [
  "activities",
  "ai_db",
  "ai_chat_sessions",
  "recurring_orders",
  "recurring_order_executions",
  "swap_fees",
] as const;
const EVM_WALLET_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/;

type CheckWalletAccessRow = {
  is_registered?: boolean | null;
  isRegistered?: boolean | null;
  access_source?: string | null;
  accessSource?: string | null;
};

function createSupabaseRouteClient(options?: { preferServiceRole?: boolean }) {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const preferServiceRole = options?.preferServiceRole !== false;
  const supabaseKey =
    preferServiceRole && supabaseServiceRoleKey
      ? supabaseServiceRoleKey
      : supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (preferServiceRole && !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for wallet access checks after RLS lockdown.",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
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
  table: string,
  normalizedWalletAddress: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("wallet_address")
    .ilike("wallet_address", normalizedWalletAddress)
    .limit(1);

  if (error) {
    if (isIgnorableQueryError(error.message)) {
      console.warn(`Skipping wallet access lookup for ${table}:`, error.message);
      return false;
    }

    throw new Error(`Failed to query ${table}: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function getInviteRedemptionAccess(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  normalizedWalletAddress: string,
) {
  return hasWalletRecord(
    supabase,
    "invite_code_redemptions",
    normalizedWalletAddress,
  );
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

    if (!EVM_WALLET_ADDRESS_PATTERN.test(normalizedWalletAddress)) {
      return NextResponse.json(
        { success: false, message: "Wallet address is invalid." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseRouteClient({ preferServiceRole: true });

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

      isRegistered = (result?.is_registered ?? result?.isRegistered) === true;
      accessSource = result?.access_source ?? result?.accessSource ?? null;
    }

    if (!isRegistered) {
      const fallbackSupabase = createSupabaseRouteClient({
        preferServiceRole: true,
      });

      const hasInviteRedemptionAccess = await getInviteRedemptionAccess(
        fallbackSupabase,
        normalizedWalletAddress,
      );

      if (hasInviteRedemptionAccess) {
        isRegistered = true;
        accessSource = accessSource ?? "invite-redemption";
      }
    }

    if (!isRegistered) {
      const fallbackSupabase = createSupabaseRouteClient({
        preferServiceRole: true,
      });

      const hasLegacyWalletAccess = await getLegacyWalletAccess(
        fallbackSupabase,
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
