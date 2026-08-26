"use client";

import React, { useMemo } from "react";
import { RainbowKitProvider, Theme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import { TowerWalletAvatar } from "@/components/wallet/TowerWalletAvatar";
import { WalletConnectionTracker } from "@/components/providers/WalletConnectionTracker";
import { useTheme } from "@/components/providers/ThemeProvider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const darkTheme: Theme = {
  blurs: { modalOverlay: "blur(0px)" },
  colors: {
    accentColor: "#7bb8ff",
    accentColorForeground: "#0a0b0d",
    actionButtonBorder: "hsl(220 15% 18%)",
    actionButtonBorderMobile: "hsl(220 15% 18%)",
    actionButtonSecondaryBackground: "hsl(220 20% 14%)",
    closeButton: "hsl(215 20% 55%)",
    closeButtonBackground: "hsl(220 20% 14%)",
    connectButtonBackground: "#7bb8ff",
    connectButtonBackgroundError: "hsl(0 84% 60%)",
    connectButtonInnerBackground: "#7bb8ff",
    connectButtonText: "#0a0b0d",
    connectButtonTextError: "#0a0b0d",
    connectionIndicator: "hsl(142 76% 45%)",
    downloadBottomCardBackground:
      "linear-gradient(180deg, hsl(220 20% 10%) 0%, hsl(220 20% 8%) 100%)",
    downloadTopCardBackground:
      "linear-gradient(180deg, hsl(220 20% 12%) 0%, hsl(220 20% 10%) 100%)",
    error: "hsl(0 84% 60%)",
    generalBorder: "hsl(220 15% 18%)",
    generalBorderDim: "hsl(220 15% 16%)",
    menuItemBackground: "hsl(220 20% 14%)",
    modalBackdrop: "rgba(0, 0, 0, 0.7)",
    modalBackground: "hsl(220 20% 10%)",
    modalBorder: "hsl(220 15% 18%)",
    modalText: "hsl(210 40% 98%)",
    modalTextDim: "hsl(215 20% 55%)",
    modalTextSecondary: "hsl(215 20% 55%)",
    profileAction: "hsl(220 20% 14%)",
    profileActionHover: "hsl(220 20% 16%)",
    profileForeground: "hsl(220 20% 10%)",
    selectedOptionBorder: "#7bb8ff",
    standby: "hsl(215 20% 55%)",
  },
  fonts: {
    body: 'var(--font-sora), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  radii: {
    actionButton: "9999px",
    connectButton: "9999px",
    menuButton: "12px",
    modal: "16px",
    modalMobile: "16px",
  },
  shadows: {
    connectButton: "0 4px 12px rgba(123, 184, 255, 0.15)",
    dialog: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
    profileDetailsAction: "0 2px 4px rgba(0, 0, 0, 0.3)",
    selectedOption: "0 0 0 1px #7bb8ff",
    selectedWallet: "0 0 0 2px #7bb8ff",
    walletLogo: "0 2px 4px rgba(0, 0, 0, 0.3)",
  },
};

const lightTheme: Theme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    accentColor: "#4d95eb",
    accentColorForeground: "#ffffff",
    actionButtonBorder: "#e2e8f0",
    actionButtonBorderMobile: "#e2e8f0",
    actionButtonSecondaryBackground: "#eef2f7",
    closeButton: "#64748b",
    closeButtonBackground: "#eef2f7",
    connectButtonBackground: "#7bb8ff",
    connectButtonInnerBackground: "#7bb8ff",
    connectButtonText: "#0C0C0D",
    generalBorder: "#e2e8f0",
    generalBorderDim: "#edf2f7",
    menuItemBackground: "#eef2f7",
    modalBackdrop: "rgba(15, 23, 42, 0.35)",
    modalBackground: "#ffffff",
    modalBorder: "#e2e8f0",
    modalText: "#0f172a",
    modalTextDim: "#64748b",
    modalTextSecondary: "#64748b",
    profileAction: "#eef2f7",
    profileActionHover: "#e2e8f0",
    profileForeground: "#ffffff",
    standby: "#94a3b8",
  },
  shadows: {
    connectButton: "0 4px 12px rgba(77, 149, 235, 0.18)",
    dialog: "0 20px 25px -5px rgba(15, 23, 42, 0.12)",
    profileDetailsAction: "0 2px 4px rgba(15, 23, 42, 0.08)",
    selectedOption: "0 0 0 1px #4d95eb",
    selectedWallet: "0 0 0 2px #4d95eb",
    walletLogo: "0 2px 4px rgba(15, 23, 42, 0.08)",
  },
};

interface RainbowKitProviderProps {
  children: React.ReactNode;
}

export const CustomRainbowKitProvider = ({
  children,
}: RainbowKitProviderProps) => {
  const { theme } = useTheme();
  const rainbowTheme = useMemo(
    () => (theme === "light" ? lightTheme : darkTheme),
    [theme],
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme} avatar={TowerWalletAvatar}>
          <WalletConnectionTracker />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
