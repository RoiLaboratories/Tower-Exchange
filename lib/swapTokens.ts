import type { StaticImageData } from "next/image";

import eurcLogo from "@/public/assets/eurc.svg";
import usdcLogo from "@/public/assets/usdc.svg";
import usdtLogo from "@/public/assets/usdt.svg";
import cirbtcLogo from "@/public/assets/cirBTC.svg";
import { DEFAULT_TOKEN_USD_PRICES } from "@/lib/tokenUsdPrices";

export interface SwapToken {
  symbol: "USDC" | "EURC" | "USDT" | "cirBTC";
  icon: StaticImageData;
  name: string;
  balance: number;
  usdPrice: number;
}

export type SwapTokenSymbol = SwapToken["symbol"];

export const SWAP_TOKENS: readonly SwapToken[] = [
  {
    symbol: "USDC",
    icon: usdcLogo,
    name: "USD Coin",
    balance: 1000,
    usdPrice: DEFAULT_TOKEN_USD_PRICES.USDC,
  },
  {
    symbol: "EURC",
    icon: eurcLogo,
    name: "Euro Coin",
    balance: 750,
    usdPrice: DEFAULT_TOKEN_USD_PRICES.EURC,
  },
  {
    symbol: "USDT",
    icon: usdtLogo,
    name: "Tether USD",
    balance: 500,
    usdPrice: DEFAULT_TOKEN_USD_PRICES.USDT,
  },
  {
    symbol: "cirBTC",
    icon: cirbtcLogo,
    name: "Circle Bitcoin",
    balance: 0,
    usdPrice: DEFAULT_TOKEN_USD_PRICES.cirBTC,
  },
] as const;

const SUPPORTED_SWAP_PAIR_KEYS = new Set<string>([
  "USDC:EURC",
  "EURC:USDC",
  "USDC:USDT",
  "USDT:USDC",
  "USDT:EURC",
  "EURC:USDT",
  "USDC:CIRBTC",
  "CIRBTC:USDC",
  "USDT:CIRBTC",
  "CIRBTC:USDT",
  "EURC:CIRBTC",
  "CIRBTC:EURC",
]);

export function isSupportedSwapPair(
  tokenInSymbol?: string | null,
  tokenOutSymbol?: string | null,
) {
  if (!tokenInSymbol || !tokenOutSymbol) {
    return false;
  }

  return SUPPORTED_SWAP_PAIR_KEYS.has(
    `${tokenInSymbol.toUpperCase()}:${tokenOutSymbol.toUpperCase()}`,
  );
}

export function getSupportedCounterpartyTokens(
  tokenSymbol?: string | null,
): SwapToken[] {
  if (!tokenSymbol) {
    return [...SWAP_TOKENS];
  }

  return SWAP_TOKENS.filter(
    (token) =>
      token.symbol !== tokenSymbol &&
      isSupportedSwapPair(tokenSymbol, token.symbol),
  );
}
