import { NextRequest, NextResponse } from "next/server";
import { resolveSwapBackendUrl } from "@/lib/resolveSwapBackendUrl";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";
import {
  getTowerDexQuote,
  isTowerDexEnabled,
  isTowerDexSupportedPair,
  normalizeTowerDexId,
  TOWER_DEX_ID,
  TOWER_DEX_NAME,
  type TowerDexQuote,
} from "@/lib/towerDex";

type BackendQuote = {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  swapInputAmount?: string;
  outputAmount: string;
  minOut: string;
  priceImpact: string | number;
  gasEstimate?: string;
  slippage?: number;
  exec_price?: number;
  feeBps?: number;
  feeMode?: "tower-swap-executor" | "none";
  platformFeeAmount?: string;
  route: {
    type: "single" | "multi" | "split";
    rawPath?: string;
    totalFee?: number;
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
      liquidity?: string;
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
  quote: QuoteLike;
};

type QuoteLike = BackendQuote | TowerDexQuote;

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
const PRIMARY_BACKEND_QUOTE_TIMEOUT_MS = 8_000;
const BACKEND_DEX_FALLBACK_TIMEOUT_MS = 8_000;
const OPTIONAL_TOWER_QUOTE_TIMEOUT_MS = 3_000;
const OPTIONAL_TOWER_QUOTE_JOIN_GRACE_MS = 250;
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
  const normalized = String(dexId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

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

  if (normalizeTowerDexId(normalized) === TOWER_DEX_ID) {
    return TOWER_DEX_ID;
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

    return UNITFLOW_EXECUTOR_ENABLED;
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

const routeOptionFromQuote = (quote: QuoteLike): RouteOption => {
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
            : normalizedDexId === TOWER_DEX_ID
              ? TOWER_DEX_NAME
              : hop?.dexName || hop?.dexId || "Unknown Router",
    outputAmount: quote.outputAmount,
    routeType: quote.route?.type || "single",
    quote,
  };
};

const dedupeRouteOptions = (options: RouteOption[]) =>
  Array.from(
    options
      .map((option) => ({
        ...option,
        dexId: normalizeDexId(option.dexId) || option.dexId,
      }))
      .reduce((optionsByDexId, option) => {
        const existingOption = optionsByDexId.get(option.dexId);

        if (
          !existingOption ||
          BigInt(option.outputAmount || "0") >
            BigInt(existingOption.outputAmount || "0")
        ) {
          optionsByDexId.set(option.dexId, option);
        }

        return optionsByDexId;
      }, new Map<string, RouteOption>())
      .values(),
  );

const dedupeQuotesByDex = (quotes: BackendQuote[]) =>
  Array.from(
    quotes.reduce((quotesByDexId, quote) => {
      const dexId = normalizeDexId(
        quote.route?.hops?.[0]?.dexId ||
          quote.route?.hops?.[0]?.dex ||
          quote.route?.hops?.[0]?.dexName,
      );

      if (!dexId) {
        return quotesByDexId;
      }

      const existingQuote = quotesByDexId.get(dexId);

      if (
        !existingQuote ||
        BigInt(quote.outputAmount || "0") > BigInt(existingQuote.outputAmount || "0")
      ) {
        quotesByDexId.set(dexId, quote);
      }

      return quotesByDexId;
    }, new Map<string, BackendQuote>()).values(),
  );

const buildBackendRouteOptions = (
  quote: BackendQuote,
  backendDexIds: readonly BackendDexId[],
) => {
  const fallbackOption = routeOptionFromQuote(quote);
  const sourceOptions = quote.routeOptions?.length
    ? quote.routeOptions
    : [fallbackOption];
  const filteredOptions = sourceOptions.filter((option) => {
    const normalizedOptionDexId = normalizeDexId(option.dexId || option.dexName);

    return normalizedOptionDexId
      ? backendDexIds.includes(normalizedOptionDexId as BackendDexId)
      : false;
  });

  return dedupeRouteOptions(
    filteredOptions.length > 0 ? filteredOptions : [fallbackOption],
  );
};

const getMissingBackendDexIds = (
  routeOptions: RouteOption[],
  backendDexIds: readonly BackendDexId[],
): BackendDexId[] => {
  const coveredDexIds = new Set(
    routeOptions.flatMap((option) => {
      const normalizedDexId = normalizeDexId(option.dexId || option.dexName);

      return normalizedDexId &&
        backendDexIds.includes(normalizedDexId as BackendDexId)
        ? [normalizedDexId as BackendDexId]
        : [];
    }),
  );

  return backendDexIds.filter((backendDexId) => !coveredDexIds.has(backendDexId));
};

async function fetchBackendQuote(
  body: Record<string, unknown>,
  timeoutMs = PRIMARY_BACKEND_QUOTE_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody = buildBackendQuoteBody(body);
    const response = await fetch(`${BACKEND_URL}/api/swap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: controller.signal,
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

    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendQuoteError(
        `Swap backend quote timed out after ${Math.round(timeoutMs / 1000)}s`,
        504,
      );
    }

    console.warn("[swap/quote] Backend quote unavailable:", error);
    throw new BackendQuoteError(
      "Swap backend unavailable",
      502,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBackendQuotesByDex(params: {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
  backendDexIds: readonly BackendDexId[];
}) {
  const { backendDexIds, ...baseBody } = params;

  const results = await Promise.all(
    backendDexIds.map(async (backendDexId) => {
      try {
        const quote = await fetchBackendQuote(
          {
            ...baseBody,
            dexId: backendDexId,
          },
          BACKEND_DEX_FALLBACK_TIMEOUT_MS,
        );

        return {
          quote,
          error: null as BackendQuoteError | null,
        };
      } catch (error) {
        const backendError =
          error instanceof BackendQuoteError
            ? error
            : new BackendQuoteError(
                "Swap backend unavailable",
                502,
                error instanceof Error ? error.message : String(error),
              );

        console.warn(`[swap/quote] ${backendDexId} quote unavailable:`, {
          status: backendError.status,
          message: backendError.message,
        });

        return {
          quote: null,
          error: backendError,
        };
      }
    }),
  );

  const quotes = results.flatMap((result) =>
    result.quote ? [result.quote] : [],
  );

  if (quotes.length === 0) {
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) {
      throw firstError;
    }

    return {
      quotes: [],
      routeOptions: [],
    };
  }

  return {
    quotes,
    routeOptions: dedupeRouteOptions(quotes.map(routeOptionFromQuote)),
  };
}

async function fetchBackendQuotes(params: {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
  dexId?: string;
  backendDexIds?: readonly BackendDexId[];
}): Promise<{
  quotes: BackendQuote[];
  routeOptions: RouteOption[];
}> {
  const { dexId, backendDexIds = BACKEND_DEX_IDS, ...baseBody } = params;

  if (dexId) {
    const normalizedDexId = normalizeDexId(dexId);
    if (
      !normalizedDexId ||
      !backendDexIds.includes(normalizedDexId as BackendDexId)
    ) {
      return {
        quotes: [],
        routeOptions: [],
      };
    }

    const quote = await fetchBackendQuote({
      ...baseBody,
      dexId: normalizedDexId,
    });

    if (!quote) {
      return {
        quotes: [],
        routeOptions: [],
      };
    }

    return {
      quotes: [quote],
      routeOptions: [routeOptionFromQuote(quote)],
    };
  }

  const aggregateQuote = await fetchBackendQuote(baseBody);

  if (!aggregateQuote) {
    return {
      quotes: [],
      routeOptions: [],
    };
  }

  const aggregateRouteOptions = buildBackendRouteOptions(
    aggregateQuote,
    backendDexIds,
  );
  const missingBackendDexIds = getMissingBackendDexIds(
    aggregateRouteOptions,
    backendDexIds,
  );

  if (missingBackendDexIds.length === 0) {
    return {
      quotes: [aggregateQuote],
      routeOptions: aggregateRouteOptions,
    };
  }

  try {
    const fallbackResult = await fetchBackendQuotesByDex({
      ...baseBody,
      backendDexIds: missingBackendDexIds,
    });

    return {
      quotes: dedupeQuotesByDex([aggregateQuote, ...fallbackResult.quotes]),
      routeOptions: dedupeRouteOptions([
        ...aggregateRouteOptions,
        ...fallbackResult.routeOptions,
      ]),
    };
  } catch {
    return {
      quotes: [aggregateQuote],
      routeOptions: aggregateRouteOptions,
    };
  }
}

const waitForNull = (timeoutMs: number) =>
  new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

async function fetchOptionalTowerQuote(params: {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageBps: number;
}) {
  try {
    return await Promise.race([
      getTowerDexQuote(params),
      waitForNull(OPTIONAL_TOWER_QUOTE_TIMEOUT_MS),
    ]);
  } catch (error) {
    console.warn("[swap/quote] Tower quote unavailable:", error);
    return null;
  }
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
        {
          success: false,
          error: "Missing inputToken, outputToken, or inputAmount",
        },
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

    const towerPairSupported =
      isTowerDexEnabled() &&
      isTowerDexSupportedPair(resolvedInputToken, resolvedOutputToken);
    const towerDexRequested = normalizedRequestedDexId === TOWER_DEX_ID;

    if (towerDexRequested) {
      const towerQuote = towerPairSupported
        ? await fetchOptionalTowerQuote({
            inputToken: resolvedInputToken,
            outputToken: resolvedOutputToken,
            inputAmount,
            slippageBps: slippageTolerance,
          })
        : null;

      if (!towerQuote) {
        return NextResponse.json(
          { success: false, error: "No valid Tower route found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...towerQuote,
          routeOptions: [routeOptionFromQuote(towerQuote)],
        },
      });
    }

    const backendDexIds = getBackendDexIds(
      resolvedInputToken,
      resolvedOutputToken,
    );
    const backendDexRequest =
      normalizedRequestedDexId && normalizedRequestedDexId !== TOWER_DEX_ID
        ? normalizedRequestedDexId
        : undefined;
    const shouldFetchTowerQuote =
      !normalizedRequestedDexId && towerPairSupported;

    const optionalTowerQuotePromise = shouldFetchTowerQuote
      ? fetchOptionalTowerQuote({
          inputToken: resolvedInputToken,
          outputToken: resolvedOutputToken,
          inputAmount,
          slippageBps: slippageTolerance,
        })
      : null;

    let backendResult: { quotes: BackendQuote[]; routeOptions: RouteOption[] };
    let optionalTowerQuote: TowerDexQuote | null = null;

    try {
      backendResult = await fetchBackendQuotes({
        inputToken: resolvedInputToken,
        outputToken: resolvedOutputToken,
        inputAmount,
        slippageTolerance,
        backendDexIds,
        dexId: backendDexRequest,
      });
    } catch (error) {
      if (optionalTowerQuotePromise) {
        const fallbackTowerQuote = await optionalTowerQuotePromise;

        if (fallbackTowerQuote) {
          return NextResponse.json({
            success: true,
            data: {
              ...fallbackTowerQuote,
              routeOptions: [routeOptionFromQuote(fallbackTowerQuote)],
            },
          });
        }
      }

      throw error;
    }

    if (optionalTowerQuotePromise) {
      optionalTowerQuote = await Promise.race([
        optionalTowerQuotePromise,
        waitForNull(OPTIONAL_TOWER_QUOTE_JOIN_GRACE_MS),
      ]);
    }

    const candidateQuotes = optionalTowerQuote
      ? [...backendResult.quotes, optionalTowerQuote]
      : backendResult.quotes;

    if (candidateQuotes.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid route found" },
        { status: 404 },
      );
    }

    const routeOptions = dedupeRouteOptions([
      ...backendResult.routeOptions,
      ...(optionalTowerQuote
        ? [routeOptionFromQuote(optionalTowerQuote)]
        : []),
    ]);
    const requestedQuote = normalizedRequestedDexId
      ? candidateQuotes.find(
          (quote) => routeOptionFromQuote(quote).dexId === normalizedRequestedDexId,
        )
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
        BigInt(quote.outputAmount || "0") > BigInt(best.outputAmount || "0")
          ? quote
          : best,
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




