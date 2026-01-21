"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { ReactNode } from "react";

export const PrivyProvider = ({ children }: { children: ReactNode }) => {
  return (
    <PrivyProviderBase
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7bb8ff",
          logo: "/assets/Tower%20Logo.svg",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        externalWallets: {
          solana: {},
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
};
