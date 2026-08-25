import type { ExistingPoolPosition } from "@/lib/pool/types";
import { getPoolToken } from "@/lib/pool/newPosition";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

export function buildIncreaseLiquidityPath(poolId: string): string {
  return `/pool/increase-liquidity/${poolId}`;
}

export function buildManagePositionPath(positionId: string): string {
  return `/pool/manage/${positionId}`;
}

export function getExistingPositionTokens(position: ExistingPoolPosition): {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
} | null {
  const token0 = getPoolToken(position.token0)?.symbol;
  const token1 = getPoolToken(position.token1)?.symbol;

  if (!token0 || !token1) {
    return null;
  }

  return { token0, token1 };
}
