"use client";

import { signBrowserWalletMessage } from "@/lib/browser-wallet";

let inFlightSessionPromise: Promise<string | null> | null = null;
let cachedSessionWallet: string | null = null;

async function fetchSessionWallet(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/wallet/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      authenticated?: boolean;
      wallet?: string;
    };

    return payload.authenticated && payload.wallet
      ? payload.wallet.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

async function createWalletSession(walletAddress: string): Promise<string> {
  const normalized = walletAddress.toLowerCase();

  const nonceResponse = await fetch("/api/auth/wallet/nonce", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: normalized }),
  });

  const noncePayload = (await nonceResponse.json()) as {
    success?: boolean;
    message?: string;
    nonceToken?: string;
    error?: string;
  };

  if (!nonceResponse.ok || !noncePayload.message || !noncePayload.nonceToken) {
    throw new Error(noncePayload.error || "Failed to start wallet sign-in");
  }

  const signature = await signBrowserWalletMessage(
    noncePayload.message,
    normalized,
  );

  const verifyResponse = await fetch("/api/auth/wallet/verify", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: normalized,
      signature,
      nonceToken: noncePayload.nonceToken,
    }),
  });

  const verifyPayload = (await verifyResponse.json()) as {
    success?: boolean;
    wallet?: string;
    error?: string;
  };

  if (!verifyResponse.ok || !verifyPayload.success || !verifyPayload.wallet) {
    throw new Error(verifyPayload.error || "Failed to verify wallet session");
  }

  cachedSessionWallet = verifyPayload.wallet.toLowerCase();
  return cachedSessionWallet;
}

/**
 * Ensure an httpOnly wallet session cookie exists for the connected address.
 * Prompts a one-time personal_sign when needed.
 */
export async function ensureWalletSession(
  walletAddress: string,
): Promise<string> {
  const normalized = walletAddress.toLowerCase();

  if (cachedSessionWallet === normalized) {
    return cachedSessionWallet;
  }

  const existing = await fetchSessionWallet();
  if (existing === normalized) {
    cachedSessionWallet = existing;
    return existing;
  }

  if (!inFlightSessionPromise) {
    inFlightSessionPromise = createWalletSession(normalized).finally(() => {
      inFlightSessionPromise = null;
    });
  }

  const wallet = await inFlightSessionPromise;
  if (!wallet) {
    throw new Error("Unable to establish wallet session");
  }

  return wallet;
}

export function clearCachedWalletSession() {
  cachedSessionWallet = null;
}

export async function logoutWalletSession() {
  clearCachedWalletSession();
  try {
    await fetch("/api/auth/wallet/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
}
