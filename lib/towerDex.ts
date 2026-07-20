import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  getAddress,
  http,
  isAddress,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";
import { ARC_RPC_ENDPOINTS, ARC_RPC_PROXY_PATH } from "@/lib/arcRpc";

export const TOWER_DEX_ID = "tower-dex" as const;
export const TOWER_DEX_NAME = "Tower DEX" as const;
export const TOWER_DEX_CHAIN_ID = 5042002;
export const TOWER_DEX_PUBLIC_RPC_URL = "https://rpc.testnet.arc.network";
export const TOWER_DEX_PROXY_RPC_PATH = ARC_RPC_PROXY_PATH;

const TOWER_DEX_ROUTER_ADDRESS = normalizeTowerDexAddress(
  process.env.NEXT_PUBLIC_TOWER_DEX_ROUTER_ADDRESS ||
    process.env.TOWER_DEX_ROUTER_ADDRESS ||
    "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2",
);

const TOWER_DEX_PAIRS = [
  {
    key: "USDC/EURC",
    token0Symbol: "USDC",
    token1Symbol: "EURC",
    token0: normalizeTowerDexAddress(TOKEN_CONTRACTS.USDC),
    token1: normalizeTowerDexAddress(TOKEN_CONTRACTS.EURC),
    pairAddress: normalizeTowerDexAddress(
      process.env.NEXT_PUBLIC_TOWER_DEX_USDC_EURC_PAIR_ADDRESS ||
        process.env.TOWER_DEX_USDC_EURC_PAIR_ADDRESS ||
        "0xFA4Cc09c073742b7EA534E0B55B8d2BB3089668C",
    ),
  },
  {
    key: "EURC/USDT",
    token0Symbol: "EURC",
    token1Symbol: "USDT",
    token0: normalizeTowerDexAddress(TOKEN_CONTRACTS.EURC),
    token1: normalizeTowerDexAddress(TOKEN_CONTRACTS.USDT),
    pairAddress: normalizeTowerDexAddress(
      process.env.NEXT_PUBLIC_TOWER_DEX_EURC_USDT_PAIR_ADDRESS ||
        process.env.TOWER_DEX_EURC_USDT_PAIR_ADDRESS ||
        "0x037d9c33A8C0ddA1FbA65732A2f9b49651e465F1",
    ),
  },
  {
    key: "USDC/USDT",
    token0Symbol: "USDC",
    token1Symbol: "USDT",
    token0: normalizeTowerDexAddress(TOKEN_CONTRACTS.USDC),
    token1: normalizeTowerDexAddress(TOKEN_CONTRACTS.USDT),
    pairAddress: normalizeTowerDexAddress(
      process.env.NEXT_PUBLIC_TOWER_DEX_USDC_USDT_PAIR_ADDRESS ||
        process.env.TOWER_DEX_USDC_USDT_PAIR_ADDRESS ||
        "0x22512C21A6A651D05D786Caf54Fdfee69205192c",
    ),
  },
] as const;

const TOWER_DEX_ROUTER_ABI = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

const TOWER_DEX_PAIR_ABI = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
] as const;

const ERC20_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type SupportedTowerDexSymbol = keyof typeof TOKEN_DECIMALS;

type TowerDexDirectPair = (typeof TOWER_DEX_PAIRS)[number];

type TowerDexTokenSnapshot = {
  address: Address;
  symbol: SupportedTowerDexSymbol;
  decimals: number;
};

type TowerDexPairSnapshot = {
  pairAddress: Address;
  tokenIn: TowerDexTokenSnapshot;
  tokenOut: TowerDexTokenSnapshot;
};

export type TowerDexQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  minOut: string;
  inputAmountNative: string;
  outputAmountNative: string;
  minOutNative: string;
  priceImpact: number;
  gasEstimate: string;
  slippage: number;
  feeMode: "none";
  route: {
    type: "single";
      hops: Array<{
        dexId: typeof TOWER_DEX_ID;
        dex?: typeof TOWER_DEX_ID;
        dexName: typeof TOWER_DEX_NAME;
        dexRouter: string;
        path: string[];
      amountIn: string;
      amountOut: string;
      priceImpact: number;
      liquidity?: string;
    }>;
  };
};

export type TowerDexTransaction = {
  to: string;
  data: Hex;
  value: string;
  gasLimit: string;
  chainId: number;
};

const getDefaultTowerDexRpcUrl = () =>
  typeof window === "undefined"
    ? TOWER_DEX_PUBLIC_RPC_URL
    : TOWER_DEX_PROXY_RPC_PATH;

export function createTowerDexPublicClient(
  rpcUrl = getDefaultTowerDexRpcUrl(),
) {
  const serverRpcUrls =
    typeof window === "undefined"
      ? Array.from(new Set([rpcUrl, ...ARC_RPC_ENDPOINTS]))
      : [rpcUrl];

  return createPublicClient({
    chain: {
      id: TOWER_DEX_CHAIN_ID,
      name: "Arc Testnet",
      nativeCurrency: {
        decimals: 18,
        name: "USDC",
        symbol: "USDC",
      },
      rpcUrls: {
        default: { http: serverRpcUrls },
      },
    },
    transport:
      typeof window === "undefined"
        ? fallback(
            serverRpcUrls.map((url) =>
              http(url, {
                retryCount: 1,
                timeout: 12_000,
              }),
            ),
          )
        : http(rpcUrl, {
            retryCount: 2,
            timeout: 12_000,
          }),
  });
}

export function normalizeTowerDexAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid Tower DEX address: ${address}`);
  }

  return getAddress(address);
}

export function normalizeTowerDexId(rawDexId?: string | null) {
  const normalized = rawDexId?.trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (!normalized) {
    return undefined;
  }

  if (
    normalized === TOWER_DEX_ID ||
    normalized === "tower" ||
    normalized === "tower-amm"
  ) {
    return TOWER_DEX_ID;
  }

  return undefined;
}

const TOWER_DEX_ENABLED =
  process.env.NEXT_PUBLIC_TOWER_DEX_ENABLED !== "false" &&
  process.env.TOWER_DEX_ENABLED !== "false";

export function isTowerDexEnabled() {
  return TOWER_DEX_ENABLED;
}

export function getTowerDexInfo() {
  return {
    id: TOWER_DEX_ID,
    name: TOWER_DEX_NAME,
    routerAddress: TOWER_DEX_ROUTER_ADDRESS,
    type: "v2" as const,
    chainId: TOWER_DEX_CHAIN_ID,
    enabled: isTowerDexEnabled(),
    supportedTokens: Array.from(
      new Set(
        TOWER_DEX_PAIRS.flatMap((pair) => [pair.token0, pair.token1]),
      ),
    ),
    poolAddresses: TOWER_DEX_PAIRS.map((pair) => pair.pairAddress),
  };
}

const getTowerDexTokenSnapshot = (
  address: string,
): TowerDexTokenSnapshot | null => {
  const normalizedAddress = normalizeTowerDexAddress(address).toLowerCase();

  for (const pair of TOWER_DEX_PAIRS) {
    if (pair.token0.toLowerCase() === normalizedAddress) {
      return {
        address: pair.token0,
        symbol: pair.token0Symbol,
        decimals: TOKEN_DECIMALS[pair.token0Symbol],
      };
    }

    if (pair.token1.toLowerCase() === normalizedAddress) {
      return {
        address: pair.token1,
        symbol: pair.token1Symbol,
        decimals: TOKEN_DECIMALS[pair.token1Symbol],
      };
    }
  }

  return null;
};

const getTowerDexPair = (
  tokenIn: string,
  tokenOut: string,
): TowerDexPairSnapshot | null => {
  const normalizedTokenIn = normalizeTowerDexAddress(tokenIn).toLowerCase();
  const normalizedTokenOut = normalizeTowerDexAddress(tokenOut).toLowerCase();

  for (const pair of TOWER_DEX_PAIRS) {
    const matchesForward =
      pair.token0.toLowerCase() === normalizedTokenIn &&
      pair.token1.toLowerCase() === normalizedTokenOut;
    const matchesReverse =
      pair.token1.toLowerCase() === normalizedTokenIn &&
      pair.token0.toLowerCase() === normalizedTokenOut;

    if (!matchesForward && !matchesReverse) {
      continue;
    }

    const tokenInSnapshot = getTowerDexTokenSnapshot(tokenIn);
    const tokenOutSnapshot = getTowerDexTokenSnapshot(tokenOut);

    if (!tokenInSnapshot || !tokenOutSnapshot) {
      return null;
    }

    return {
      pairAddress: pair.pairAddress,
      tokenIn: tokenInSnapshot,
      tokenOut: tokenOutSnapshot,
    };
  }

  return null;
};

export function isTowerDexSupportedPair(tokenIn: string, tokenOut: string) {
  try {
    return getTowerDexPair(tokenIn, tokenOut) !== null;
  } catch {
    return false;
  }
}

const scaleAmount = (
  amount: bigint,
  fromDecimals: number,
  toDecimals: number,
) => {
  if (fromDecimals === toDecimals) {
    return amount;
  }

  return fromDecimals < toDecimals
    ? amount * 10n ** BigInt(toDecimals - fromDecimals)
    : amount / 10n ** BigInt(fromDecimals - toDecimals);
};

const toHexQuantity = (value: bigint | number) =>
  `0x${BigInt(value).toString(16)}`;

const calculatePriceImpactBps = (
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
) => {
  if (amountIn <= 0n || amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0;
  }

  const scale = 10n ** 18n;
  const spotPrice = (reserveOut * scale) / reserveIn;
  const executionPrice = (amountOut * scale) / amountIn;

  if (executionPrice >= spotPrice) {
    return 0;
  }

  return Number(((spotPrice - executionPrice) * 10000n) / spotPrice);
};

const getPairReserves = async (
  client: PublicClient,
  pair: TowerDexDirectPair,
  tokenIn: Address,
) => {
  const reserves = (await client.readContract({
    address: pair.pairAddress,
    abi: TOWER_DEX_PAIR_ABI,
    functionName: "getReserves",
  })) as readonly [bigint, bigint, number];
  const [reserve0, reserve1] = reserves;

  if (pair.token0.toLowerCase() === tokenIn.toLowerCase()) {
    return {
      reserveIn: reserve0,
      reserveOut: reserve1,
    };
  }

  return {
    reserveIn: reserve1,
    reserveOut: reserve0,
  };
};

export async function getTowerDexQuote(params: {
  client?: PublicClient;
  inputToken: string;
  outputToken: string;
  inputAmount: string | bigint;
  slippageBps: number;
}): Promise<TowerDexQuote | null> {
  if (!isTowerDexEnabled()) {
    return null;
  }

  const pair = getTowerDexPair(params.inputToken, params.outputToken);
  if (!pair) {
    return null;
  }

  const client = params.client ?? createTowerDexPublicClient();
  const path = [pair.tokenIn.address, pair.tokenOut.address];
  const amountInNative = BigInt(params.inputAmount);

  try {
    const amounts = (await client.readContract({
      address: TOWER_DEX_ROUTER_ADDRESS,
      abi: TOWER_DEX_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountInNative, path],
    })) as readonly bigint[];
    const amountOutNative = amounts[amounts.length - 1];
    const minOutNative =
      (amountOutNative * BigInt(10000 - params.slippageBps)) / 10000n;
    const matchedPair = TOWER_DEX_PAIRS.find(
      (entry) => entry.pairAddress.toLowerCase() === pair.pairAddress.toLowerCase(),
    );

    if (!matchedPair) {
      return null;
    }

    const { reserveIn, reserveOut } = await getPairReserves(
      client,
      matchedPair,
      pair.tokenIn.address,
    );
    const priceImpact = calculatePriceImpactBps(
      amountInNative,
      amountOutNative,
      reserveIn,
      reserveOut,
    );

    return {
      inputToken: pair.tokenIn.address,
      outputToken: pair.tokenOut.address,
      inputAmount: scaleAmount(amountInNative, pair.tokenIn.decimals, 18).toString(),
      outputAmount: scaleAmount(
        amountOutNative,
        pair.tokenOut.decimals,
        18,
      ).toString(),
      minOut: scaleAmount(minOutNative, pair.tokenOut.decimals, 18).toString(),
      inputAmountNative: amountInNative.toString(),
      outputAmountNative: amountOutNative.toString(),
      minOutNative: minOutNative.toString(),
      priceImpact,
      gasEstimate: "300000",
      slippage: params.slippageBps,
      feeMode: "none",
      route: {
        type: "single",
        hops: [
          {
            dexId: TOWER_DEX_ID,
            dex: TOWER_DEX_ID,
            dexName: TOWER_DEX_NAME,
            dexRouter: TOWER_DEX_ROUTER_ADDRESS,
            path,
            amountIn: amountInNative.toString(),
            amountOut: amountOutNative.toString(),
            priceImpact,
            liquidity: reserveOut.toString(),
          },
        ],
      },
    };
  } catch (error) {
    console.warn("[Tower DEX] quote unavailable:", error);
    return null;
  }
}

export function isTowerDexQuote(quote: unknown): quote is TowerDexQuote {
  if (!quote || typeof quote !== "object") {
    return false;
  }

  const route = (quote as TowerDexQuote).route;
  const hop = route?.hops?.[0];
  return normalizeTowerDexId(hop?.dexId || hop?.dexName) === TOWER_DEX_ID;
}

export async function buildTowerDexSwapTransaction(params: {
  quote: TowerDexQuote;
  userAddress: string;
  client?: PublicClient;
}) {
  const client = params.client ?? createTowerDexPublicClient();
  const userAddress = normalizeTowerDexAddress(params.userAddress);
  const tokenIn = normalizeTowerDexAddress(params.quote.inputToken);
  const tokenOut = normalizeTowerDexAddress(params.quote.outputToken);
  const path = [tokenIn, tokenOut];
  const amountInNative = BigInt(params.quote.inputAmountNative);
  const minOutNative = BigInt(params.quote.minOutNative);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  const allowance = (await client.readContract({
    address: tokenIn,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [userAddress, TOWER_DEX_ROUTER_ADDRESS],
  })) as bigint;

  const approval =
    allowance >= amountInNative
      ? null
      : {
          to: tokenIn,
          data: encodeFunctionData({
            abi: ERC20_APPROVE_ABI,
            functionName: "approve",
            args: [TOWER_DEX_ROUTER_ADDRESS, maxUint256],
          }),
          from: userAddress,
          gasLimit: toHexQuantity(100000),
        };

  const swap: TowerDexTransaction = {
    to: TOWER_DEX_ROUTER_ADDRESS,
    data: encodeFunctionData({
      abi: TOWER_DEX_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [amountInNative, minOutNative, path, userAddress, deadline],
    }),
    value: "0x0",
    gasLimit: toHexQuantity(350000),
    chainId: TOWER_DEX_CHAIN_ID,
  };

  return {
    approval,
    swap,
  };
}

