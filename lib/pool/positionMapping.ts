import type {
  ExistingPoolPosition,
  ManagePositionDetails,
  PoolPosition,
} from "@/lib/pool/types";

export function mapPoolPositionToManageDetails(
  position: PoolPosition,
): ManagePositionDetails {
  return {
    id: position.id,
    poolId: position.poolId,
    pair: position.pool,
    token0: position.token0,
    token1: position.token1,
    feeLabel: position.feeTier ?? "0.30%",
    status: position.status,
    liquidityUsd: position.liquidity,
    holdings: [
      { token: position.token0, amount: position.token0Amount ?? "0" },
      { token: position.token1, amount: position.token1Amount ?? "0" },
    ],
    unclaimedFeeUsd: position.fee,
    feeBreakdown: [
      { token: position.token0, amount: position.claimableFee0 ?? "0" },
      { token: position.token1, amount: position.claimableFee1 ?? "0" },
    ],
    minPrice: position.minPrice ?? "0",
    maxPrice: position.maxPrice ?? "Infinity",
    currentPrice: position.currentPrice ?? "Market",
  };
}
export function mapPoolPositionToExistingPoolPosition(
  position: PoolPosition,
): ExistingPoolPosition {
  const feeLabel = position.feeTier ?? "0.30%";

  return {
    poolId: position.poolId,
    pair: position.pool,
    token0: position.token0,
    token1: position.token1,
    fee: feeLabel.replace("%", ""),
    feeLabel,
    status: position.status,
    holding0: position.token0Amount ?? "0",
    holding1: position.token1Amount ?? "0",
    minPrice: position.minPrice ?? "0",
    maxPrice: position.maxPrice ?? "Infinity",
    priceUnitBase: position.token0,
    mode: "Full range",
  };
}

