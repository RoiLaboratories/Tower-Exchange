import { ARC_TESTNET_CONFIG, TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";
import type { SwapTokenSymbol } from "@/lib/swapTokens";

export const TOWER_POOL_DEX_ID = "tower-dex" as const;
export const TOWER_POOL_DEX_NAME = "Tower" as const;
export const TOWER_POOL_CHAIN_ID = ARC_TESTNET_CONFIG.chainId;
export const TOWER_POOL_CHAIN_NAME = "Arc Testnet";
export const TOWER_POOL_FEE_BPS = 30;
export const TOWER_POOL_FEE_LABEL = "0.30%";

const DEFAULT_TOWER_DEX_ROUTER_ADDRESS =
  "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2";

const serverTowerDexRouterAddress =
  typeof window === "undefined" ? process.env.TOWER_DEX_ROUTER_ADDRESS : undefined;

export const TOWER_POOL_ROUTER_ADDRESS =
  process.env.NEXT_PUBLIC_TOWER_DEX_ROUTER_ADDRESS ||
  serverTowerDexRouterAddress ||
  DEFAULT_TOWER_DEX_ROUTER_ADDRESS;

export type TowerPoolTokenSymbol = Extract<
  SwapTokenSymbol,
  "USDC" | "EURC" | "USDT" | "cirBTC" | "cNGN" | "QCAD"
>;

export interface TowerPoolPair {
  id: string;
  pair: string;
  token0: TowerPoolTokenSymbol;
  token1: TowerPoolTokenSymbol;
  pairAddress: string;
  token0Address: string;
  token1Address: string;
  token0Decimals: number;
  token1Decimals: number;
  feeTier: typeof TOWER_POOL_FEE_LABEL;
  feeTierBps: typeof TOWER_POOL_FEE_BPS;
  chainId: typeof TOWER_POOL_CHAIN_ID;
  chainName: typeof TOWER_POOL_CHAIN_NAME;
  dexId: typeof TOWER_POOL_DEX_ID;
  dexName: typeof TOWER_POOL_DEX_NAME;
  routerAddress: string;
}

const TOWER_POOL_PAIR_DEFINITIONS = [
  ["usdc-eurc", "USDC", "EURC", "0xFA4Cc09c073742b7EA534E0B55B8d2BB3089668C"],
  ["eurc-usdt", "EURC", "USDT", "0x037d9c33A8C0ddA1FbA65732A2f9b49651e465F1"],
  ["usdc-usdt", "USDC", "USDT", "0x22512C21A6A651D05D786Caf54Fdfee69205192c"],
  ["usdc-cirbtc", "USDC", "cirBTC", "0x05efF4C5152178641b3e4A0Bf07D797D2ad9A68F"],
  ["eurc-cirbtc", "EURC", "cirBTC", "0xfF3353631f6d3F6615E89bA8824F40Bbb5f13cF8"],
  ["usdt-cirbtc", "USDT", "cirBTC", "0x06c73D86a01129Ab177d2BEf0BbD69010B17fC0c"],
  ["usdc-cngn", "USDC", "cNGN", "0x5a99541FC028d69e24e4A5aD78F94aE83AFbCff5"],
  ["usdt-cngn", "USDT", "cNGN", "0x02690e571eF2Fc13c7BC32708a9846DDC2310e2B"],
  ["eurc-cngn", "EURC", "cNGN", "0xcc39cf1328A195E24B86927EB24bf8498ED1e6F8"],
  ["cirbtc-cngn", "cirBTC", "cNGN", "0x9E23C4a2f5b8d86605AF2EF99d8af87090aF6628"],
  // ["usdc-qcad", "USDC", "QCAD", "0x124DD01804e608803acBBE29Fd94A701eC44762C"],
  // ["usdt-qcad", "USDT", "QCAD", "0x716EfC9C84C1C33bF3Dd6c97cBc342879432A4A8"],
  // ["eurc-qcad", "EURC", "QCAD", "0x6E0bF9A30fAd828EC6c57c3EeB9Bba7CcCf4D11a"],
  // ["cirbtc-qcad", "cirBTC", "QCAD", "0xDfd6FaDF47a00253B3434acA87e7cbeFDb806925"],
  // ["cngn-qcad", "cNGN", "QCAD", "0x03128b6840237D1846d7f0433D2DE143A8Aaf8B8"],
] as const satisfies readonly [
  string,
  TowerPoolTokenSymbol,
  TowerPoolTokenSymbol,
  string,
][];

export const TOWER_POOL_PAIRS: readonly TowerPoolPair[] =
  TOWER_POOL_PAIR_DEFINITIONS.map(([id, token0, token1, pairAddress]) => ({
    id,
    pair: `${token0}/${token1}`,
    token0,
    token1,
    pairAddress,
    token0Address: TOKEN_CONTRACTS[token0],
    token1Address: TOKEN_CONTRACTS[token1],
    token0Decimals: TOKEN_DECIMALS[token0],
    token1Decimals: TOKEN_DECIMALS[token1],
    feeTier: TOWER_POOL_FEE_LABEL,
    feeTierBps: TOWER_POOL_FEE_BPS,
    chainId: TOWER_POOL_CHAIN_ID,
    chainName: TOWER_POOL_CHAIN_NAME,
    dexId: TOWER_POOL_DEX_ID,
    dexName: TOWER_POOL_DEX_NAME,
    routerAddress: TOWER_POOL_ROUTER_ADDRESS,
  }));

export const TOWER_POOL_IDS = TOWER_POOL_PAIRS.map((pool) => pool.id);

export function getTowerPoolById(poolId?: string | null): TowerPoolPair | null {
  if (!poolId) {
    return null;
  }

  const normalized = poolId.trim().toLowerCase();
  return TOWER_POOL_PAIRS.find((pool) => pool.id === normalized) ?? null;
}

export function getTowerPoolByTokens(
  token0?: string | null,
  token1?: string | null,
): TowerPoolPair | null {
  if (!token0 || !token1) {
    return null;
  }

  const first = token0.trim().toLowerCase();
  const second = token1.trim().toLowerCase();

  return (
    TOWER_POOL_PAIRS.find((pool) => {
      const poolToken0 = pool.token0.toLowerCase();
      const poolToken1 = pool.token1.toLowerCase();
      return (
        (poolToken0 === first && poolToken1 === second) ||
        (poolToken0 === second && poolToken1 === first)
      );
    }) ?? null
  );
}

