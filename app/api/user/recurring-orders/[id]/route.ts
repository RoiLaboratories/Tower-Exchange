import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/devApiSupabase";
import { requireWalletAddress, walletError } from "@/lib/server/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_UPDATE_KEYS = new Set([
  "is_active",
  "amount",
  "frequency",
  "end_date",
  "next_execution_date",
  "onchain_order_key",
  "executor_address",
  "approval_transaction_hash",
  "authorization_transaction_hash",
  "onchain_authorized",
  "execution_count",
  "signature",
]);

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    const { searchParams } = new URL(request.url);
    const { wallet, response } = requireWalletAddress(
      searchParams.get("walletAddress"),
    );
    if (response || !wallet) {
      return response ?? walletError("Valid wallet address is required.");
    }

    const { data, error } = await supabaseAdmin
      .from("recurring_orders")
      .select("*")
      .eq("id", id)
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return walletError("Order not found.", 404);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/user/recurring-orders/[id] failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to fetch recurring order",
      500,
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const { wallet, response } = requireWalletAddress(
      body.wallet_address ?? body.walletAddress,
    );
    if (response || !wallet) {
      return response ?? walletError("Valid wallet address is required.");
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_KEYS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return walletError("No valid update fields provided.");
    }

    const { data, error } = await supabaseAdmin
      .from("recurring_orders")
      .update(updates)
      .eq("id", id)
      .eq("wallet_address", wallet)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return walletError("Order not found for wallet.", 404);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PATCH /api/user/recurring-orders/[id] failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to update recurring order",
      500,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    const { searchParams } = new URL(request.url);
    const { wallet, response } = requireWalletAddress(
      searchParams.get("walletAddress"),
    );
    if (response || !wallet) {
      return response ?? walletError("Valid wallet address is required.");
    }

    const { data, error } = await supabaseAdmin
      .from("recurring_orders")
      .delete()
      .eq("id", id)
      .eq("wallet_address", wallet)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return walletError("Order not found for wallet.", 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/user/recurring-orders/[id] failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to delete recurring order",
      500,
    );
  }
}
