"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { logoutWalletSession } from "@/lib/walletSessionClient";

/**
 * RainbowKit Compatibility Hook
 * Provides a Privy-like interface to minimize component changes
 * during migration
 */
export const useRainbowKitAuth = () => {
  const { address, isConnected, chainId, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const ready = hydrated && status !== "reconnecting";

  const user = useMemo(
    () =>
      ready && isConnected
        ? {
            wallet: {
              address,
              chainId,
            },
          }
        : null,
    [address, chainId, isConnected, ready],
  );

  const login = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const logout = useCallback(() => {
    void logoutWalletSession();
    disconnect();
  }, [disconnect]);

  return useMemo(
    () => ({
      user,
      authenticated: isConnected,
      login,
      logout,
      ready,
      isReady: ready,
      address,
    }),
    [address, isConnected, login, logout, ready, user],
  );
};
