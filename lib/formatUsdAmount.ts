export function formatUsdAmount(
  amount: string | number | null | undefined,
  unitPrice: number = 1
) {
  const numericAmount =
    typeof amount === "number" ? amount : Number.parseFloat(amount ?? "");

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "$0.00";
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return "$0.00";
  }

  const usdValue = numericAmount * unitPrice;
  const maximumFractionDigits = usdValue > 0 && usdValue < 0.01 ? 6 : 2;

  return usdValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}
