"use client";

import { useMemo, useSyncExternalStore } from "react";

export type SolanaWalletKey = "phantom" | "solflare";

type SolanaPublicKeyLike = {
  toString?: () => string;
};

type SolanaConnectResult = {
  publicKey?: SolanaPublicKeyLike | null;
} | null;

export type SolanaWalletProvider = {
  publicKey?: SolanaPublicKeyLike | null;
  address?: string;
  isConnected: boolean;
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: (options?: Record<string, unknown>) => Promise<SolanaConnectResult | { address?: string }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
  signAllTransactions?: (transactions: unknown[]) => Promise<unknown[]>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type SolanaWalletOption = {
  key: SolanaWalletKey;
  label: string;
  provider: SolanaWalletProvider | null;
  installed: boolean;
  installUrl: string;
};

type SolanaWalletState = {
  address: string;
  connected: boolean;
  selectedWallet: SolanaWalletKey | null;
  provider: SolanaWalletProvider | null;
  availableWallets: SolanaWalletOption[];
  modalOpen: boolean;
  isConnecting: boolean;
  error: string | null;
};

const SOLANA_WALLET_METADATA: Record<
  SolanaWalletKey,
  Pick<SolanaWalletOption, "label" | "installUrl">
> = {
  phantom: {
    label: "Phantom",
    installUrl: "https://phantom.com/",
  },
  solflare: {
    label: "Solflare",
    installUrl: "https://solflare.com/",
  },
};

let state: SolanaWalletState = {
  address: "",
  connected: false,
  selectedWallet: null,
  provider: null,
  availableWallets: [],
  modalOpen: false,
  isConnecting: false,
  error: null,
};

const listeners = new Set<() => void>();
let activeProviderCleanup: (() => void) | null = null;

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Partial<SolanaWalletState>) => {
  state = {
    ...state,
    ...partial,
  };
  emitChange();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getState = () => state;

type SolanaWindow = Window & {
  solana?: SolanaWalletProvider;
  phantom?: {
    solana?: SolanaWalletProvider;
  };
  solflare?: SolanaWalletProvider;
  backpack?: {
    solana?: SolanaWalletProvider;
  };
  xnft?: {
    solana?: SolanaWalletProvider;
  };
};

const getProviderAddress = (provider: SolanaWalletProvider | null | undefined) =>
  provider?.publicKey?.toString?.() ?? provider?.address ?? "";

const setProviderAddress = (
  provider: SolanaWalletProvider | null | undefined,
  address: string,
) => {
  if (!provider) {
    return;
  }

  try {
    provider.address = address;
  } catch (error) {
    console.warn("Unable to sync Solana wallet address onto provider:", error);
  }
};

const getWalletCandidates = (): SolanaWalletOption[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const solanaWindow = window as SolanaWindow;
  const genericProvider = solanaWindow.solana ?? null;
  const phantomProvider =
    solanaWindow.phantom?.solana ??
    (genericProvider?.isPhantom ? genericProvider : null);
  const solflareProvider =
    solanaWindow.solflare ?? (genericProvider?.isSolflare ? genericProvider : null);

  return (Object.entries(SOLANA_WALLET_METADATA) as Array<
    [SolanaWalletKey, Pick<SolanaWalletOption, "label" | "installUrl">]
  >).map(([key, metadata]) => {
    const provider = key === "phantom" ? phantomProvider : solflareProvider;

    return {
      key,
      label: metadata.label,
      provider,
      installed: Boolean(provider),
      installUrl: metadata.installUrl,
    };
  });
};

const detachActiveProviderListeners = () => {
  activeProviderCleanup?.();
  activeProviderCleanup = null;
};

const syncConnectedProvider = (
  provider: SolanaWalletProvider | null,
  selectedWallet: SolanaWalletKey | null,
) => {
  const availableWallets = getWalletCandidates();
  const address = getProviderAddress(provider);

  if (address) {
    setProviderAddress(provider, address);
  }

  setState({
    address,
    connected: Boolean(address),
    provider: address ? provider : null,
    selectedWallet: address ? selectedWallet : null,
    availableWallets,
    error: null,
  });
};

const attachProviderListeners = (
  provider: SolanaWalletProvider,
  selectedWallet: SolanaWalletKey,
) => {
  detachActiveProviderListeners();

  if (!provider.on || !provider.removeListener) {
    return;
  }

  const handleConnect = () => {
    syncConnectedProvider(provider, selectedWallet);
  };

  const handleDisconnect = () => {
    setProviderAddress(provider, "");
    detachActiveProviderListeners();
    setState({
      address: "",
      connected: false,
      selectedWallet: null,
      provider: null,
      availableWallets: getWalletCandidates(),
      isConnecting: false,
      error: null,
    });
  };

  const handleAccountChange = () => {
    syncConnectedProvider(provider, selectedWallet);
  };

  provider.on("connect", handleConnect);
  provider.on("disconnect", handleDisconnect);
  provider.on("accountChanged", handleAccountChange);

  activeProviderCleanup = () => {
    provider.removeListener?.("connect", handleConnect);
    provider.removeListener?.("disconnect", handleDisconnect);
    provider.removeListener?.("accountChanged", handleAccountChange);
  };
};

export const refreshSolanaWalletState = () => {
  const availableWallets = getWalletCandidates();
  const connectedWallet = availableWallets.find((wallet) =>
    Boolean(getProviderAddress(wallet.provider)),
  );

  if (!connectedWallet?.provider) {
    detachActiveProviderListeners();
    setState({
      address: "",
      connected: false,
      selectedWallet: null,
      provider: null,
      availableWallets,
      error: null,
    });
    return;
  }

  attachProviderListeners(connectedWallet.provider, connectedWallet.key);
  syncConnectedProvider(connectedWallet.provider, connectedWallet.key);
};

export const openSolanaConnectModal = () => {
  setState({
    availableWallets: getWalletCandidates(),
    modalOpen: true,
    error: null,
  });
};

export const closeSolanaConnectModal = () => {
  setState({
    modalOpen: false,
    error: null,
  });
};

export const connectSolanaWallet = async (walletKey?: SolanaWalletKey) => {
  const availableWallets = getWalletCandidates();
  const nextWallet =
    availableWallets.find((wallet) => wallet.key === walletKey && wallet.installed) ??
    availableWallets.find((wallet) => wallet.installed);

  if (!nextWallet?.provider?.connect) {
    setState({
      availableWallets,
      modalOpen: true,
      error: "No supported Solana wallet was detected. Install Phantom or Solflare.",
    });
    return false;
  }

  try {
    setState({
      availableWallets,
      isConnecting: true,
      selectedWallet: nextWallet.key,
      error: null,
    });

    const result = await nextWallet.provider.connect();
    const address =
      result && typeof result === "object" && "publicKey" in result
        ? result.publicKey?.toString?.() ?? getProviderAddress(nextWallet.provider)
        : result && typeof result === "object" && "address" in result
          ? result.address ?? getProviderAddress(nextWallet.provider)
          : getProviderAddress(nextWallet.provider);

    if (!address) {
      throw new Error(
        "Wallet provider must have a connected address after connection.",
      );
    }

    setProviderAddress(nextWallet.provider, address);
    attachProviderListeners(nextWallet.provider, nextWallet.key);
    setState({
      address,
      connected: true,
      selectedWallet: nextWallet.key,
      provider: nextWallet.provider,
      availableWallets: getWalletCandidates(),
      modalOpen: false,
      isConnecting: false,
      error: null,
    });
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to connect Solana wallet.";

    setState({
      availableWallets: getWalletCandidates(),
      isConnecting: false,
      error: message,
    });
    return false;
  }
};

export const disconnectSolanaWallet = async () => {
  const provider = state.provider;

  try {
    setProviderAddress(provider, "");
    await provider?.disconnect?.();
  } catch (error) {
    console.warn("Failed to disconnect Solana wallet cleanly:", error);
  } finally {
    detachActiveProviderListeners();
    setState({
      address: "",
      connected: false,
      selectedWallet: null,
      provider: null,
      availableWallets: getWalletCandidates(),
      modalOpen: false,
      isConnecting: false,
      error: null,
    });
  }
};

export const getConnectedSolanaProvider = () => state.provider;
export const getConnectedSolanaAddress = () => state.address;

export const useSolanaWallet = () => {
  const walletState = useSyncExternalStore(subscribe, getState, getState);

  return useMemo(
    () => ({
      ...walletState,
      connect: connectSolanaWallet,
      disconnect: disconnectSolanaWallet,
      openConnectModal: openSolanaConnectModal,
      closeConnectModal: closeSolanaConnectModal,
      refresh: refreshSolanaWalletState,
    }),
    [walletState],
  );
};
