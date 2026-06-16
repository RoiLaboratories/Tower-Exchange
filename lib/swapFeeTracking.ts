import { formatUnits } from "viem";
import { TOKEN_CONTRACTS, TOKEN_DECIMALS } from "@/lib/arcNetwork";
import { registerSwapFee } from "@/lib/supabase";

type RecordExecutorSwapFeeParams = {
  walletAddress: string;
  tokenAddress: string;
  totalAmount: string;
  feeAmount: string;
  feeBps?: number | null;
  transactionHash?: string | null;
  blockNumber?: number | null;
  activityId?: string | null;
  tokenSymbol?: string | null;
  usdPrice?: number | null;
};

type RecordExecutorSwapFeeResult = {
  success: boolean;
  error?: string;
  skipped?: boolean;
  id?: string;
};

const resolveTokenSymbolByAddress = (tokenAddress: string) =>
  Object.entries(TOKEN_CONTRACTS).find(
    ([, address]) => address.toLowerCase() === tokenAddress.toLowerCase(),
  )?.[0] ?? null;

const resolveTokenDecimalsByAddress = (tokenAddress: string) => {
  const tokenSymbol = resolveTokenSymbolByAddress(tokenAddress);
  return tokenSymbol ? TOKEN_DECIMALS[tokenSymbol] ?? 18 : 18;
};

const formatFeeAmountUsd = (
  feeAmount: string,
  tokenAddress: string,
  usdPrice?: number | null,
) => {
  if (!usdPrice || usdPrice <= 0) {
    return undefined;
  }

  try {
    const feeAmountFormatted = Number(
      formatUnits(BigInt(feeAmount), resolveTokenDecimalsByAddress(tokenAddress)),
    );

    if (!Number.isFinite(feeAmountFormatted) || feeAmountFormatted <= 0) {
      return undefined;
    }

    return (feeAmountFormatted * usdPrice).toString();
  } catch (error) {
    console.warn("Unable to format executor swap fee USD value:", error);
    return undefined;
  }
};

export async function recordExecutorSwapFee(
  params: RecordExecutorSwapFeeParams,
): Promise<RecordExecutorSwapFeeResult> {
  const normalizedWalletAddress = params.walletAddress?.trim().toLowerCase();
  const normalizedTokenAddress = params.tokenAddress?.trim().toLowerCase();

  if (!normalizedWalletAddress || !normalizedTokenAddress) {
    return { success: false, error: "Wallet address and token address are required." };
  }

  try {
    if (BigInt(params.feeAmount) <= 0n || BigInt(params.totalAmount) <= 0n) {
      return { success: true, skipped: true };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid fee amount.",
    };
  }

  const tokenSymbol =
    resolveTokenSymbolByAddress(normalizedTokenAddress) ??
    params.tokenSymbol?.trim() ??
    "UNKNOWN";

  return registerSwapFee({
    walletAddress: normalizedWalletAddress,
    tokenAddress: normalizedTokenAddress,
    tokenSymbol,
    feeAmount: params.feeAmount,
    feeAmountUsd: formatFeeAmountUsd(
      params.feeAmount,
      normalizedTokenAddress,
      params.usdPrice,
    ),
    feeBasisPoints: params.feeBps ?? 25,
    totalAmount: params.totalAmount,
    transactionHash: params.transactionHash ?? undefined,
    blockNumber: params.blockNumber ?? undefined,
    status: "Confirmed",
    activityId: params.activityId ?? undefined,
  });
}
