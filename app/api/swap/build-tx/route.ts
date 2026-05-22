import { NextRequest, NextResponse } from "next/server";
import {
  buildSynthraApprovalTransaction,
  buildSynthraExactInputTransaction,
  buildSynthraPermit2ApproveTransaction,
  createSynthraPublicClient,
  ERC20_APPROVE_ABI,
  SYNTHRA_ADDRESSES,
  type SynthraQuote,
} from "@/lib/synthraDex";
import {
  buildUnitFlowApprovalTransaction,
  buildUnitFlowExactInputTransaction,
  buildUnitFlowPermit2ApproveTransaction,
  createUnitFlowPublicClient,
  encodeUnitFlowV3Path,
  isUnitFlowNativeUsdc,
  toUnitFlowPoolToken,
  UNITFLOW_ADDRESSES,
  type UnitFlowQuote,
} from "@/lib/unitflowDex";
import { resolveSwapBackendUrl } from "@/lib/resolveSwapBackendUrl";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";

const BACKEND_URL = resolveSwapBackendUrl();
const FEE_COLLECTOR_ADDRESS = "0xE71e5baDb9528647F0dd42298bC543D493FC9E40";
const PLATFORM_FEE_BPS = 25n;
const BPS_DENOMINATOR = 10000n;

type SwapQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  minOut: string;
  slippageTolerance?: number;
  route: {
    type: "single" | "multi" | "split";
    rawPath?: `0x${string}`;
    hops: Array<{
      dexId?: string;
      dex?: string;
      dexName?: string;
      dexRouter?: string;
      path: string[];
    }>;
  };
};

const normalizeDexId = (dexId?: string) => {
  const normalized = String(dexId || "").toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "synthra-v3" || normalized.includes("synthra")) {
    return "synthra";
  }

  if (normalized === "unitflow-v3" || normalized.includes("unitflow")) {
    return "unitflow";
  }

  return normalized;
};

const ERC20_ALLOWANCE_ABI = [
  ...ERC20_APPROVE_ABI,
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

const PERMIT2_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

const isSynthraQuote = (quote?: SwapQuote) => {
  const hop = quote?.route?.hops?.[0];
  const dexId = normalizeDexId(hop?.dexId || hop?.dex || hop?.dexName);

  return (
    dexId === "synthra" ||
    hop?.dexRouter?.toLowerCase() === SYNTHRA_ADDRESSES.universalRouter.toLowerCase()
  );
};

const isUnitFlowQuote = (quote?: SwapQuote) => {
  const hop = quote?.route?.hops?.[0];
  const dexId = normalizeDexId(hop?.dexId || hop?.dex || hop?.dexName);

  return (
    dexId === "unitflow" ||
    hop?.dexRouter?.toLowerCase() === UNITFLOW_ADDRESSES.universalRouter.toLowerCase()
  );
};

const getTokenDecimalsByAddress = (tokenAddress: string) => {
  const tokenSymbol = Object.entries(TOKEN_CONTRACTS).find(
    ([, address]) => address.toLowerCase() === tokenAddress.toLowerCase(),
  )?.[0];

  return tokenSymbol ? TOKEN_DECIMALS[tokenSymbol] ?? 18 : 18;
};

const isEurcToUsdcSwap = (inputToken?: string, outputToken?: string) =>
  Boolean(
    inputToken &&
      outputToken &&
      inputToken.toLowerCase() === TOKEN_CONTRACTS.EURC.toLowerCase() &&
      outputToken.toLowerCase() === TOKEN_CONTRACTS.USDC.toLowerCase(),
  );

const toNativeAmount = (amount: string, tokenAddress: string) => {
  const decimals = getTokenDecimalsByAddress(tokenAddress);
  const amountBn = BigInt(amount);

  if (decimals === 18) {
    return amountBn;
  }

  return decimals < 18
    ? amountBn / 10n ** BigInt(18 - decimals)
    : amountBn * 10n ** BigInt(decimals - 18);
};

const buildSynthraQuoteForTx = (quote: SwapQuote): SynthraQuote => {
  const hop = quote.route.hops[0];

  return {
    dexId: "synthra",
    dexName: "Synthra",
    chainId: 5042002,
    tokenIn: quote.inputToken as `0x${string}`,
    tokenOut: quote.outputToken as `0x${string}`,
    amountIn: toNativeAmount(quote.inputAmount, quote.inputToken),
    amountOut: toNativeAmount(quote.minOut || quote.outputAmount, quote.outputToken),
    route: {
      tokens: hop.path as `0x${string}`[],
      fees: [],
      path: quote.route.rawPath || "0x",
    },
  };
};

const buildUnitFlowQuoteForTx = (quote: SwapQuote): UnitFlowQuote => {
  const hop = quote.route.hops[0];
  const routeTokens =
    hop.path.length >= 2
      ? (hop.path as `0x${string}`[])
      : ([
          toUnitFlowPoolToken(quote.inputToken),
          toUnitFlowPoolToken(quote.outputToken),
        ] as `0x${string}`[]);
  const routeFees = Array.from(
    { length: routeTokens.length - 1 },
    () => 3000 as const,
  );
  const routeInputToken = routeTokens[0];
  const routeOutputToken = routeTokens[routeTokens.length - 1];

  return {
    dexId: "unitflow",
    dexName: "UnitFlow",
    chainId: 5042002,
    tokenIn: quote.inputToken as `0x${string}`,
    tokenOut: quote.outputToken as `0x${string}`,
    amountIn: toNativeAmount(quote.inputAmount, routeInputToken),
    amountOut: toNativeAmount(
      quote.minOut || quote.outputAmount,
      routeOutputToken,
    ),
    route: {
      tokens: routeTokens,
      fees: routeFees,
      path: quote.route.rawPath || encodeUnitFlowV3Path(routeTokens, routeFees),
    },
  };
};

const buildSynthraFallback = async (quote: SwapQuote, userAddress: string) => {
  const synthraTxQuote = buildSynthraQuoteForTx(quote);
  const spender = SYNTHRA_ADDRESSES.universalRouter;
  const expectedFeeCollectorOutput = synthraTxQuote.amountOut;
  const platformFeeAmount =
    (expectedFeeCollectorOutput * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const expectedUserOutput = expectedFeeCollectorOutput - platformFeeAmount;

  if (synthraTxQuote.route.path === "0x") {
    throw new Error("Synthra quote is missing encoded route path");
  }

  const publicClient = createSynthraPublicClient();
  const currentPermit2TokenAllowance = await publicClient.readContract({
    address: quote.inputToken as `0x${string}`,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [userAddress as `0x${string}`, SYNTHRA_ADDRESSES.permit2],
  });
  const permit2Allowance = (await publicClient.readContract({
    address: SYNTHRA_ADDRESSES.permit2,
    abi: PERMIT2_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [
      userAddress as `0x${string}`,
      quote.inputToken as `0x${string}`,
      SYNTHRA_ADDRESSES.universalRouter,
    ],
  })) as readonly [bigint, number, number];
  const [permit2Amount, permit2Expiration] = permit2Allowance;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const approvals = [
    ...(currentPermit2TokenAllowance < synthraTxQuote.amountIn
      ? [
        {
          ...buildSynthraApprovalTransaction({
            tokenAddress: quote.inputToken,
            spender: SYNTHRA_ADDRESSES.permit2,
          }),
          from: userAddress,
          gasLimit: "0x186a0",
        },
      ]
      : []),
    ...(permit2Amount < synthraTxQuote.amountIn || permit2Expiration <= nowSeconds
      ? [
        {
          ...buildSynthraPermit2ApproveTransaction({
            tokenAddress: quote.inputToken,
            spender,
          }),
          from: userAddress,
          gasLimit: "0x186a0",
        },
      ]
      : []),
  ];

  return {
    approval: approvals.length === 0 ? null : approvals,
    swap: {
      ...buildSynthraExactInputTransaction({
        quote: synthraTxQuote,
        recipient: FEE_COLLECTOR_ADDRESS,
        slippageBps: 0,
        payerIsUser: true,
        wrapNativeInput: false,
      }),
      from: userAddress,
      gasLimit: "0x7a120",
      expectedFeeCollectorOutput: expectedFeeCollectorOutput.toString(),
      platformFeeAmount: platformFeeAmount.toString(),
      expectedUserOutput: expectedUserOutput.toString(),
      feeRecipient: FEE_COLLECTOR_ADDRESS,
      feeBps: Number(PLATFORM_FEE_BPS),
    },
  };
};

const buildUnitFlowFallback = async (quote: SwapQuote, userAddress: string) => {
  const unitflowTxQuote = buildUnitFlowQuoteForTx(quote);
  const routeInputToken = unitflowTxQuote.route.tokens[0];
  const wrapNativeInput = isUnitFlowNativeUsdc(quote.inputToken);
  const unwrapNativeOutput = isUnitFlowNativeUsdc(quote.outputToken);
  const recipient = FEE_COLLECTOR_ADDRESS;
  const spender = UNITFLOW_ADDRESSES.universalRouter;
  const expectedFeeCollectorOutput = unitflowTxQuote.amountOut;
  const platformFeeAmount =
    (expectedFeeCollectorOutput * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const expectedUserOutput = expectedFeeCollectorOutput - platformFeeAmount;
  const publicClient = createUnitFlowPublicClient();
  const approvals = [];

  if (!wrapNativeInput) {
    const currentPermit2TokenAllowance = await publicClient.readContract({
      address: routeInputToken,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: "allowance",
      args: [userAddress as `0x${string}`, UNITFLOW_ADDRESSES.permit2],
    });
    const permit2Allowance = (await publicClient.readContract({
      address: UNITFLOW_ADDRESSES.permit2,
      abi: PERMIT2_ALLOWANCE_ABI,
      functionName: "allowance",
      args: [userAddress as `0x${string}`, routeInputToken, spender],
    })) as readonly [bigint, number, number];
    const [permit2Amount, permit2Expiration] = permit2Allowance;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (currentPermit2TokenAllowance < unitflowTxQuote.amountIn) {
      approvals.push({
        ...buildUnitFlowApprovalTransaction({
          tokenAddress: routeInputToken,
          spender: UNITFLOW_ADDRESSES.permit2,
        }),
        from: userAddress,
        gasLimit: "0x186a0",
      });
    }

    if (
      permit2Amount < unitflowTxQuote.amountIn ||
      permit2Expiration <= nowSeconds
    ) {
      approvals.push({
        ...buildUnitFlowPermit2ApproveTransaction({
          tokenAddress: routeInputToken,
          spender,
        }),
        from: userAddress,
        gasLimit: "0x186a0",
      });
    }
  }

  return {
    approval: approvals.length === 0 ? null : approvals,
    swap: {
      ...buildUnitFlowExactInputTransaction({
        quote: unitflowTxQuote,
        recipient,
        slippageBps: 0,
        payerIsUser: !wrapNativeInput,
        wrapNativeInput,
        unwrapNativeOutput,
      }),
      from: userAddress,
      gasLimit: "0x7a120",
      expectedFeeCollectorOutput: expectedFeeCollectorOutput.toString(),
      platformFeeAmount: platformFeeAmount.toString(),
      expectedUserOutput: expectedUserOutput.toString(),
      feeRecipient: FEE_COLLECTOR_ADDRESS,
      feeBps: Number(PLATFORM_FEE_BPS),
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quote, userAddress, executionMode } = body as {
      quote?: SwapQuote;
      userAddress?: string;
      executionMode?: string;
    };
    const isRecurringOrderExecution =
      executionMode === "recurring_order_executor";

    if (
      isRecurringOrderExecution &&
      quote &&
      (isSynthraQuote(quote) || isUnitFlowQuote(quote))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Recurring order executor only supports XyloNet adapter routes.",
        },
        { status: 400 },
      );
    }

    if (quote && userAddress && isSynthraQuote(quote)) {
      return NextResponse.json({
        success: true,
        data: await buildSynthraFallback(quote, userAddress),
      });
    }

    if (quote && userAddress && isUnitFlowQuote(quote)) {
      if (isEurcToUsdcSwap(quote.inputToken, quote.outputToken)) {
        return NextResponse.json(
          {
            success: false,
            error: "UnitFlow is unavailable for EURC to USDC swaps",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        data: await buildUnitFlowFallback(quote, userAddress),
      });
    }

    const response = await fetch(`${BACKEND_URL}/api/swap/build-tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { success: false, error: await response.text() };

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[swap/build-tx] Backend build failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to build swap transaction",
      },
      { status: 500 },
    );
  }
}
