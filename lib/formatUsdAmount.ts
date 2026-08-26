export function formatTokenUnitUsdPrice(unitPrice: number) {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return "$0.00";
  }

  if (unitPrice >= 1000) {
    return unitPrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  if (unitPrice >= 1) {
    return unitPrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (unitPrice >= 0.01) {
    return unitPrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  const maximumFractionDigits = unitPrice >= 0.0001 ? 6 : 8;

  return unitPrice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

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
