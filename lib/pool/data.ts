import type {
  ExplorePoolRow,
  ExistingPoolPosition,
  LiquidityFaqItem,
  ManagePositionDetails,
  PoolDetail,
  PoolPosition,
  PoolSummary,
  TopPoolByTvl,
} from "@/lib/pool/types";
import {
  TOWER_POOL_FEE_LABEL,
  TOWER_POOL_PAIRS,
  TOWER_POOL_ROUTER_ADDRESS,
  type TowerPoolPair,
} from "@/lib/pool/towerPools";

const NOT_INDEXED = "Not indexed";
const FEES_ONLY_APR = "Fees only";

function buildPoolLink(pool: TowerPoolPair) {
  return {
    id: pool.id,
    pair: pool.pair,
    token0: pool.token0,
    token1: pool.token1,
    address: pool.pairAddress,
  };
}

function buildPoolLinks(currentPoolId: string) {
  return TOWER_POOL_PAIRS.filter((pool) => pool.id !== currentPoolId)
    .slice(0, 3)
    .map(buildPoolLink);
}

function buildPoolDetail(pool: TowerPoolPair): PoolDetail {
  return {
    id: pool.id,
    pair: pool.pair,
    token0: pool.token0,
    token1: pool.token1,
    feeTier: pool.feeTier,
    address: pool.pairAddress,
    priceLabel: `Live ${pool.token1}/${pool.token0} quote`,
    priceUsdLabel: pool.chainName,
    pastDayVolume: NOT_INDEXED,
    totalApr: FEES_ONLY_APR,
    tvl: NOT_INDEXED,
    volume24h: NOT_INDEXED,
    fees24h: pool.feeTier,
    balance0: `${pool.token0} reserve`,
    balance1: `${pool.token1} reserve`,
    balance0Share: 50,
    balance1Share: 50,
    transactions: [],
    links: buildPoolLinks(pool.id),
  };
}

function buildExistingPoolPosition(pool: TowerPoolPair): ExistingPoolPosition {
  return {
    poolId: pool.id,
    pair: pool.pair,
    token0: pool.token0,
    token1: pool.token1,
    fee: "0.30",
    feeLabel: pool.feeTier,
    status: "in-range",
    holding0: "0",
    holding1: "0",
    minPrice: "0",
    maxPrice: "Infinity",
    priceUnitBase: pool.token0,
    mode: "Full range",
  };
}

function buildManagePosition(pool: TowerPoolPair): ManagePositionDetails {
  return {
    id: pool.id,
    poolId: pool.id,
    pair: pool.pair,
    token0: pool.token0,
    token1: pool.token1,
    feeLabel: pool.feeTier,
    status: "in-range",
    liquidityUsd: "$0.00",
    holdings: [
      { token: pool.token0, amount: "0" },
      { token: pool.token1, amount: "0" },
    ],
    unclaimedFeeUsd: "$0.00",
    feeBreakdown: [
      { token: pool.token0, amount: "0" },
      { token: pool.token1, amount: "0" },
    ],
    minPrice: "0",
    maxPrice: "Infinity",
    currentPrice: "Market",
  };
}

const DEMO_POOL = TOWER_POOL_PAIRS[0];

export const TOP_POOLS_BY_TVL: TopPoolByTvl[] = TOWER_POOL_PAIRS.slice(0, 4).map(
  (pool) => ({
    id: pool.id,
    pair: pool.pair,
    token0: pool.token0,
    token1: pool.token1,
    metricLabel: pool.feeTier,
  }),
);

export const MOCK_POOL_POSITIONS: PoolPosition[] = [
  {
    id: "1",
    poolId: DEMO_POOL.id,
    pool: DEMO_POOL.pair,
    token0: DEMO_POOL.token0,
    token1: DEMO_POOL.token1,
    liquidity: "$1,000",
    fee: "$20",
    status: "in-range",
    feeTier: TOWER_POOL_FEE_LABEL,
    token0Amount: "500",
    token1Amount: "462.96",
    claimableFee0: "10",
    claimableFee1: "9.26",
  },
  {
    id: "2",
    poolId: DEMO_POOL.id,
    pool: DEMO_POOL.pair,
    token0: DEMO_POOL.token0,
    token1: DEMO_POOL.token1,
    liquidity: "$134",
    fee: "$0.002",
    status: "out-of-range",
    feeTier: TOWER_POOL_FEE_LABEL,
    token0Amount: "67",
    token1Amount: "62.03",
    claimableFee0: "0.001",
    claimableFee1: "0.0009",
  },
  {
    id: "3",
    poolId: DEMO_POOL.id,
    pool: DEMO_POOL.pair,
    token0: DEMO_POOL.token0,
    token1: DEMO_POOL.token1,
    liquidity: "$12,000",
    fee: "$240",
    status: "in-range",
    feeTier: TOWER_POOL_FEE_LABEL,
    token0Amount: "6000",
    token1Amount: "5555.56",
    claimableFee0: "120",
    claimableFee1: "111.11",
  },
  {
    id: "4",
    poolId: DEMO_POOL.id,
    pool: DEMO_POOL.pair,
    token0: DEMO_POOL.token0,
    token1: DEMO_POOL.token1,
    liquidity: "$132",
    fee: "$0.001988",
    status: "closed",
    feeTier: TOWER_POOL_FEE_LABEL,
    token0Amount: "66",
    token1Amount: "61.11",
    claimableFee0: "0.001",
    claimableFee1: "0.0009",
  },
];

export const MOCK_POOL_SUMMARY: PoolSummary = {
  totalPositionValue: "$13,266.00",
  netApr: "Fees only",
  activePositions: 3,
  activeNetworks: 1,
  claimableRewards: "$260.00",
};

export const ESTIMATED_NET_APR = "Fees only";

export const EXPLORE_POOLS: ExplorePoolRow[] = TOWER_POOL_PAIRS.map((pool) => ({
  id: pool.id,
  pair: pool.pair,
  token0: pool.token0,
  token1: pool.token1,
  feeTier: pool.feeTier,
  tvl: NOT_INDEXED,
  poolApr: FEES_ONLY_APR,
  volume1d: NOT_INDEXED,
  volume30d: NOT_INDEXED,
  hasPosition: false,
}));

export const POOL_DETAILS: Record<string, PoolDetail> = Object.fromEntries(
  TOWER_POOL_PAIRS.map((pool) => [pool.id, buildPoolDetail(pool)]),
) as Record<string, PoolDetail>;

export function getPoolDetail(poolId: string): PoolDetail | null {
  return POOL_DETAILS[poolId] ?? null;
}

export const EXISTING_POOL_POSITIONS: Record<string, ExistingPoolPosition> =
  Object.fromEntries(
    TOWER_POOL_PAIRS.map((pool) => [pool.id, buildExistingPoolPosition(pool)]),
  ) as Record<string, ExistingPoolPosition>;

export function getExistingPoolPosition(
  poolId: string,
): ExistingPoolPosition | null {
  return EXISTING_POOL_POSITIONS[poolId] ?? null;
}

const GENERATED_MANAGE_POSITION_DETAILS = Object.fromEntries(
  TOWER_POOL_PAIRS.map((pool) => [pool.id, buildManagePosition(pool)]),
) as Record<string, ManagePositionDetails>;

export const MANAGE_POSITION_DETAILS: Record<string, ManagePositionDetails> = {
  ...GENERATED_MANAGE_POSITION_DETAILS,
  "1": {
    ...buildManagePosition(DEMO_POOL),
    id: "1",
    liquidityUsd: "$1,000",
    holdings: [
      { token: DEMO_POOL.token0, amount: "500", share: "50%" },
      { token: DEMO_POOL.token1, amount: "462.96", share: "50%" },
    ],
    unclaimedFeeUsd: "$20",
    feeBreakdown: [
      { token: DEMO_POOL.token0, amount: "10" },
      { token: DEMO_POOL.token1, amount: "9.26" },
    ],
    currentPrice: "1.08",
  },
  "2": {
    ...buildManagePosition(DEMO_POOL),
    id: "2",
    status: "out-of-range",
    liquidityUsd: "$134",
    holdings: [
      { token: DEMO_POOL.token0, amount: "67", share: "50%" },
      { token: DEMO_POOL.token1, amount: "62.03", share: "50%" },
    ],
    unclaimedFeeUsd: "$0.002",
    feeBreakdown: [
      { token: DEMO_POOL.token0, amount: "0.001" },
      { token: DEMO_POOL.token1, amount: "0.0009" },
    ],
    currentPrice: "1.08",
  },
  "3": {
    ...buildManagePosition(DEMO_POOL),
    id: "3",
    liquidityUsd: "$12,000",
    holdings: [
      { token: DEMO_POOL.token0, amount: "6000", share: "50%" },
      { token: DEMO_POOL.token1, amount: "5555.56", share: "50%" },
    ],
    unclaimedFeeUsd: "$240",
    feeBreakdown: [
      { token: DEMO_POOL.token0, amount: "120" },
      { token: DEMO_POOL.token1, amount: "111.11" },
    ],
    currentPrice: "1.08",
  },
  "4": {
    ...buildManagePosition(DEMO_POOL),
    id: "4",
    status: "closed",
    liquidityUsd: "$132",
    holdings: [
      { token: DEMO_POOL.token0, amount: "66", share: "50%" },
      { token: DEMO_POOL.token1, amount: "61.11", share: "50%" },
    ],
    unclaimedFeeUsd: "$0.001988",
    feeBreakdown: [
      { token: DEMO_POOL.token0, amount: "0.001" },
      { token: DEMO_POOL.token1, amount: "0.0009" },
    ],
    currentPrice: "1.08",
  },
};

export function getManagePosition(
  positionId: string,
): ManagePositionDetails | null {
  if (MANAGE_POSITION_DETAILS[positionId]) {
    return MANAGE_POSITION_DETAILS[positionId];
  }

  return (
    Object.values(MANAGE_POSITION_DETAILS).find(
      (position) => position.poolId === positionId,
    ) ?? null
  );
}

export const LIQUIDITY_FAQ: LiquidityFaqItem[] = [
  {
    id: "what-is",
    question: "What is a liquidity pool?",
    answer:
      "A liquidity pool is a shared reserve of two tokens held in a smart contract. Traders swap against this pool instead of waiting for a matched buyer or seller, and liquidity providers earn from the swap fee paid into the pool reserves.",
  },
  {
    id: "fees",
    question: "How do Tower LPs earn fees?",
    answer:
      "Tower AMM pools use a V2-style fee model. Each swap pays a 0.30% pool fee into the pair, increasing pool reserves. LP tokens represent a pro-rata claim on those larger reserves, so providers realize earned fees when they remove liquidity.",
  },
  {
    id: "who-provides",
    question: "Who provides the funds in a liquidity pool?",
    answer:
      "Liquidity providers supply both tokens in an eligible Tower pair. On Tower, the default pool pairs are USDC/EURC, EURC/USDT, USDC/USDT, USDC/cirBTC, EURC/cirBTC, and USDT/cirBTC on Arc Testnet.",
  },
];

export const TOWER_POOL_ROUTER_LABEL = TOWER_POOL_ROUTER_ADDRESS;