export const DEFAULT_TOKEN_USD_PRICES = {
  USDC: 1,
  EURC: 1.08,
  USDT: 1,
  cirBTC: 404000,
} as const;

export type StableTokenSymbol = keyof typeof DEFAULT_TOKEN_USD_PRICES;
