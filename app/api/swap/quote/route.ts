import { NextRequest, NextResponse } from "next/server";
import {
  createSynthraPublicClient,
  getBestSynthraQuote,
  SYNTHRA_ADDRESSES,
  type SynthraQuote,
} from "@/lib/synthraDex";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";

type BackendQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  minOut: string;
  priceImpact: string | number;
  route: {
    type: "single" | "multi" | "split";
    rawPath?: string;
    hops: Array<{
      dexId: string;
      dex?: string;
      dexName?: string;
      dexRouter?: string;
      path: string[];
      amountIn: string;
      amountOut: string;
      priceImpact: string | number;
    }>;
  };
  routeOptions?: RouteOption[];
};

type RouteOption = {
  dexId: string;
  dexName: string;
  outputAmount: string;
  routeType: "single" | "multi" | "split";
  gasEstimate?: string;
  quote: BackendQuote;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const normalizeDexId = (dexId?: string) => (dexId === "synthra-v3" ? "synthra" : dexId);

const getTokenDecimalsByAddress = (tokenAddress: string) => {
  const tokenSymbol = Object.entries(TOKEN_CONTRACTS).find(
    ([, address]) => address.toLowerCase() === tokenAddress.toLowerCase(),
  )?.[0];

  return tokenSymbol ? TOKEN_DECIMALS[tokenSymbol] ?? 18 : 18;
};

const normalizeAmountTo18 = (amount: bigint, tokenAddress: string) => {
  const decimals = getTokenDecimalsByAddress(tokenAddress);

  if (decimals === 18) {
    return amount;
  }

  return decimals < 18
    ? amount * 10n ** BigInt(18 - decimals)
    : amount / 10n ** BigInt(decimals - 18);
};

const toMinOut = (amountOut: bigint, slippageTolerance: number) => {
  const slippageBps = Number.isFinite(slippageTolerance) ? Math.max(0, slippageTolerance) : 50;
  return ((amountOut * BigInt(10000 - slippageBps)) / 10000n).toString();
};

const synthraToSwapQuote = (
  quote: SynthraQuote,
  slippageTolerance: number,
): BackendQuote => {
  const normalizedAmountIn = normalizeAmountTo18(quote.amountIn, quote.tokenIn);
  const normalizedAmountOut = normalizeAmountTo18(quote.amountOut, quote.tokenOut);

  return {
    inputToken: quote.tokenIn,
    outputToken: quote.tokenOut,
    inputAmount: normalizedAmountIn.toString(),
    outputAmount: normalizedAmountOut.toString(),
    minOut: toMinOut(normalizedAmountOut, slippageTolerance),
    priceImpact: "0",
    route: {
      type: quote.route.tokens.length > 2 ? "multi" : "single",
      rawPath: quote.route.path,
      hops: [
        {
          dexId: "synthra",
          dex: "synthra",
          dexName: "Synthra",
          dexRouter: SYNTHRA_ADDRESSES.universalRouter,
          path: quote.route.tokens,
          amountIn: normalizedAmountIn.toString(),
          amountOut: normalizedAmountOut.toString(),
          priceImpact: "0",
        },
      ],
    },
  };
};

const routeOptionFromQuote = (quote: BackendQuote): RouteOption => {
  const hop = quote.route?.hops?.[0];
  const dexId = hop?.dexId || hop?.dex || "unknown";
  const normalizedDexId = normalizeDexId(dexId) || "unknown";

  return {
    dexId: normalizedDexId,
    dexName:
      normalizedDexId === "synthra"
        ? "Synthra"
        : hop?.dexName || hop?.dexId || "Unknown Router",
    outputAmount: quote.outputAmount,
    routeType: quote.route?.type || "single",
    quote,
  };
};

async function fetchBackendQuote(body: Record<string, unknown>) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/swap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const responseData = await response.json();
    return (responseData.data || responseData) as BackendQuote;
  } catch (error) {
    console.warn("[swap/quote] Backend quote unavailable:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      inputToken,
      outputToken,
      inputAmount,
      slippageTolerance = 50,
      dexId,
    } = body as {
      inputToken?: string;
      outputToken?: string;
      inputAmount?: string;
      slippageTolerance?: number;
      dexId?: string;
    };
    const normalizedRequestedDexId = normalizeDexId(dexId);

    if (!inputToken || !outputToken || !inputAmount) {
      return NextResponse.json(
        { success: false, error: "Missing inputToken, outputToken, or inputAmount" },
        { status: 400 },
      );
    }

    const backendQuote = await fetchBackendQuote({
      inputToken,
      outputToken,
      inputAmount,
      slippageTolerance,
      dexId: normalizedRequestedDexId,
    });
    const backendQuoteDexId = backendQuote ? routeOptionFromQuote(backendQuote).dexId : null;
    const shouldFetchLocalSynthraQuote =
      normalizedRequestedDexId !== "xylonet-adapter" && backendQuoteDexId !== "synthra";
    const synthraQuote = shouldFetchLocalSynthraQuote
      ? await getBestSynthraQuote(
          createSynthraPublicClient(),
          inputToken,
          outputToken,
          inputAmount,
        ).catch((error) => {
          console.warn("[swap/quote] Synthra quote unavailable:", error);
          return null;
        })
      : null;

    const candidateQuotes = [
      backendQuote,
      synthraQuote ? synthraToSwapQuote(synthraQuote, slippageTolerance) : null,
    ].filter((quote): quote is BackendQuote => quote !== null);

    if (candidateQuotes.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid route found" },
        { status: 404 },
      );
    }

    const routeOptions = Array.from(
      candidateQuotes.reduce((optionsByDexId, quote) => {
        const option = routeOptionFromQuote(quote);
        const existingOption = optionsByDexId.get(option.dexId);

        if (
          !existingOption ||
          BigInt(option.outputAmount || "0") > BigInt(existingOption.outputAmount || "0")
        ) {
          optionsByDexId.set(option.dexId, option);
        }

        return optionsByDexId;
      }, new Map<string, RouteOption>()).values(),
    );
    const requestedQuote = normalizedRequestedDexId
      ? candidateQuotes.find((quote) => routeOptionFromQuote(quote).dexId === normalizedRequestedDexId)
      : null;
    if (normalizedRequestedDexId && !requestedQuote) {
      return NextResponse.json(
        {
          success: false,
          error: `No valid ${normalizedRequestedDexId} route found for this swap`,
          data: { routeOptions },
        },
        { status: 404 },
      );
    }

    const bestQuote =
      requestedQuote ||
      candidateQuotes.reduce((best, quote) =>
        BigInt(quote.outputAmount || "0") > BigInt(best.outputAmount || "0") ? quote : best,
      );

    return NextResponse.json({
      success: true,
      data: {
        ...bestQuote,
        routeOptions,
      },
    });
  } catch (error) {
    console.error("[swap/quote] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get quote",
      },
      { status: 500 },
    );
  }
}
