import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/devApiSupabase";
import { normalizeWalletAddress, walletError } from "@/lib/server/wallet";
import { requireWalletSession } from "@/lib/server/walletSession";
import {
  MOCK_POOL_POSITIONS,
  MOCK_POOL_SUMMARY,
} from "@/lib/pool/data";
import {
  getTowerPoolById,
  TOWER_POOL_CHAIN_ID,
  TOWER_POOL_DEX_ID,
} from "@/lib/pool/towerPools";
import type { PoolPosition, PoolPositionStatus, PoolSummary } from "@/lib/pool/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USE_MOCK_POSITIONS =
  process.env.POOL_USE_MOCK_POSITIONS === "true" ||
  process.env.NEXT_PUBLIC_POOL_USE_MOCK_POSITIONS === "true";

const STATUS_VALUES = new Set<PoolPositionStatus>([
  "in-range",
  "out-of-range",
  "closed",
]);
const EVENT_TYPE_VALUES = new Set(["add", "remove", "claim", "sync", "close"]);

type PoolPositionRow = {
  id: string;
  wallet_address: string;
  chain_id: number;
  dex_id: string;
  pool_id: string;
  pair_label: string | null;
  pair_address: string | null;
  router_address: string | null;
  token0_symbol: string | null;
  token1_symbol: string | null;
  token0_address: string | null;
  token1_address: string | null;
  fee_tier_bps: number | null;
  lp_token_amount: string | number | null;
  liquidity_usd: string | number | null;
  token0_amount: string | number | null;
  token1_amount: string | number | null;
  claimable_fee0_amount: string | number | null;
  claimable_fee1_amount: string | number | null;
  claimable_fee_usd: string | number | null;
  apr_percent: string | number | null;
  min_price: string | number | null;
  max_price: string | number | null;
  current_price: string | number | null;
  status: string | null;
};

function getBodyValue(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey];
}

function normalizeDecimal(value: unknown): string | number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeInteger(value: unknown): string | number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBlockNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function normalizeStatus(value: unknown): PoolPositionStatus {
  return typeof value === "string" && STATUS_VALUES.has(value as PoolPositionStatus)
    ? (value as PoolPositionStatus)
    : "in-range";
}

function normalizeEventType(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return EVENT_TYPE_VALUES.has(normalized) ? normalized : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatUsd(value: unknown, fallback = "$0.00") {
  const numeric = toNumber(value);
  if (numeric == null) {
    return fallback;
  }

  const maximumFractionDigits = Math.abs(numeric) >= 1 ? 2 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(numeric);
}

function formatPercent(value: unknown) {
  const numeric = toNumber(value);
  if (numeric == null) {
    return null;
  }

  return `${numeric.toFixed(numeric >= 10 ? 2 : 4).replace(/\.?0+$/, "")}%`;
}

function formatTokenAmount(value: unknown, maximumFractionDigits = 8) {
  const numeric = toNumber(value);
  if (numeric == null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numeric);
}

function mapPoolPositionRow(row: PoolPositionRow): PoolPosition | null {
  const pool = getTowerPoolById(row.pool_id);
  const token0 = row.token0_symbol || pool?.token0;
  const token1 = row.token1_symbol || pool?.token1;

  if (!token0 || !token1) {
    return null;
  }

  const feeTierBps = row.fee_tier_bps ?? pool?.feeTierBps ?? 30;
  const feeTier = `${(feeTierBps / 100).toFixed(2)}%`;

  return {
    id: row.id,
    poolId: row.pool_id || pool?.id || `${token0}-${token1}`.toLowerCase(),
    pool: row.pair_label || pool?.pair || `${token0}/${token1}`,
    token0,
    token1,
    liquidity: formatUsd(row.liquidity_usd),
    fee: formatUsd(row.claimable_fee_usd),
    status: normalizeStatus(row.status),
    feeTier,
    chainId: row.chain_id,
    pairAddress: row.pair_address ?? pool?.pairAddress ?? null,
    token0Amount: formatTokenAmount(row.token0_amount),
    token1Amount: formatTokenAmount(row.token1_amount),
    claimableFee0: formatTokenAmount(row.claimable_fee0_amount),
    claimableFee1: formatTokenAmount(row.claimable_fee1_amount),
    minPrice: formatTokenAmount(row.min_price),
    maxPrice: formatTokenAmount(row.max_price),
    currentPrice: formatTokenAmount(row.current_price),
  };
}

function buildSummary(rows: PoolPositionRow[], positions: PoolPosition[]): PoolSummary | null {
  if (positions.length === 0) {
    return null;
  }

  const activeRows = rows.filter((row) => normalizeStatus(row.status) !== "closed");
  const activePositions = positions.filter((position) => position.status !== "closed");
  const totalPositionValue = activeRows.reduce(
    (sum, row) => sum + (toNumber(row.liquidity_usd) ?? 0),
    0,
  );
  const claimableRewards = rows.reduce(
    (sum, row) => sum + (toNumber(row.claimable_fee_usd) ?? 0),
    0,
  );
  const weightedAprParts = activeRows
    .map((row) => ({
      apr: toNumber(row.apr_percent),
      liquidity: toNumber(row.liquidity_usd) ?? 0,
    }))
    .filter((row) => row.apr != null && row.liquidity > 0);
  const weightedAprLiquidity = weightedAprParts.reduce(
    (sum, row) => sum + row.liquidity,
    0,
  );
  const weightedApr =
    weightedAprLiquidity > 0
      ? weightedAprParts.reduce(
          (sum, row) => sum + (row.apr ?? 0) * row.liquidity,
          0,
        ) / weightedAprLiquidity
      : null;

  return {
    totalPositionValue: formatUsd(totalPositionValue),
    netApr: formatPercent(weightedApr) ?? "Fees only",
    activePositions: activePositions.length,
    activeNetworks:
      new Set(activeRows.map((row) => row.chain_id || TOWER_POOL_CHAIN_ID)).size || 1,
    claimableRewards: formatUsd(claimableRewards),
  };
}

function mockResponse() {
  return NextResponse.json({
    positions: MOCK_POOL_POSITIONS,
    summary: MOCK_POOL_SUMMARY,
  });
}

export async function GET(request: NextRequest) {
  if (USE_MOCK_POSITIONS || request.nextUrl.searchParams.get("demo") === "positions") {
    return mockResponse();
  }

  try {
    const { wallet, response } = requireWalletSession(request);
    if (response || !wallet) {
      return response ?? walletError("Wallet session required.", 401);
    }

    const requestedWallet = normalizeWalletAddress(
      request.nextUrl.searchParams.get("wallet") || wallet,
    );

    if (!requestedWallet) {
      return walletError("Valid wallet address is required.");
    }

    if (requestedWallet !== wallet) {
      return walletError("Wallet session does not match requested wallet.", 403);
    }

    const { data, error } = await supabaseAdmin
      .from("pool_positions")
      .select("*")
      .eq("wallet_address", wallet)
      .eq("dex_id", TOWER_POOL_DEX_ID)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as PoolPositionRow[];
    const positions = rows
      .map(mapPoolPositionRow)
      .filter((position): position is PoolPosition => Boolean(position));

    return NextResponse.json({
      positions,
      summary: buildSummary(rows, positions),
    });
  } catch (error) {
    console.error("GET /api/pool/positions failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to fetch pool positions",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, response } = requireWalletSession(request);
    if (response || !wallet) {
      return response ?? walletError("Wallet session required.", 401);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const poolId = normalizeOptionalText(getBodyValue(body, "pool_id", "poolId"));
    const pool = getTowerPoolById(poolId);

    if (!pool) {
      return walletError("A valid Tower pool_id is required.");
    }

    const status = normalizeStatus(body.status);
    const eventType = normalizeEventType(getBodyValue(body, "event_type", "eventType"));
    const transactionHash = normalizeOptionalText(
      getBodyValue(body, "transaction_hash", "transactionHash"),
    );
    const blockNumber = normalizeBlockNumber(
      getBodyValue(body, "block_number", "blockNumber"),
    );
    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    const row = {
      wallet_address: wallet,
      chain_id: pool.chainId,
      dex_id: pool.dexId,
      pool_id: pool.id,
      pair_label: pool.pair,
      pair_address:
        normalizeOptionalText(getBodyValue(body, "pair_address", "pairAddress")) ??
        pool.pairAddress,
      router_address: pool.routerAddress,
      token0_symbol: pool.token0,
      token1_symbol: pool.token1,
      token0_address: pool.token0Address.toLowerCase(),
      token1_address: pool.token1Address.toLowerCase(),
      fee_tier_bps: pool.feeTierBps,
      lp_token_amount:
        normalizeInteger(getBodyValue(body, "lp_token_amount", "lpTokenAmount")) ?? "0",
      liquidity_usd: normalizeDecimal(getBodyValue(body, "liquidity_usd", "liquidityUsd")),
      token0_amount:
        normalizeDecimal(getBodyValue(body, "token0_amount", "token0Amount")) ?? "0",
      token1_amount:
        normalizeDecimal(getBodyValue(body, "token1_amount", "token1Amount")) ?? "0",
      claimable_fee0_amount:
        normalizeDecimal(getBodyValue(body, "claimable_fee0_amount", "claimableFee0Amount")) ?? "0",
      claimable_fee1_amount:
        normalizeDecimal(getBodyValue(body, "claimable_fee1_amount", "claimableFee1Amount")) ?? "0",
      claimable_fee_usd: normalizeDecimal(
        getBodyValue(body, "claimable_fee_usd", "claimableFeeUsd"),
      ),
      apr_percent: normalizeDecimal(getBodyValue(body, "apr_percent", "aprPercent")),
      min_price: normalizeDecimal(getBodyValue(body, "min_price", "minPrice")),
      max_price: normalizeDecimal(getBodyValue(body, "max_price", "maxPrice")),
      current_price: normalizeDecimal(
        getBodyValue(body, "current_price", "currentPrice"),
      ),
      status,
      opened_transaction_hash: transactionHash,
      last_transaction_hash: transactionHash,
      last_block_number: blockNumber,
      last_synced_at: new Date().toISOString(),
      metadata,
    };

    const { data, error } = await supabaseAdmin
      .from("pool_positions")
      .upsert(row, {
        onConflict: "wallet_address,chain_id,dex_id,pool_id",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (eventType || transactionHash) {
      const resolvedEventType = eventType ?? (status === "closed" ? "close" : "sync");
      const { error: eventError } = await supabaseAdmin
        .from("pool_position_events")
        .insert({
          pool_position_id: data.id,
          wallet_address: wallet,
          chain_id: pool.chainId,
          dex_id: pool.dexId,
          pool_id: pool.id,
          event_type: resolvedEventType,
          token0_amount: row.token0_amount,
          token1_amount: row.token1_amount,
          lp_token_amount: row.lp_token_amount,
          fee0_amount: row.claimable_fee0_amount,
          fee1_amount: row.claimable_fee1_amount,
          amount_usd: row.liquidity_usd,
          transaction_hash: transactionHash,
          block_number: blockNumber,
          metadata,
        });

      if (eventError) {
        throw new Error(eventError.message);
      }
    }

    const position = mapPoolPositionRow(data as PoolPositionRow);

    return NextResponse.json({
      success: true,
      data,
      position,
    });
  } catch (error) {
    console.error("POST /api/pool/positions failed:", error);
    return walletError(
      error instanceof Error ? error.message : "Failed to upsert pool position",
      500,
    );
  }
}
