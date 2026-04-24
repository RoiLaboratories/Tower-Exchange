"use client";

import { stringToHex } from "viem";

type BrowserWalletRequestArguments = {
  method: string;
  params?: readonly unknown[] | object;
};

export type BrowserWalletTransactionReceipt = {
  status?: string;
  blockNumber?: string;
  gasUsed?: string;
  [key: string]: unknown;
};

export type BrowserWalletProvider = {
  request(args: BrowserWalletRequestArguments): Promise<unknown>;
  on?(eventName: "chainChanged", listener: (chainId: string) => void): void;
  on?(eventName: "accountsChanged", listener: (accounts: string[]) => void): void;
  on?(eventName: string, listener: (...args: unknown[]) => void): void;
  removeListener?(
    eventName: "chainChanged",
    listener: (chainId: string) => void,
  ): void;
  removeListener?(
    eventName: "accountsChanged",
    listener: (accounts: string[]) => void,
  ): void;
  removeListener?(eventName: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: BrowserWalletProvider;
  }
}

export const getBrowserWalletProvider = (): BrowserWalletProvider => {
  if (typeof window === "undefined") {
    throw new Error("Wallet provider is only available in the browser.");
  }

  const provider = window.ethereum;

  if (!provider) {
    throw new Error("No injected wallet provider found. Please connect your wallet.");
  }

  return provider;
};

export const getBrowserWalletChainId = async (
  provider: BrowserWalletProvider = getBrowserWalletProvider(),
) => {
  const chainId = await provider.request({ method: "eth_chainId" });

  if (typeof chainId !== "string") {
    throw new Error("Wallet returned an invalid chain ID.");
  }

  return chainId;
};

export const signBrowserWalletMessage = async (
  message: string,
  walletAddress: string,
  provider: BrowserWalletProvider = getBrowserWalletProvider(),
) => {
  const signature = await provider.request({
    method: "personal_sign",
    params: [stringToHex(message), walletAddress],
  });

  if (typeof signature !== "string") {
    throw new Error("Wallet returned an invalid signature.");
  }

  return signature;
};
