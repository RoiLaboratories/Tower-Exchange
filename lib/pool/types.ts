export type PoolPositionStatus = "in-range" | "out-of-range" | "closed";

export interface PoolPosition {
  id: string;
  poolId: string;
  pool: string;
  token0: string;
  token1: string;
  liquidity: string;
  fee: string;
  status: PoolPositionStatus;
  feeTier?: string;
  chainId?: number;
  pairAddress?: string | null;
  token0Amount?: string | null;
  token1Amount?: string | null;
  claimableFee0?: string | null;
  claimableFee1?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  currentPrice?: string | null;
}

export interface PoolSummary {
  totalPositionValue: string;
  netApr: string;
  activePositions: number;
  activeNetworks: number;
  claimableRewards: string;
}

export interface TopPoolByTvl {
  id: string;
  pair: string;
  token0: string;
  token1: string;
  metricLabel: string;
}

export interface ExplorePoolRow {
  id: string;
  pair: string;
  token0: string;
  token1: string;
  feeTier: string;
  tvl: string;
  poolApr: string;
  volume1d: string;
  volume30d: string;
  hasPosition: boolean;
  positionId?: string;
}

export interface ExistingPoolPosition {
  poolId: string;
  pair: string;
  token0: string;
  token1: string;
  fee: string;
  feeLabel: string;
  status: PoolPositionStatus;
  holding0: string;
  holding1: string;
  minPrice: string;
  maxPrice: string;
  priceUnitBase: string;
  mode: string;
}

export interface ManagePositionTokenAmount {
  token: string;
  amount: string;
  share?: string;
}

export interface ManagePositionDetails {
  id: string;
  poolId: string;
  pair: string;
  token0: string;
  token1: string;
  feeLabel: string;
  status: PoolPositionStatus;
  liquidityUsd: string;
  holdings: ManagePositionTokenAmount[];
  unclaimedFeeUsd: string;
  feeBreakdown: ManagePositionTokenAmount[];
  minPrice: string;
  maxPrice: string;
  currentPrice: string;
}

export interface PoolTransaction {
  id: string;
  time: string;
  type: "Add" | "Remove";
  usd: string;
  amount0: string;
  amount1: string;
  wallet: string;
}

export interface PoolLinkItem {
  id: string;
  pair: string;
  token0: string;
  token1: string;
  address: string;
}

export interface PoolDetail {
  id: string;
  pair: string;
  token0: string;
  token1: string;
  feeTier: string;
  address: string;
  priceLabel: string;
  priceUsdLabel: string;
  pastDayVolume: string;
  totalApr: string;
  tvl: string;
  volume24h: string;
  fees24h: string;
  balance0: string;
  balance1: string;
  balance0Share: number;
  balance1Share: number;
  transactions: PoolTransaction[];
  links: PoolLinkItem[];
}

export interface LiquidityFaqItem {
  id: string;
  question: string;
  answer: string;
}
