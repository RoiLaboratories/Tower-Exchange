"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { ReactNode } from "react";

export const PrivyProvider = ({ children }: { children: ReactNode }) => {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId || appId.trim() === "" || appId === "your-privy-app-id") {
    console.error(
      "❌ Privy App ID is missing or invalid. Please set NEXT_PUBLIC_PRIVY_APP_ID in your .env.local file.\n" +
        "Get your App ID at: https://dashboard.privy.io"
    );
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-destructive">
            Privy Configuration Error
          </h1>
          <p className="mb-4">
            Please set a valid <code className="bg-muted px-2 py-1 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code> in your{" "}
            <code className="bg-muted px-2 py-1 rounded">.env.local</code> file.
          </p>
          <p className="text-sm text-muted-foreground">
            Get your App ID at:{" "}
            <a
              href="https://dashboard.privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://dashboard.privy.io
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProviderBase
      appId={appId}
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
      }}
    >
      <div key="app-root">{children}</div>
    </PrivyProviderBase>
  );
};
