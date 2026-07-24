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
} as const;

export type StableTokenSymbol = keyof typeof DEFAULT_TOKEN_USD_PRICES;
export type TokenUsdPriceMap = Record<StableTokenSymbol, number>;

const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,eurc,tether&vs_currencies=usd";
const ONE_USDC_NATIVE = 10n ** 6n;
const QUOTE_OUTPUT_DECIMALS = 18;
const CIRBTC_DECIMALS = 8;

const getCirBtcAmountPerUsdcFromQuoteApi = async () => {
  if (typeof window === "undefined") {
    return null;
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
      return null;
    }

    const payload = (await response.json()) as {
      data?: { outputAmount?: string };
      outputAmount?: string;
    };
    const outputAmount = payload.data?.outputAmount || payload.outputAmount;

    if (!outputAmount) {
      return null;
    }

    const cirBtcAmount = Number.parseFloat(
      formatUnits(BigInt(outputAmount), QUOTE_OUTPUT_DECIMALS),
    );

    return Number.isFinite(cirBtcAmount) && cirBtcAmount > 0
      ? cirBtcAmount
      : null;
  } catch (error) {
    console.warn("Failed to derive cirBTC price from local quote API", error);
    return null;
  }
};

const getCirBtcAmountPerUsdcFromSynthra = async () => {
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

    return Number.isFinite(cirBtcAmount) && cirBtcAmount > 0
      ? cirBtcAmount
      : null;
  } catch (error) {
    console.warn("Failed to derive cirBTC USD price from Synthra", error);
    return null;
  }
};

export async function deriveCirBtcUsdPrice(
  usdcUsdPrice: number = DEFAULT_TOKEN_USD_PRICES.USDC,
) {
  const cirBtcAmountPerUsdc =
    (await getCirBtcAmountPerUsdcFromQuoteApi()) ||
    (await getCirBtcAmountPerUsdcFromSynthra());

  if (!cirBtcAmountPerUsdc) {
    return null;
  }

  const derivedPrice = usdcUsdPrice / cirBtcAmountPerUsdc;

  return Number.isFinite(derivedPrice) && derivedPrice > 0
    ? derivedPrice
    : null;
}

export async function fetchArcTokenUsdPrices(): Promise<TokenUsdPriceMap> {
  const priceMap: TokenUsdPriceMap = {
    ...DEFAULT_TOKEN_USD_PRICES,
  };

  try {
    const response = await fetch(COINGECKO_PRICE_URL, {
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
      "Failed to fetch Arc stablecoin USD prices, using defaults",
      error,
    );
  }

  const cirBtcUsdPrice = await deriveCirBtcUsdPrice(priceMap.USDC);
  if (cirBtcUsdPrice) {
    priceMap.cirBTC = cirBtcUsdPrice;
  }

  return priceMap;
}
