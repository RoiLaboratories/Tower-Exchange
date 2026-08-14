import { NextResponse } from "next/server";

export const EVM_WALLET_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/;

export function normalizeWalletAddress(walletAddress: unknown): string | null {
  if (typeof walletAddress !== "string" || !walletAddress.trim()) {
    return null;
  }

  const normalized = walletAddress.trim().toLowerCase();
  return EVM_WALLET_ADDRESS_PATTERN.test(normalized) ? normalized : null;
}

export function walletError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function requireWalletAddress(walletAddress: unknown) {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) {
    return { wallet: null as string | null, response: walletError("Valid wallet address is required.") };
  }
  return { wallet: normalized, response: null as ReturnType<typeof walletError> | null };
}
