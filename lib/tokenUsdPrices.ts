import { formatUnits } from "viem";

import { TOKEN_CONTRACTS } from "@/lib/arcNetwork";
import {
  createSynthraPublicClient,
  getBestSynthraQuote,
} from "@/lib/synthraDex";

export const DEFAULT_TOKEN_USD_PRICES = {
  USDC: 1,
  EURC: 1.08,
  USDT: 1,
  cirBTC: 645000,
  cNGN: 0.0007185,
  QCAD: 0.73,
} as const;

export type StableTokenSymbol = keyof typeof DEFAULT_TOKEN_USD_PRICES;
export type TokenUsdPriceMap = Record<StableTokenSymbol, number>;

type QuoteApiRouteOption = {
  dexId?: string;
  dexName?: string;
  outputAmount?: string;
  isFallback?: boolean;
};

type QuoteApiPayload = {
  data?: {
    outputAmount?: string;
    routeOptions?: QuoteApiRouteOption[];
  };
  outputAmount?: string;
  routeOptions?: QuoteApiRouteOption[];
};

type CirBtcPriceSample = {
  source: "quote-api" | "synthra-direct";
  dexId: string;
  usdPrice: number;
};

const PRICE_FETCH_COOLDOWN_MS = 30_000;
const SYNTHRA_PRICE_ANCHOR_TOLERANCE = 0.35;
const MIN_REASONABLE_CIRBTC_USD_PRICE = 100_000;
const MAX_REASONABLE_CIRBTC_USD_PRICE = 1_500_000;
const ONE_USDC_NATIVE = 10n ** 6n;
const QUOTE_OUTPUT_DECIMALS = 18;
const CIRBTC_DECIMALS = 8;
const CIRBTC_ROUTE_PRICE_DEX_IDS = new Set([
  "tower-dex",
  "tower",
  "tower-amm",
  "synthra",
]);

let lastPriceFetchAt = 0;
let cachedPriceMap: TokenUsdPriceMap = {
  ...DEFAULT_TOKEN_USD_PRICES,
};
let pendingPriceFetch: Promise<TokenUsdPriceMap> | null = null;

const normalizeDexId = (dexId?: string) =>
  String(dexId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const isReasonableCirBtcUsdPrice = (usdPrice: number) =>
  Number.isFinite(usdPrice) &&
  usdPrice >= MIN_REASONABLE_CIRBTC_USD_PRICE &&
  usdPrice <= MAX_REASONABLE_CIRBTC_USD_PRICE;

const uniquePriceSamples = (samples: CirBtcPriceSample[]) => {
  const seen = new Set<string>();

  return samples.filter((sample) => {
    const key = `${sample.source}:${sample.dexId}:${sample.usdPrice.toFixed(2)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const priceFromCirBtcAmountPerUsdc = (
  cirBtcAmountPerUsdc: number,
  usdcUsdPrice: number,
) => {
  if (!Number.isFinite(cirBtcAmountPerUsdc) || cirBtcAmountPerUsdc <= 0) {
    return null;
  }

  const usdPrice = usdcUsdPrice / cirBtcAmountPerUsdc;
  return isReasonableCirBtcUsdPrice(usdPrice) ? usdPrice : null;
};

const priceFromQuoteOutputAmount = (
  outputAmount: string | undefined,
  usdcUsdPrice: number,
) => {
  if (!outputAmount) {
    return null;
  }

  try {
    const cirBtcAmount = Number.parseFloat(
      formatUnits(BigInt(outputAmount), QUOTE_OUTPUT_DECIMALS),
    );

    return priceFromCirBtcAmountPerUsdc(cirBtcAmount, usdcUsdPrice);
  } catch {
    return null;
  }
};

const averagePrice = (samples: CirBtcPriceSample[]) =>
  samples.reduce((total, sample) => total + sample.usdPrice, 0) / samples.length;

const settleCirBtcUsdPrice = (samples: CirBtcPriceSample[]) => {
  const validSamples = uniquePriceSamples(samples).filter((sample) =>
    isReasonableCirBtcUsdPrice(sample.usdPrice),
  );

  if (validSamples.length === 0) {
    return null;
  }

  const synthraAnchor = validSamples.find(
    (sample) => sample.source === "synthra-direct",
  );

  if (synthraAnchor) {
    const anchoredSamples = validSamples.filter(
      (sample) =>
        Math.abs(sample.usdPrice - synthraAnchor.usdPrice) /
          synthraAnchor.usdPrice <=
        SYNTHRA_PRICE_ANCHOR_TOLERANCE,
    );

    return averagePrice(
      anchoredSamples.length > 0 ? anchoredSamples : [synthraAnchor],
    );
  }

  const sortedPrices = [...validSamples]
    .map((sample) => sample.usdPrice)
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedPrices.length / 2);

  return sortedPrices.length % 2 === 0
    ? (sortedPrices[middleIndex - 1] + sortedPrices[middleIndex]) / 2
    : sortedPrices[middleIndex];
};

const getCirBtcPriceSamplesFromQuoteApi = async (
  usdcUsdPrice: number,
): Promise<CirBtcPriceSample[]> => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const response = await fetch("/api/swap/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        inputToken: TOKEN_CONTRACTS.USDC,
        outputToken: TOKEN_CONTRACTS.CIRBTC,
        inputAmount: ONE_USDC_NATIVE.toString(),
        slippageTolerance: 50,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as QuoteApiPayload;
    const quoteData = payload.data || payload;
    const routeSamples =
      quoteData.routeOptions
        ?.filter((option) => option.isFallback !== true)
        .flatMap((option) => {
          const dexId = normalizeDexId(option.dexId || option.dexName);
          if (!CIRBTC_ROUTE_PRICE_DEX_IDS.has(dexId)) {
            return [];
          }

          const usdPrice = priceFromQuoteOutputAmount(
            option.outputAmount,
            usdcUsdPrice,
          );

          return usdPrice
            ? [{ source: "quote-api" as const, dexId, usdPrice }]
            : [];
        }) || [];

    if (routeSamples.length > 0) {
      return routeSamples;
    }

    const fallbackUsdPrice = priceFromQuoteOutputAmount(
      quoteData.outputAmount,
      usdcUsdPrice,
    );

    return fallbackUsdPrice
      ? [
          {
            source: "quote-api",
            dexId: "best-route",
            usdPrice: fallbackUsdPrice,
          },
        ]
      : [];
  } catch (error) {
    console.warn("Failed to derive cirBTC price from local quote API", error);
    return [];
  }
};

const getCirBtcPriceSampleFromSynthra = async (
  usdcUsdPrice: number,
): Promise<CirBtcPriceSample | null> => {
  try {
    const client = createSynthraPublicClient();
    const quote = await getBestSynthraQuote(
      client,
      TOKEN_CONTRACTS.USDC,
      TOKEN_CONTRACTS.CIRBTC,
      ONE_USDC_NATIVE,
    );

    if (!quote || quote.amountOut <= 0n) {
      return null;
    }

    const cirBtcAmount = Number.parseFloat(
      formatUnits(quote.amountOut, CIRBTC_DECIMALS),
    );
    const usdPrice = priceFromCirBtcAmountPerUsdc(cirBtcAmount, usdcUsdPrice);

    return usdPrice
      ? {
          source: "synthra-direct",
          dexId: "synthra",
          usdPrice,
        }
      : null;
  } catch (error) {
    console.warn("Failed to derive cirBTC USD price from Synthra", error);
    return null;
  }
};

export async function deriveCirBtcUsdPrice(
  usdcUsdPrice: number = DEFAULT_TOKEN_USD_PRICES.USDC,
) {
  const [quoteApiSamples, synthraSample] = await Promise.all([
    getCirBtcPriceSamplesFromQuoteApi(usdcUsdPrice),
    getCirBtcPriceSampleFromSynthra(usdcUsdPrice),
  ]);
  const settledPrice = settleCirBtcUsdPrice([
    ...quoteApiSamples,
    ...(synthraSample ? [synthraSample] : []),
  ]);

  return settledPrice ?? null;
}

export async function fetchArcTokenUsdPrices(): Promise<TokenUsdPriceMap> {
  const now = Date.now();

  if (pendingPriceFetch) {
    return pendingPriceFetch;
  }

  if (now - lastPriceFetchAt < PRICE_FETCH_COOLDOWN_MS) {
    return {
      ...cachedPriceMap,
    };
  }

  pendingPriceFetch = (async () => {
    const priceMap: TokenUsdPriceMap = {
      ...cachedPriceMap,
    };

    try {
      const response = await fetch("/api/prices", {
        cache: "no-store",
      });

      if (response.ok) {
        const prices = (await response.json()) as {
          "usd-coin"?: { usd?: number };
          eurc?: { usd?: number };
          tether?: { usd?: number };
        };

        priceMap.USDC =
          prices["usd-coin"]?.usd || DEFAULT_TOKEN_USD_PRICES.USDC;
        priceMap.EURC = prices.eurc?.usd || DEFAULT_TOKEN_USD_PRICES.EURC;
        priceMap.USDT = prices.tether?.usd || DEFAULT_TOKEN_USD_PRICES.USDT;
      }
    } catch (error) {
      console.warn(
        "Failed to fetch Arc stablecoin USD prices, using cached prices",
        error,
      );
    }

    const cirBtcUsdPrice = await deriveCirBtcUsdPrice(priceMap.USDC);
    if (cirBtcUsdPrice) {
      priceMap.cirBTC = cirBtcUsdPrice;
    }

    cachedPriceMap = priceMap;
    lastPriceFetchAt = Date.now();
    return {
      ...cachedPriceMap,
    };
  })();

  try {
    return await pendingPriceFetch;
  } finally {
    pendingPriceFetch = null;
  }
}
