import { NextRequest, NextResponse } from "next/server";
import {
  buildSynthraApprovalTransaction,
  buildSynthraExactInputTransaction,
  createSynthraPublicClient,
  ERC20_APPROVE_ABI,
  SYNTHRA_ADDRESSES,
  type SynthraQuote,
} from "@/lib/synthraDex";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const GENERIC_SWAP_SELECTOR = "0x9908fc8b";

type SwapQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  minOut: string;
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

const isSynthraQuote = (quote?: SwapQuote) => {
  const hop = quote?.route?.hops?.[0];

  return (
    hop?.dexId === "synthra" ||
    hop?.dex === "synthra" ||
    hop?.dexName?.toLowerCase().includes("synthra") ||
    hop?.dexRouter?.toLowerCase() === SYNTHRA_ADDRESSES.universalRouter.toLowerCase()
  );
};

const getTokenDecimalsByAddress = (tokenAddress: string) => {
  const tokenSymbol = Object.entries(TOKEN_CONTRACTS).find(
    ([, address]) => address.toLowerCase() === tokenAddress.toLowerCase(),
  )?.[0];

  return tokenSymbol ? TOKEN_DECIMALS[tokenSymbol] ?? 18 : 18;
};

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
    amountOut: toNativeAmount(quote.outputAmount, quote.outputToken),
    route: {
      tokens: hop.path as `0x${string}`[],
      fees: [],
      path: quote.route.rawPath || "0x",
    },
  };
};

const buildSynthraFallback = async (quote: SwapQuote, userAddress: string) => {
  const synthraTxQuote = buildSynthraQuoteForTx(quote);

  if (synthraTxQuote.route.path === "0x") {
    throw new Error("Synthra quote is missing encoded route path");
  }

  const currentAllowance = await createSynthraPublicClient().readContract({
    address: quote.inputToken as `0x${string}`,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [userAddress as `0x${string}`, SYNTHRA_ADDRESSES.universalRouter],
  });
  const approval =
    currentAllowance < synthraTxQuote.amountIn
      ? {
          ...buildSynthraApprovalTransaction({
            tokenAddress: quote.inputToken,
            amount: synthraTxQuote.amountIn,
          }),
          from: userAddress,
          gasLimit: "0x186a0",
        }
      : null;

  return {
    approval,
    swap: {
      ...buildSynthraExactInputTransaction({
        quote: synthraTxQuote,
        recipient: userAddress,
        slippageBps: 50,
        payerIsUser: true,
        wrapNativeInput: false,
      }),
      from: userAddress,
      gasLimit: "0x7a120",
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quote, userAddress } = body as {
      quote?: SwapQuote;
      userAddress?: string;
    };
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
    const returnedSwap = data?.data?.swap;
    const returnedBadSynthraCalldata =
      response.ok &&
      isSynthraQuote(quote) &&
      returnedSwap?.to?.toLowerCase() === SYNTHRA_ADDRESSES.universalRouter.toLowerCase() &&
      returnedSwap?.data?.toLowerCase().startsWith(GENERIC_SWAP_SELECTOR);

    if (returnedBadSynthraCalldata && quote && userAddress) {
      console.warn(
        "[swap/build-tx] Backend returned generic swap calldata for Synthra; rebuilding Universal Router execute calldata locally.",
      );

      return NextResponse.json({
        success: true,
        data: await buildSynthraFallback(quote, userAddress),
      });
    }

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
