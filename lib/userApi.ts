/**
 * Browser-safe helpers for wallet-scoped user data APIs.
 * These call Next.js routes that use the service role server-side,
 * gated by a signed wallet session cookie.
 */

import { ensureWalletSession } from "@/lib/walletSessionClient";

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function userApiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { walletAddress?: string },
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { walletAddress, ...fetchInit } = init || {};

  if (walletAddress) {
    try {
      await ensureWalletSession(walletAddress);
    } catch (error) {
      return {
        ok: false,
        status: 401,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Wallet session required",
      };
    }
  }

  const response = await fetch(path, {
    ...fetchInit,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(fetchInit.headers || {}),
    },
  });

  const payload = (await parseJson(response)) as
    | (T & { error?: string; message?: string; success?: boolean })
    | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error:
        payload?.error ||
        payload?.message ||
        `Request failed with status ${response.status}`,
    };
  }

  return { ok: true, status: response.status, data: payload as T };
}
