"use client";

import React from "react";
import { RainbowKitProvider, Theme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import { TowerWalletAvatar } from "@/components/wallet/TowerWalletAvatar";
import { WalletConnectionTracker } from "@/components/providers/WalletConnectionTracker";
import "@rainbow-me/rainbowkit/styles.css";

// Create Query Client
const queryClient = new QueryClient();

// Custom RainbowKit Theme matching Tower Exchange Design
const customTheme: Theme = {
  blurs: {
    modalOverlay: "blur(0px)",
  },
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
    downloadBottomCardBackground: "linear-gradient(180deg, hsl(220 20% 10%) 0%, hsl(220 20% 8%) 100%)",
    downloadTopCardBackground: "linear-gradient(180deg, hsl(220 20% 12%) 0%, hsl(220 20% 10%) 100%)",
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

interface RainbowKitProviderProps {
  children: React.ReactNode;
}

export const CustomRainbowKitProvider = ({
  children,
}: RainbowKitProviderProps) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme} avatar={TowerWalletAvatar}>
          <WalletConnectionTracker />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
