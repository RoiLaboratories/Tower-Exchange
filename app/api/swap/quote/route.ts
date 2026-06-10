import { NextRequest, NextResponse } from "next/server";
import { resolveSwapBackendUrl } from "@/lib/resolveSwapBackendUrl";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";

type BackendQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  swapInputAmount?: string; // Net amount after TowerSwapExecutor fee, normalized to 18 decimals
  outputAmount: string;
  minOut: string;
  priceImpact: string | number;
  gasEstimate?: string;
  slippage?: number; // in basis points
  exec_price?: number;
  feeBps?: number;
  feeMode?: 'tower-swap-executor' | 'none';
  platformFeeAmount?: string; // Platform fee in input token, normalized to 18 decimals
  route: {
    type: "single" | "multi" | "split";
    rawPath?: string;
    totalFee?: number; // in basis points
    estimatedOutput?: string;
    hops: Array<{
      dexId: string;
      dex?: string;
      dexName?: string;
      dexRouter?: string;
      path: string[];
      feeTier?: number;
      feeTiers?: number[];
      amountIn: string;
      amountOut: string;
      priceImpact: string | number;
      liquidity?: string; // Liquidity available in the hop
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

const BACKEND_URL = resolveSwapBackendUrl();
const SWAPS_DISABLED = process.env.SWAPS_DISABLED !== "false";
const SWAPS_DISABLED_RESPONSE = {
  error: "Swaps are temporarily disabled",
  details:
    "Tower swaps are paused while the TowerSwapExecutor migration is being verified.",
};
const BACKEND_DEX_IDS = ["synthra", "xylonet-adapter", "unitflow"] as const;
type BackendDexId = (typeof BACKEND_DEX_IDS)[number];
const XYLONET_NATIVE_USDC_DECIMALS = 6;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const UNITFLOW_ADAPTER_ADDRESS =
  process.env.UNITFLOW_ADAPTER_ADDRESS ||
  process.env.TOWER_UNITFLOW_ADAPTER_ADDRESS ||
  process.env.NEXT_PUBLIC_UNITFLOW_ADAPTER_ADDRESS;
const UNITFLOW_EXECUTOR_ENABLED = EVM_ADDRESS_PATTERN.test(
  UNITFLOW_ADAPTER_ADDRESS || "",
);
const CIRBTC_ADDRESS = TOKEN_CONTRACTS.CIRBTC.toLowerCase();

class BackendQuoteError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "BackendQuoteError";
    this.status = status;
    this.details = details;
  }
}

const readBackendQuoteError = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      message?: unknown;
      details?: unknown;
    };
    const message =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : `Swap backend quote failed with status ${response.status}`;

    return {
      message,
      details: payload.details,
    };
  } catch {
    return {
      message: `Swap backend quote failed with status ${response.status}`,
      details: undefined,
    };
  }
};

const resolveTokenAddress = (token?: string) => {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return undefined;
  }

  const symbolAddress = TOKEN_CONTRACTS[normalizedToken.toUpperCase()];

  if (symbolAddress) {
    return symbolAddress;
  }

  return EVM_ADDRESS_PATTERN.test(normalizedToken)
    ? normalizedToken
    : undefined;
};

const normalizeDexId = (dexId?: string) => {
  const normalized = String(dexId || "").trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (!normalized) {
    return undefined;
  }

  if (normalized === "synthra-v3" || normalized.includes("synthra")) {
    return "synthra";
  }

  if (
    normalized === "unitflow-v3" ||
    normalized.includes("unitflow") ||
    normalized.includes("unit-flow")
  ) {
    return "unitflow";
  }

  if (
    normalized === "xylonet" ||
    normalized === "xylo" ||
    normalized === "xylo-net" ||
    normalized === "xylonet-adapter" ||
    normalized.includes("xylonet")
  ) {
    return "xylonet-adapter";
  }

  return normalized;
};

const getBackendDexIds = (
  inputToken: string,
  outputToken: string,
): readonly BackendDexId[] => {
  const isCirBtcPair =
    inputToken.toLowerCase() === CIRBTC_ADDRESS ||
    outputToken.toLowerCase() === CIRBTC_ADDRESS;

  if (isCirBtcPair) {
    return ["synthra"];
  }

  return BACKEND_DEX_IDS.filter((backendDexId) => {
    if (backendDexId !== "unitflow") {
      return true;
    }

    return (
      UNITFLOW_EXECUTOR_ENABLED &&
      outputToken.toLowerCase() !== TOKEN_CONTRACTS.USDC.toLowerCase()
    );
  }) as BackendDexId[];
};

const convertAmountByDecimals = (
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

const buildBackendQuoteBody = (body: Record<string, unknown>) => {
  const dexId = normalizeDexId(String(body.dexId || ""));
  const inputToken =
    typeof body.inputToken === "string" ? body.inputToken : undefined;
  const inputAmount =
    typeof body.inputAmount === "string" ? body.inputAmount : undefined;

  if (
    dexId === "xylonet-adapter" &&
    inputToken?.toLowerCase() === TOKEN_CONTRACTS.USDC.toLowerCase() &&
    inputAmount
  ) {
    return {
      ...body,
      inputAmount: convertAmountByDecimals(
        BigInt(inputAmount),
        TOKEN_DECIMALS.USDC,
        XYLONET_NATIVE_USDC_DECIMALS,
      ).toString(),
    };
  }

  return body;
};

const routeOptionFromQuote = (quote: BackendQuote): RouteOption => {
  const hop = quote.route?.hops?.[0];
  const dexId = hop?.dexId || hop?.dex || hop?.dexName || "unknown";
  const normalizedDexId = normalizeDexId(dexId) || "unknown";

  return {
    dexId: normalizedDexId,
    dexName:
      normalizedDexId === "synthra"
        ? "Synthra"
        : normalizedDexId === "unitflow"
          ? "UnitFlow"
          : normalizedDexId === "xylonet-adapter"
            ? "Xylonet"
            : hop?.dexName || hop?.dexId || "Unknown Router",
    outputAmount: quote.outputAmount,
    routeType: quote.route?.type || "single",
    quote,
  };
};

async function fetchBackendQuote(body: Record<string, unknown>) {
  try {
    const requestBody = buildBackendQuoteBody(body);
    const response = await fetch(`${BACKEND_URL}/api/swap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const backendError = await readBackendQuoteError(response);
      throw new BackendQuoteError(
        backendError.message,
        response.status,
        backendError.details,
      );
    }

    const responseData = await response.json();
    return (responseData.data || responseData) as BackendQuote;
  } catch (error) {
    if (error instanceof BackendQuoteError) {
      throw error;
    }

    console.warn("[swap/quote] Backend quote unavailable:", error);
    throw new BackendQuoteError(
      "Swap backend unavailable",
      502,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function fetchBackendQuotes(params: {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
  dexId?: string;
  backendDexIds?: readonly BackendDexId[];
}) {
  const { dexId, backendDexIds = BACKEND_DEX_IDS, ...baseBody } = params;

  if (dexId) {
    const normalizedDexId = normalizeDexId(dexId);
    if (
      !normalizedDexId ||
      !backendDexIds.includes(normalizedDexId as BackendDexId)
    ) {
      return [];
    }

    const quote = await fetchBackendQuote({
      ...baseBody,
      dexId: normalizedDexId,
    });
    return quote ? [quote] : [];
  }

  const quotes = await Promise.all(
    backendDexIds.map((backendDexId) =>
      fetchBackendQuote({
        ...baseBody,
        dexId: backendDexId,
      }),
    ),
  );

  return quotes.filter((quote): quote is BackendQuote => quote !== null);
}

export async function POST(request: NextRequest) {
  try {
    if (SWAPS_DISABLED) {
      return NextResponse.json(SWAPS_DISABLED_RESPONSE, { status: 503 });
    }

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

    const resolvedInputToken = resolveTokenAddress(inputToken);
    const resolvedOutputToken = resolveTokenAddress(outputToken);

    if (!resolvedInputToken || !resolvedOutputToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported or invalid inputToken/outputToken",
        },
        { status: 400 },
      );
    }

    const backendDexIds = getBackendDexIds(
      resolvedInputToken,
      resolvedOutputToken,
    );
    const backendQuotes = await fetchBackendQuotes({
      inputToken: resolvedInputToken,
      outputToken: resolvedOutputToken,
      inputAmount,
      slippageTolerance,
      backendDexIds,
    });

    const candidateQuotes = backendQuotes;

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
    if (error instanceof BackendQuoteError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details,
        },
        { status: error.status },
      );
    }

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
