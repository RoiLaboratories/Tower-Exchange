import {
  createPublicClient,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  isAddress,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { TOKEN_CONTRACTS } from "@/lib/arcNetwork";

export const SYNTHRA_CHAIN_ID = 5042002;
export const SYNTHRA_PUBLIC_RPC_URL = "https://rpc.testnet.arc.network";
export const SYNTHRA_PROXY_RPC_PATH = "/api/rpc/5042002";

export const synthraArcTestnet = {
  id: SYNTHRA_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Arc",
    symbol: "ARC",
  },
  rpcUrls: {
    default: { http: [SYNTHRA_PUBLIC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.network" },
  },
  testnet: true,
} as const;

export const SYNTHRA_ADDRESSES = {
  factory: "0x0fB6EEDA6e90E90797083861A75D15752a27f59c",
  quoterV2: "0x3Ce954107b1A675826B33bF23060Dd655e3758fE",
  swapRouter02: "0xA545bCB1Bd7985c59ea162aB1748A0803434C31b",
  universalRouter: "0xbf4479c07dc6fdc6daa764a0cca06969e894275f",
  multicall2: "0xe139b61c9B8Eebf32bb335cb11AA6B7Cd69e13f4",
} as const satisfies Record<string, Address>;

export const SYNTHRA_FEE_TIERS = [3000] as const;
export type SynthraFeeTier = (typeof SYNTHRA_FEE_TIERS)[number];

export const SYNTHRA_INTERMEDIATE_TOKENS: Address[] = [];

export const SYNTHRA_FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

export const SYNTHRA_QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export const SYNTHRA_UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "synthraV3SwapCallback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount0Delta", type: "int256" },
      { name: "amount1Delta", type: "int256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const ERC20_APPROVE_ABI = [
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

const MULTICALL2_ABI = [
  {
    type: "function",
    name: "aggregate",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" },
    ],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const SYNTHRA_USDC_EURC_FEE: SynthraFeeTier = 3000;
const SYNTHRA_UNIVERSAL_ROUTER_COMMANDS = {
  V3_SWAP_EXACT_IN: "0x00",
  WRAP_NATIVE: "0x0b",
} as const;

export interface SynthraPool {
  token0: Address;
  token1: Address;
  fee: SynthraFeeTier;
  pool: Address;
}

export interface SynthraRoute {
  tokens: Address[];
  fees: SynthraFeeTier[];
  path: Hex;
}

export interface SynthraQuote {
  dexId: "synthra";
  dexName: "Synthra";
  chainId: typeof SYNTHRA_CHAIN_ID;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  route: SynthraRoute;
  gasEstimate?: bigint;
}

export interface SynthraTransaction {
  to: Address;
  data: Hex;
  value: Hex;
  chainId: typeof SYNTHRA_CHAIN_ID;
}

const getDefaultSynthraRpcUrl = () =>
  typeof window === "undefined" ? SYNTHRA_PUBLIC_RPC_URL : SYNTHRA_PROXY_RPC_PATH;

export function createSynthraPublicClient(rpcUrl = getDefaultSynthraRpcUrl()) {
  return createPublicClient({
    chain: {
      ...synthraArcTestnet,
      rpcUrls: {
        default: { http: [rpcUrl] },
      },
    },
    transport: http(rpcUrl),
  });
}

export function normalizeSynthraAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }

  return getAddress(address);
}

export function sortSynthraTokens(tokenA: string, tokenB: string): [Address, Address] {
  const a = normalizeSynthraAddress(tokenA);
  const b = normalizeSynthraAddress(tokenB);

  if (a.toLowerCase() === b.toLowerCase()) {
    throw new Error("Synthra pool discovery requires two different tokens");
  }

  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

export function encodeSynthraV3Path(tokens: string[], fees: readonly number[]): Hex {
  if (tokens.length < 2) {
    throw new Error("A Synthra path needs at least two tokens");
  }

  if (fees.length !== tokens.length - 1) {
    throw new Error("Synthra path fee count must be token count minus one");
  }

  const packedTypes = tokens.flatMap((_, index) =>
    index < fees.length ? (["address", "uint24"] as const) : (["address"] as const),
  );
  const packedValues = tokens.flatMap((token, index) =>
    index < fees.length
      ? ([normalizeSynthraAddress(token), fees[index]] as const)
      : ([normalizeSynthraAddress(token)] as const),
  );

  return encodePacked(packedTypes, packedValues);
}

export async function discoverSynthraPools(
  client: PublicClient,
  tokenA: string,
  tokenB: string,
  feeTiers: readonly SynthraFeeTier[] = SYNTHRA_FEE_TIERS,
): Promise<SynthraPool[]> {
  const [token0, token1] = sortSynthraTokens(tokenA, tokenB);
  const calls = feeTiers.map((fee) => ({
    target: SYNTHRA_ADDRESSES.factory,
    callData: encodeFunctionData({
      abi: SYNTHRA_FACTORY_ABI,
      functionName: "getPool",
      args: [token0, token1, fee],
    }),
  }));

  const multicallResult = (await client.readContract({
    address: SYNTHRA_ADDRESSES.multicall2,
    abi: MULTICALL2_ABI,
    functionName: "aggregate",
    args: [calls],
  })) as readonly [bigint, readonly Hex[]];
  const [, returnData] = multicallResult;

  return returnData.flatMap((data, index) => {
    const pool = decodeFunctionResult({
      abi: SYNTHRA_FACTORY_ABI,
      functionName: "getPool",
      data,
    }) as Address;

    if (pool.toLowerCase() === ZERO_ADDRESS) {
      return [];
    }

    return [
      {
        token0,
        token1,
        fee: feeTiers[index],
        pool,
      },
    ];
  });
}

export async function buildSynthraRouteCandidates(
  client: PublicClient,
  tokenIn: string,
  tokenOut: string,
  options: {
    feeTiers?: readonly SynthraFeeTier[];
    intermediateTokens?: readonly string[];
  } = {},
): Promise<SynthraRoute[]> {
  const normalizedTokenIn = normalizeSynthraAddress(tokenIn);
  const normalizedTokenOut = normalizeSynthraAddress(tokenOut);
  const usdc = normalizeSynthraAddress(TOKEN_CONTRACTS.USDC);
  const eurc = normalizeSynthraAddress(TOKEN_CONTRACTS.EURC);
  const isSupportedPair =
    (normalizedTokenIn.toLowerCase() === usdc.toLowerCase() &&
      normalizedTokenOut.toLowerCase() === eurc.toLowerCase()) ||
    (normalizedTokenIn.toLowerCase() === eurc.toLowerCase() &&
      normalizedTokenOut.toLowerCase() === usdc.toLowerCase());

  if (!isSupportedPair) {
    return [];
  }

  const feeTiers = options.feeTiers ?? SYNTHRA_FEE_TIERS;
  const intermediateTokens = options.intermediateTokens ?? SYNTHRA_INTERMEDIATE_TOKENS;
  const routes: SynthraRoute[] = [
    {
      tokens: [normalizedTokenIn, normalizedTokenOut],
      fees: [SYNTHRA_USDC_EURC_FEE],
      path: encodeSynthraV3Path(
        [normalizedTokenIn, normalizedTokenOut],
        [SYNTHRA_USDC_EURC_FEE],
      ),
    },
  ];

  if (!feeTiers.includes(SYNTHRA_USDC_EURC_FEE)) {
    return routes;
  }

  for (const intermediateToken of intermediateTokens) {
    const tokenMid = normalizeSynthraAddress(intermediateToken);
    const isDuplicate =
      tokenMid.toLowerCase() === normalizedTokenIn.toLowerCase() ||
      tokenMid.toLowerCase() === normalizedTokenOut.toLowerCase();

    if (isDuplicate) {
      continue;
    }

    const [firstLegPools, secondLegPools] = await Promise.all([
      discoverSynthraPools(client, normalizedTokenIn, tokenMid, feeTiers),
      discoverSynthraPools(client, tokenMid, normalizedTokenOut, feeTiers),
    ]);

    for (const firstLeg of firstLegPools) {
      for (const secondLeg of secondLegPools) {
        const fees = [firstLeg.fee, secondLeg.fee] as SynthraFeeTier[];
        const tokens = [normalizedTokenIn, tokenMid, normalizedTokenOut];

        routes.push({
          tokens,
          fees,
          path: encodeSynthraV3Path(tokens, fees),
        });
      }
    }
  }

  return routes;
}

export async function quoteSynthraRoute(
  client: PublicClient,
  route: SynthraRoute,
  amountIn: bigint | string,
): Promise<SynthraQuote | null> {
  try {
    const result = (await client.readContract({
      address: SYNTHRA_ADDRESSES.quoterV2,
      abi: SYNTHRA_QUOTER_V2_ABI,
      functionName: "quoteExactInput",
      args: [route.path, BigInt(amountIn)],
    })) as readonly [bigint, readonly bigint[], readonly number[], bigint];

    const [amountOut, , , gasEstimate] = result;

    return {
      dexId: "synthra",
      dexName: "Synthra",
      chainId: SYNTHRA_CHAIN_ID,
      tokenIn: route.tokens[0],
      tokenOut: route.tokens[route.tokens.length - 1],
      amountIn: BigInt(amountIn),
      amountOut,
      route,
      gasEstimate,
    };
  } catch {
    return null;
  }
}

export async function getBestSynthraQuote(
  client: PublicClient,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint | string,
  options: {
    feeTiers?: readonly SynthraFeeTier[];
    intermediateTokens?: readonly string[];
  } = {},
): Promise<SynthraQuote | null> {
  const routes = await buildSynthraRouteCandidates(client, tokenIn, tokenOut, options);
  const quoteResults = await Promise.all(
    routes.map((route) => quoteSynthraRoute(client, route, amountIn)),
  );
  const validQuotes = quoteResults.filter((quote): quote is SynthraQuote => quote !== null);

  return validQuotes.reduce<SynthraQuote | null>((bestQuote, quote) => {
    if (!bestQuote || quote.amountOut > bestQuote.amountOut) {
      return quote;
    }

    return bestQuote;
  }, null);
}

export function calculateSynthraAmountOutMinimum(
  amountOut: bigint | string,
  slippageBps: number,
): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000) {
    throw new Error("Slippage must be an integer between 0 and 9999 basis points");
  }

  return (BigInt(amountOut) * BigInt(10000 - slippageBps)) / 10000n;
}

export function buildSynthraExactInputTransaction(params: {
  quote: SynthraQuote;
  recipient: string;
  slippageBps: number;
  deadline?: bigint | number;
  payerIsUser?: boolean;
  wrapNativeInput?: boolean;
}): SynthraTransaction {
  const recipient = normalizeSynthraAddress(params.recipient);
  const deadline =
    params.deadline == null
      ? BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
      : BigInt(params.deadline);
  const amountOutMinimum = calculateSynthraAmountOutMinimum(
    params.quote.amountOut,
    params.slippageBps,
  );
  const commands = params.wrapNativeInput
    ? (`${SYNTHRA_UNIVERSAL_ROUTER_COMMANDS.WRAP_NATIVE}${SYNTHRA_UNIVERSAL_ROUTER_COMMANDS.V3_SWAP_EXACT_IN.slice(2)}` as Hex)
    : SYNTHRA_UNIVERSAL_ROUTER_COMMANDS.V3_SWAP_EXACT_IN;
  const inputs = [
    ...(params.wrapNativeInput
      ? [
          encodeAbiParameters(
            [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            [SYNTHRA_ADDRESSES.universalRouter, params.quote.amountIn],
          ),
        ]
      : []),
    encodeAbiParameters(
      [
        { name: "recipient", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
        { name: "path", type: "bytes" },
        { name: "payerIsUser", type: "bool" },
      ],
      [
        recipient,
        params.quote.amountIn,
        amountOutMinimum,
        params.quote.route.path,
        params.payerIsUser ?? !params.wrapNativeInput,
      ],
    ),
  ];

  return {
    to: SYNTHRA_ADDRESSES.universalRouter,
    data: encodeFunctionData({
      abi: SYNTHRA_UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [commands, inputs, deadline],
    }),
    value: params.wrapNativeInput ? `0x${params.quote.amountIn.toString(16)}` : "0x0",
    chainId: SYNTHRA_CHAIN_ID,
  };
}

export function buildSynthraApprovalTransaction(params: {
  tokenAddress: string;
  amount?: bigint | string;
}): SynthraTransaction {
  return {
    to: normalizeSynthraAddress(params.tokenAddress),
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [SYNTHRA_ADDRESSES.universalRouter, params.amount == null ? maxUint256 : BigInt(params.amount)],
    }),
    value: "0x0",
    chainId: SYNTHRA_CHAIN_ID,
  };
}

export function getSynthraDexInfo() {
  return {
    id: "synthra",
    name: "Synthra",
    routerAddress: SYNTHRA_ADDRESSES.universalRouter,
    factoryAddress: SYNTHRA_ADDRESSES.factory,
    quoterAddress: SYNTHRA_ADDRESSES.quoterV2,
    universalRouterAddress: SYNTHRA_ADDRESSES.universalRouter,
    multicallAddress: SYNTHRA_ADDRESSES.multicall2,
    type: "v3" as const,
    chainId: SYNTHRA_CHAIN_ID,
    enabled: true,
    supportedTokens: [TOKEN_CONTRACTS.USDC, TOKEN_CONTRACTS.EURC],
    feeTiers: SYNTHRA_FEE_TIERS,
  };
}
