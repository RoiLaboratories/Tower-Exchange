import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  isAddress,
  maxUint256,
  type Address,
  type Hex,
} from "viem";

import { TOKEN_CONTRACTS } from "@/lib/arcNetwork";
import {
  ERC20_APPROVE_ABI,
  PERMIT2_APPROVE_ABI,
  SYNTHRA_CHAIN_ID,
} from "@/lib/synthraDex";

export const UNITFLOW_FEE_TIERS = [3000] as const;
export type UnitFlowFeeTier = (typeof UNITFLOW_FEE_TIERS)[number];

export const UNITFLOW_ADDRESSES = {
  factory: "0xAb6A8AAb7d490007634ef59d424b5d89688a1971",
  universalRouter: "0xC43cC6A1E0F6EB48Cd4131522C1C73B13f3Da0F1",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const satisfies Record<string, Address>;

const UNITFLOW_UNIVERSAL_ROUTER_ABI = [
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
] as const;

const UNITFLOW_UNIVERSAL_ROUTER_COMMANDS = {
  V3_SWAP_EXACT_IN: "0x00",
  WRAP_NATIVE: "0x0b",
} as const;

const UNITFLOW_WUSDC_EURC_FEE: UnitFlowFeeTier = 3000;

export interface UnitFlowRoute {
  tokens: Address[];
  fees: UnitFlowFeeTier[];
  path: Hex;
}

export interface UnitFlowQuote {
  dexId: "unitflow";
  dexName: "UnitFlow";
  chainId: typeof SYNTHRA_CHAIN_ID;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  route: UnitFlowRoute;
}

export interface UnitFlowTransaction {
  to: Address;
  data: Hex;
  value: Hex;
  chainId: typeof SYNTHRA_CHAIN_ID;
}

type UnitFlowDirectPairConfig = {
  key: string;
  tokens: readonly [Address, Address];
  fee: UnitFlowFeeTier;
  poolAddress: Address;
};

export function normalizeUnitFlowAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }

  return getAddress(address);
}

export function sortUnitFlowTokens(tokenA: string, tokenB: string): [Address, Address] {
  const a = normalizeUnitFlowAddress(tokenA);
  const b = normalizeUnitFlowAddress(tokenB);

  if (a.toLowerCase() === b.toLowerCase()) {
    throw new Error("UnitFlow route construction requires two different tokens");
  }

  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

const UNITFLOW_DIRECT_PAIRS: readonly UnitFlowDirectPairConfig[] = [
  {
    key: "WUSDC/EURC",
    tokens: sortUnitFlowTokens(TOKEN_CONTRACTS.WUSDC_SYNTHRA, TOKEN_CONTRACTS.EURC),
    fee: UNITFLOW_WUSDC_EURC_FEE,
    poolAddress: normalizeUnitFlowAddress(
      "0x719bFFe6f356Fe842b79650Ea58e893A7061FD57",
    ),
  },
] as const;

const getUnitFlowDirectPair = (tokenA: string, tokenB: string) => {
  const [sortedTokenA, sortedTokenB] = sortUnitFlowTokens(tokenA, tokenB);

  return (
    UNITFLOW_DIRECT_PAIRS.find(
      ({ tokens }) =>
        tokens[0].toLowerCase() === sortedTokenA.toLowerCase() &&
        tokens[1].toLowerCase() === sortedTokenB.toLowerCase(),
    ) ?? null
  );
};

export function isUnitFlowSupportedPair(tokenA: string, tokenB: string) {
  return getUnitFlowDirectPair(tokenA, tokenB) !== null;
}

export function encodeUnitFlowV3Path(tokens: string[], fees: readonly number[]): Hex {
  if (tokens.length < 2) {
    throw new Error("A UnitFlow path needs at least two tokens");
  }

  if (fees.length !== tokens.length - 1) {
    throw new Error("UnitFlow path fee count must be token count minus one");
  }

  const packedTypes = tokens.flatMap((_, index) =>
    index < fees.length ? (["address", "uint24"] as const) : (["address"] as const),
  );
  const packedValues = tokens.flatMap((token, index) =>
    index < fees.length
      ? ([normalizeUnitFlowAddress(token), fees[index]] as const)
      : ([normalizeUnitFlowAddress(token)] as const),
  );

  return encodePacked(packedTypes, packedValues);
}

export function buildUnitFlowRouteFromTokens(
  tokenIn: string,
  tokenOut: string,
): UnitFlowRoute | null {
  const normalizedTokenIn = normalizeUnitFlowAddress(tokenIn);
  const normalizedTokenOut = normalizeUnitFlowAddress(tokenOut);
  const directPair = getUnitFlowDirectPair(normalizedTokenIn, normalizedTokenOut);

  if (!directPair) {
    return null;
  }

  return {
    tokens: [normalizedTokenIn, normalizedTokenOut],
    fees: [directPair.fee],
    path: encodeUnitFlowV3Path(
      [normalizedTokenIn, normalizedTokenOut],
      [directPair.fee],
    ),
  };
}

export function calculateUnitFlowAmountOutMinimum(
  amountOut: bigint | string,
  slippageBps: number,
): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000) {
    throw new Error("Slippage must be an integer between 0 and 9999 basis points");
  }

  return (BigInt(amountOut) * BigInt(10000 - slippageBps)) / 10000n;
}

export function buildUnitFlowExactInputTransaction(params: {
  quote: UnitFlowQuote;
  recipient: string;
  slippageBps: number;
  deadline?: bigint | number;
  payerIsUser?: boolean;
  wrapNativeInput?: boolean;
}): UnitFlowTransaction {
  const recipient = normalizeUnitFlowAddress(params.recipient);
  const deadline =
    params.deadline == null
      ? BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
      : BigInt(params.deadline);
  const amountOutMinimum = calculateUnitFlowAmountOutMinimum(
    params.quote.amountOut,
    params.slippageBps,
  );
  const commands = params.wrapNativeInput
    ? (`${UNITFLOW_UNIVERSAL_ROUTER_COMMANDS.WRAP_NATIVE}${UNITFLOW_UNIVERSAL_ROUTER_COMMANDS.V3_SWAP_EXACT_IN.slice(2)}` as Hex)
    : UNITFLOW_UNIVERSAL_ROUTER_COMMANDS.V3_SWAP_EXACT_IN;
  const inputs = [
    ...(params.wrapNativeInput
      ? [
          encodeAbiParameters(
            [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            [UNITFLOW_ADDRESSES.universalRouter, params.quote.amountIn],
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
    to: UNITFLOW_ADDRESSES.universalRouter,
    data: encodeFunctionData({
      abi: UNITFLOW_UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [commands, inputs, deadline],
    }),
    value: params.wrapNativeInput ? `0x${params.quote.amountIn.toString(16)}` : "0x0",
    chainId: SYNTHRA_CHAIN_ID,
  };
}

export function buildUnitFlowApprovalTransaction(params: {
  tokenAddress: string;
  amount?: bigint | string;
  spender?: string;
}): UnitFlowTransaction {
  return {
    to: normalizeUnitFlowAddress(params.tokenAddress),
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [
        normalizeUnitFlowAddress(params.spender ?? UNITFLOW_ADDRESSES.universalRouter),
        params.amount == null ? maxUint256 : BigInt(params.amount),
      ],
    }),
    value: "0x0",
    chainId: SYNTHRA_CHAIN_ID,
  };
}

export function buildUnitFlowPermit2ApproveTransaction(params: {
  tokenAddress: string;
  spender?: string;
  amount?: bigint | string;
  expiration?: bigint | number;
}): UnitFlowTransaction {
  const maxUint160 = (1n << 160n) - 1n;
  const maxUint48 = 2 ** 48 - 1;

  return {
    to: UNITFLOW_ADDRESSES.permit2,
    data: encodeFunctionData({
      abi: PERMIT2_APPROVE_ABI,
      functionName: "approve",
      args: [
        normalizeUnitFlowAddress(params.tokenAddress),
        normalizeUnitFlowAddress(params.spender ?? UNITFLOW_ADDRESSES.universalRouter),
        params.amount == null ? maxUint160 : BigInt(params.amount),
        params.expiration == null ? maxUint48 : Number(params.expiration),
      ],
    }),
    value: "0x0",
    chainId: SYNTHRA_CHAIN_ID,
  };
}

export function getUnitFlowDexInfo() {
  return {
    id: "unitflow",
    name: "UnitFlow",
    routerAddress: UNITFLOW_ADDRESSES.universalRouter,
    factoryAddress: UNITFLOW_ADDRESSES.factory,
    universalRouterAddress: UNITFLOW_ADDRESSES.universalRouter,
    permit2Address: UNITFLOW_ADDRESSES.permit2,
    type: "v3" as const,
    chainId: SYNTHRA_CHAIN_ID,
    enabled: true,
    supportedTokens: [TOKEN_CONTRACTS.USDC, TOKEN_CONTRACTS.EURC],
    feeTiers: UNITFLOW_FEE_TIERS,
    poolAddresses: UNITFLOW_DIRECT_PAIRS.map((pair) => pair.poolAddress),
  };
}
