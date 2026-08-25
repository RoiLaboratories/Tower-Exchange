import {
  SWAP_TOKENS,
  getSupportedCounterpartyTokens,
  isSupportedSwapPair,
  type SwapToken,
  type SwapTokenSymbol,
} from "@/lib/swapTokens";

export const POOL_LIQUIDITY_TOKENS = SWAP_TOKENS;

export const POOL_FEE_TIERS = [
  {
    value: "0.3",
    label: "0.30%",
    description: "Tower AMM fixed pool fee",
  },
] as const;

export type PoolFeeTierValue = (typeof POOL_FEE_TIERS)[number]["value"];

export const DEFAULT_POOL_FEE_TIER: PoolFeeTierValue = "0.3";

export interface NewPositionSelection {
  token0: SwapTokenSymbol;
  token1: SwapTokenSymbol;
  fee: PoolFeeTierValue;
}

export function getPoolToken(symbol?: string | null): SwapToken | undefined {
  if (!symbol) {
    return undefined;
  }

  return POOL_LIQUIDITY_TOKENS.find(
    (token) => token.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}

export function getPoolTokenOptions(
  selectedOtherSymbol?: SwapTokenSymbol | null,
): SwapToken[] {
  if (!selectedOtherSymbol) {
    return [...POOL_LIQUIDITY_TOKENS];
  }

  return getSupportedCounterpartyTokens(selectedOtherSymbol, POOL_LIQUIDITY_TOKENS);
}

export function isValidNewPositionSelection(
  token0?: SwapTokenSymbol | null,
  token1?: SwapTokenSymbol | null,
): token0 is SwapTokenSymbol {
  if (!token0 || !token1 || token0 === token1) {
    return false;
  }

  return isSupportedSwapPair(token0, token1);
}

export function formatPoolPairLabel(
  token0: SwapTokenSymbol,
  token1: SwapTokenSymbol,
): string {
  return `${token0}/${token1}`;
}

export function formatPoolFeeLabel(fee: PoolFeeTierValue): string {
  return POOL_FEE_TIERS.find((tier) => tier.value === fee)?.label ?? `${fee}%`;
}

export function buildNewPositionStep2Path(selection: NewPositionSelection): string {
  const params = new URLSearchParams({
    token0: selection.token0,
    token1: selection.token1,
    fee: selection.fee,
  });

  return `/pool/new/step-2?${params.toString()}`;
}

export function buildNewPositionStep1Path(
  selection?: Partial<NewPositionSelection>,
): string {
  if (!selection?.token0 && !selection?.token1 && !selection?.fee) {
    return "/pool/new";
  }

  const params = new URLSearchParams();

  if (selection.token0) {
    params.set("token0", selection.token0);
  }

  if (selection.token1) {
    params.set("token1", selection.token1);
  }

  if (selection.fee) {
    params.set("fee", selection.fee);
  }

  const query = params.toString();
  return query ? `/pool/new?${query}` : "/pool/new";
}

export function parseNewPositionSearchParams(
  params: URLSearchParams,
): Partial<NewPositionSelection> {
  const token0 = getPoolToken(params.get("token0"))?.symbol;
  const token1 = getPoolToken(params.get("token1"))?.symbol;
  const feeParam = params.get("fee");
  const fee = POOL_FEE_TIERS.some((tier) => tier.value === feeParam)
    ? (feeParam as PoolFeeTierValue)
    : undefined;

  return { token0, token1, fee };
}

export function resolveNewPositionSelection(
  partial: Partial<NewPositionSelection>,
): NewPositionSelection | null {
  const token0 = partial.token0;
  const token1 = partial.token1;
  const fee = partial.fee ?? DEFAULT_POOL_FEE_TIER;

  if (!token0 || !token1 || !isValidNewPositionSelection(token0, token1)) {
    return null;
  }

  return { token0, token1, fee };
}
