export type WalletConnectionTrackingPayload = {
  walletAddress: string;
  walletType?: string | null;
  chainId?: number | null;
  connectedAt?: string;
};

export async function trackWalletConnection(
  payload: WalletConnectionTrackingPayload,
) {
  try {
    const response = await fetch("/api/wallet/connections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (response.ok) {
      return true;
    }

    const result = (await response.json().catch(() => null)) as
      | { message?: string; debug?: string }
      | null;

    console.warn("Wallet connection tracking failed:", {
      status: response.status,
      message: result?.message,
      debug: result?.debug,
    });
  } catch (error) {
    console.error("Wallet connection tracking request failed:", error);
  }

  return false;
}
