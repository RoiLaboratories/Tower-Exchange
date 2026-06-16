"use client";

import { useRef } from "react";
import { useAccountEffect } from "wagmi";
import { trackWalletConnection } from "@/lib/walletConnectionTracking";

export const WalletConnectionTracker = () => {
  const trackedAddressRef = useRef<string | null>(null);

  useAccountEffect({
    onConnect(data) {
      const normalizedAddress = data.address.toLowerCase();

      if (data.isReconnected) {
        trackedAddressRef.current = normalizedAddress;
        return;
      }

      if (trackedAddressRef.current === normalizedAddress) {
        return;
      }

      trackedAddressRef.current = normalizedAddress;

      void trackWalletConnection({
        walletAddress: normalizedAddress,
        walletType: data.connector?.name ?? null,
        chainId: data.chainId ?? null,
        connectedAt: new Date().toISOString(),
      });
    },
    onDisconnect() {
      trackedAddressRef.current = null;
    },
  });

  return null;
};
