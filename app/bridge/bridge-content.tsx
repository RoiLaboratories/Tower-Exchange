"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  RefreshCw,
  Settings,
  ChevronDown,
  ExternalLink,
  Plus,
  X,
  Wallet,
  AlertCircle,
  Loader,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import useBridge from "@/lib/hooks/useBridge";
import { SUPPORTED_CHAINS } from "@/lib/bridgeService";
import { registerBridgeActivity } from "@/lib/supabase";
import { usePrivy } from "@privy-io/react-auth";
import { AppErrorModal } from "@/components/AppErrorModal";
import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import arcTestnetLogo from "@/public/assets/Arc Testnet logo.svg";
import baseSepoliaLogo from "@/public/assets/Base Sepolia logo.svg";
import optimismSepoliaLogo from "@/public/assets/Optimism Sepolia logo.svg";
import avalancheFujiLogo from "@/public/assets/Avalanche Fuji logo.svg";
import arbitrumSepoliaLogo from "@/public/assets/Arbitrum Sepolia logo (2).svg";
import ethereumSepoliaLogo from "@/public/assets/EthLogo.svg";
import lineaSepoliaLogo from "@/public/assets/Linea-Token_Round.svg";
import polygonAmoyLogo from "@/public/assets/polygon.svg";
import sonicTestnetLogo from "@/public/assets/S_token.svg";
import unichainSepoliaLogo from "@/public/assets/Testnet.svg";
import { formatUsdAmount } from "@/lib/formatUsdAmount";

type BridgeToken = {
  symbol: string;
  label: string;
  usdValue: string;
  usdPrice: number;
  logo?: any;
};

type BridgeChain = {
  id: string;
  name: string;
  logo?: any;
};

const BRIDGE_TOKENS: BridgeToken[] = [
  {
    symbol: "USDC",
    label: "USDC",
    usdValue: "$1",
    usdPrice: 1,
    logo: usdcLogo,
  },
];

const BRIDGE_CHAINS: BridgeChain[] = [
  // Testnet chains
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    logo: arcTestnetLogo,
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    logo: baseSepoliaLogo,
  },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    logo: optimismSepoliaLogo,
  },
  {
    id: "avalanche-fuji",
    name: "Avalanche Fuji",
    logo: avalancheFujiLogo,
  },
  {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    logo: arbitrumSepoliaLogo,
  },
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    logo: ethereumSepoliaLogo,
  },
  {
    id: "linea-sepolia",
    name: "Linea Sepolia",
    logo: lineaSepoliaLogo,
  },
  {
    id: "polygon-amoy",
    name: "Polygon Amoy",
    logo: polygonAmoyLogo,
  },
  {
    id: "sonic-testnet",
    name: "Sonic Testnet",
    logo: sonicTestnetLogo,
  },
  {
    id: "unichain-sepolia",
    name: "Unichain Sepolia",
    logo: unichainSepoliaLogo,
  },
];

export default function BridgePageContent({ onNavigateToSwap }: { onNavigateToSwap?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, authenticated } = usePrivy();
  const bridgeHook = useBridge();

  const [fromAmount, setFromAmount] = useState("0.00");
  const [toAmount, setToAmount] = useState("0.00");
  const [fromToken, setFromToken] = useState<BridgeToken | null>(null);
  const [toToken, setToToken] = useState<BridgeToken | null>(null);
  const [fromChainId, setFromChainId] = useState<string | null>(null);
  const [toChainId, setToChainId] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingAddress, setReceivingAddress] = useState("");
  const [isArrowHovered, setIsArrowHovered] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState("0.00");
  const [toChainBalance, setToChainBalance] = useState("0.00");
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);

  // Load recent addresses from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("bridgeRecentAddresses");
    if (stored) {
      try {
        setRecentAddresses(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recent addresses", e);
      }
    }
  }, []);

  // Save address to recent addresses when modal closes
  const saveRecentAddress = (address: string) => {
    if (!address.trim()) return;
    const updated = [address, ...recentAddresses.filter(a => a !== address)].slice(0, 5);
    setRecentAddresses(updated);
    localStorage.setItem("bridgeRecentAddresses", JSON.stringify(updated));
  };

  useEffect(() => {
    const fromChain = searchParams.get("fromChain");
    const toChain = searchParams.get("toChain");
    const fromTokenParam = searchParams.get("fromToken");
    const toTokenParam = searchParams.get("toToken");

    // Set tokens from params or default to USDC
    const selectedFromToken = fromTokenParam
      ? BRIDGE_TOKENS.find((t) => t.symbol === fromTokenParam) 
      : BRIDGE_TOKENS[0]; // Default to USDC
    const selectedToToken = toTokenParam
      ? BRIDGE_TOKENS.find((t) => t.symbol === toTokenParam)
      : BRIDGE_TOKENS[0]; // Default to USDC

    if (fromChain) {
      setFromToken(selectedFromToken || BRIDGE_TOKENS[0]);
      setFromChainId(fromChain);
    }
    if (toChain) {
      setToToken(selectedToToken || BRIDGE_TOKENS[0]);
      setToChainId(toChain);
    }
  }, [searchParams]);

  // Fetch wallet balance when chain or user changes
  const fetchWalletBalance = useCallback(async () => {
    if (!user?.wallet?.address || !fromChainId || !fromToken) {
      setWalletBalance("0.00");
      return;
    }

    try {
      // Get chain info for RPC
      const chainConfig = SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) return;

      // Get the token address for the selected token
      const tokenAddress = fromToken?.symbol === "EURC" 
        ? (chainConfig as any).eurcAddress 
        : (chainConfig as any).usdcAddress;

      if (!tokenAddress) {
        console.warn(`${fromToken?.symbol} not available on ${chainConfig.name}`);
        setWalletBalance("0.00");
        return;
      }

      // Fetch token balance
      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: user.wallet.address,
          chainId: fromChainId,
          rpcUrl: chainConfig.rpcUrl,
          tokenAddress,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch balance");
      const data = await response.json();
      setWalletBalance(data.balance || "0.00");
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      setWalletBalance("0.00");
    }
  }, [user?.wallet?.address, fromChainId, fromToken]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  // Fetch wallet balance for destination chain
  const fetchToChainBalance = useCallback(async () => {
    if (!user?.wallet?.address || !toChainId || !toToken) {
      setToChainBalance("0.00");
      return;
    }

    try {
      // Get chain info for RPC
      const chainConfig = SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) return;

      // Get the token address for the selected token
      const tokenAddress = toToken?.symbol === "EURC" 
        ? (chainConfig as any).eurcAddress 
        : (chainConfig as any).usdcAddress;

      if (!tokenAddress) {
        console.warn(`${toToken?.symbol} not available on ${chainConfig.name}`);
        setToChainBalance("0.00");
        return;
      }

      // Fetch token balance
      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: user.wallet.address,
          chainId: toChainId,
          rpcUrl: chainConfig.rpcUrl,
          tokenAddress,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch balance");
      const data = await response.json();
      setToChainBalance(data.balance || "0.00");
    } catch (error) {
      console.error("Error fetching destination chain balance:", error);
      setToChainBalance("0.00");
    }
  }, [user?.wallet?.address, toChainId, toToken]);

  useEffect(() => {
    fetchToChainBalance();
  }, [fetchToChainBalance]);

  // Calculate bridge fees and estimated time when chain/amount changes
  const feeTokenSymbol = fromToken?.symbol || "USDC";

  useEffect(() => {
    if (fromChainId && toChainId && fromAmount && parseFloat(fromAmount) > 0) {
      bridgeHook.calculateBridgeDetails(
        fromChainId,
        toChainId,
        fromAmount,
        feeTokenSymbol
      );
    }
  }, [fromChainId, toChainId, fromAmount, feeTokenSymbol]);

  // Update to amount based on Circle fee calculation
  useEffect(() => {
    const feeAmount = parseFloat(bridgeHook.estimatedFee);
    const estimated = (parseFloat(fromAmount) - feeAmount).toFixed(2);
    setToAmount(isNaN(parseFloat(estimated)) ? "0.00" : estimated);
  }, [bridgeHook.estimatedFee, fromAmount]);

  const handleFromAmountFocus = () => {
    if (fromAmount === "0.00") {
      setFromAmount("");
    }
  };

  const handleFromAmountBlur = () => {
    if (!fromAmount.trim()) {
      setFromAmount("0.00");
    }
  };

  const handleFiftyPercent = () => {
    if (walletBalance && walletBalance !== "0.00") {
      const fiftyPercentAmount = (parseFloat(walletBalance) * 0.5).toFixed(4);
      setFromAmount(fiftyPercentAmount);
    }
  };

  const handleMaxAmount = () => {
    if (walletBalance && walletBalance !== "0.00") {
      setFromAmount(walletBalance);
    }
  };

  const handleSwapChains = () => {
    setFromChainId(toChainId);
    setToChainId(fromChainId);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleBridge = useCallback(async () => {
    // Check wallet connection
    if (!user) {
      alert("Please connect your wallet first");
      return;
    }

    // Use receiving address if provided, otherwise use connected wallet
    const destinationAddress = receivingAddress || user.wallet?.address;

    // Execute bridge
    const result = await bridgeHook.executeBridge({
      fromChain: fromChainId || "",
      toChain: toChainId || "",
      amount: fromAmount,
      token: fromToken?.symbol || "USDC",
      toAddress: destinationAddress,
      sourceAddress: user.wallet?.address,
    });

    if (result.success) {
      // Register bridge transaction in Supabase
      await registerBridgeActivity({
        walletAddress: user.wallet?.address || "",
        fromChain: SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS]?.name || fromChainId || "",
        toChain: SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS]?.name || toChainId || "",
        amount: fromAmount,
        token: fromToken?.symbol || "USDC",
        transactionHash: result.transactionHash,
        fee: bridgeHook.estimatedFee,
        status: "Successful",
      });

      // Show success modal after a small delay
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 1000);
      
      // Reset form and refetch balances after successful bridge
      setTimeout(() => {
        bridgeHook.resetBridgeState();
        setFromAmount("0.00");
        setToAmount("0.00");
        setShowSuccessModal(false);
        
        // Refetch wallet balances after bridge completes
        fetchWalletBalance();
        fetchToChainBalance();
      }, 8500);
    }
  }, [
    user,
    bridgeHook,
    fromChainId,
    toChainId,
    fromAmount,
    fromToken,
    fetchWalletBalance,
    fetchToChainBalance,
  ]);

  const fromDisplayToken = fromToken ?? BRIDGE_TOKENS[0];
  const toDisplayToken = toToken ?? BRIDGE_TOKENS[0];
  const fromChain = fromChainId
    ? BRIDGE_CHAINS.find((c) => c.id === fromChainId) ?? null
    : null;
  const toChain = toChainId
    ? BRIDGE_CHAINS.find((c) => c.id === toChainId) ?? null
    : null;
  const isBridgeActionDisabled =
    !fromChainId ||
    !toChainId ||
    !fromAmount ||
    parseFloat(fromAmount) <= 0 ||
    bridgeHook.isBridging ||
    bridgeHook.isLoading;
  const isBridgeButtonDisabled = user ? isBridgeActionDisabled : false;
  const destinationChainName =
    toChain?.name ?? (toChainId === "solana" ? "Solana Devnet" : "destination chain");
  const bridgeExplorerUrls: Record<string, string> = {
    "arc-testnet": "https://testnet.arcscan.app/tx/",
    "base-sepolia": "https://sepolia.basescan.org/tx/",
    "optimism-sepolia": "https://sepolia-optimism.etherscan.io/tx/",
    "avalanche-fuji": "https://testnet.snowtrace.io/tx/",
    "arbitrum-sepolia": "https://sepolia.arbiscan.io/tx/",
    "ethereum-sepolia": "https://sepolia.etherscan.io/tx/",
    "linea-sepolia": "https://sepolia.lineascan.build/tx/",
    "polygon-amoy": "https://amoy.polygonscan.com/tx/",
    "sonic-testnet": "https://testnet.sonicscan.org/tx/",
    "unichain-sepolia": "https://unichain-sepolia.blockscout.com/tx/",
  };
  const bridgeTransactionUrl =
    bridgeHook.transactionHash && toChainId && bridgeExplorerUrls[toChainId]
      ? `${bridgeExplorerUrls[toChainId]}${bridgeHook.transactionHash}`
      : null;
  const fromUsdValueLabel = formatUsdAmount(
    fromAmount,
    fromToken?.usdPrice ?? fromDisplayToken.usdPrice
  );
  const toUsdValueLabel = formatUsdAmount(
    toAmount,
    toToken?.usdPrice ?? toDisplayToken.usdPrice
  );

  const handleConnectWallet = async () => {
    if (authenticated) return;
    try {
      await login();
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  return (
    <>
      <AppErrorModal 
        error={bridgeHook.error} 
        onClose={bridgeHook.clearError} 
        title="Bridge operation failed" 
      />
      <div className="h-full">
        <div className="relative rounded-2xl border border-border bg-[#191A1C] px-6 pt-5 pb-6 overflow-hidden overflow-y-auto h-full flex flex-col">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
                <div className="inline-flex items-center gap-1 rounded-full bg-[#111214] p-1">
              <button
                type="button"
                onClick={() => onNavigateToSwap ? onNavigateToSwap() : router.push("/")}
                className="px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-[#1b1d21] transition-colors"
              >
                Swap
              </button>
            <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#1f2125] text-foreground"
              >
                Bridge
              </button>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <motion.button
                type="button"
                onClick={() => {
                  setFromAmount("0.00");
                  setToAmount("0.00");
                }}
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] transition-colors"
              >
                <RefreshCw className="h-5 w-5" />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.3 }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] transition-colors"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </div>
          </div>

          {/* Bridge from */}
          <section className="rounded-2xl bg-[#151617] px-4 py-3 mb-2 border border-border/50">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Bridge from</span>
              <div className="flex items-center gap-2">
                {walletBalance !== "0.00" && (
                  <div className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    <span>{walletBalance}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleFiftyPercent}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Token selector */}
              <button
                type="button"
                onClick={() => {
                  const current = new URLSearchParams(
                    Array.from(searchParams.entries())
                  );
                  current.set("side", "from");
                  router.push(`/bridge/select?${current.toString()}`);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1b1c1f] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#222327] transition-colors"
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                    {fromToken?.logo && (
                      <Image
                        src={fromToken.logo}
                        alt={`${fromToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                      />
                    )}
                  </span>
                  {fromChain?.logo && (
                    <span className="absolute -bottom-1 right-0 inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#111214] bg-[#111214] overflow-hidden">
                      <Image
                        src={fromChain.logo}
                        alt={`${fromChain.name} logo`}
                        width={12}
                        height={12}
                        className="h-3 w-3 object-contain"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {fromToken ? fromToken.label : "Select Token"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Amount */}
              <div className="text-right flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  onFocus={handleFromAmountFocus}
                  onBlur={handleFromAmountBlur}
                  className="w-full bg-transparent text-right text-2xl font-semibold text-foreground outline-none border-0 focus:ring-0"
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  {fromUsdValueLabel}
                </p>
              </div>
            </div>
          </section>

          {/* Arrow separator */}
          <div className="flex justify-center my-1">
            <motion.button
              type="button"
              onClick={handleSwapChains}
              onMouseEnter={() => setIsArrowHovered(true)}
              onMouseLeave={() => setIsArrowHovered(false)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#151617] border border-border/60 hover:bg-[#1f2125] transition-colors"
            >
              <motion.div
                initial={{ rotateX: 0 }}
                animate={{ rotateX: isArrowHovered ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                style={{ perspectiveOrigin: "center" }}
              >
                {isArrowHovered ? (
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                )}
              </motion.div>
            </motion.button>
          </div>

          {/* Bridge to */}
          <section className="rounded-2xl bg-[#151617] px-4 py-3 mb-3 border border-border/50">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Bridge to</span>
              {toChainBalance !== "0.00" && (
                <div className="flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  <span>{toChainBalance}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Token selector */}
              <button
                type="button"
                onClick={() => {
                  const current = new URLSearchParams(
                    Array.from(searchParams.entries())
                  );
                  current.set("side", "to");
                  router.push(`/bridge/select?${current.toString()}`);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1b1c1f] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#222327] transition-colors"
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                    {toToken?.logo && (
                      <Image
                        src={toToken.logo}
                        alt={`${toToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                      />
                    )}
                  </span>
                  {toChain?.logo && (
                    <span className="absolute -bottom-1 right-0 inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#111214] bg-[#111214] overflow-hidden">
                      <Image
                        src={toChain.logo}
                        alt={`${toChain.name} logo`}
                        width={12}
                        height={12}
                        className="h-3 w-3 object-contain"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {toToken ? toToken.label : "Select Token"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Amount */}
              <div className="text-right flex-1">
                <p className="text-2xl font-semibold text-foreground">
                  {toAmount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {toUsdValueLabel}
                </p>
              </div>
            </div>
          </section>

          <div className="mb-4 inline-flex w-full select-none items-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-xs font-medium text-white pointer-events-none">
            <Plus className="h-3 w-3 text-white" />
            <span className="text-white">Add receiving wallet</span>
          </div>

          {/* Circle fee and estimated time info */}
          {fromChainId && toChainId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 text-xs text-muted-foreground space-y-1"
            >
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#18191c]">
                <span>Estimated Fee:</span>
                <span className="text-foreground font-medium">
                  {bridgeHook.estimatedFee} {fromDisplayToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#18191c]">
                <span>Estimated Time:</span>
                <span className="text-foreground font-medium">
                  {bridgeHook.estimatedTime}
                </span>
              </div>
            </motion.div>
          )}

          {/* Primary bridge button */}
          <button
            type="button"
            onClick={!user ? handleConnectWallet : handleBridge}
            disabled={isBridgeButtonDisabled}
            className={`inline-flex items-center justify-center gap-2 w-full rounded-xl h-14 text-base font-semibold transition-all ${
              isBridgeButtonDisabled
                ? "bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500"
                : "bg-primary hover:opacity-90 text-black"
            }`}
          >
            {!user ? (
              <span>Connect Wallet</span>
            ) : (
              <>
                {bridgeHook.isBridging && (
                  <Loader className="h-4 w-4 animate-spin" />
                )}
                {bridgeHook.isBridging ? "Bridging..." : "Bridge"}
              </>
            )}
          </button>

          {/* Bottom token pills (reflect current selection, not interactive) */}
          <div className="mt-5 flex items-center justify-center gap-3">
            {[fromDisplayToken, toDisplayToken].map((token, idx) => (
              <div
                key={`${token.symbol}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#151617] px-3 py-1.5 text-xs font-medium text-foreground/90 border border-border/60"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#232428] overflow-hidden">
                  {token.logo ? (
                    <Image
                      src={token.logo}
                      alt={`${token.symbol} logo`}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                  ) : null}
                </span>
                <span>{token.symbol}</span>
                <span className="text-muted-foreground text-[11px]">
                  {token.usdValue}
                </span>
              </div>
            ))}
          </div>

          {/* Soft background glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-60" />
        </div>

      {/* Slippage settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        slippageTolerance={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
        title="Bridge Settings"
      />
      {isReceivingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm rounded-2xl bg-[#111214] border border-border/70 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">
                Receiving Address
              </h2>
              <button
                type="button"
                onClick={() => setIsReceivingOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#18191c] hover:bg-[#202225] text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3 space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">
                  Enter Destination Address {toChainId === "solana" && "(Solana)"}
                </label>
                <input
                  type="text"
                  value={receivingAddress}
                  onChange={(e) => setReceivingAddress(e.target.value)}
                  placeholder={toChainId === "solana" ? "Enter Solana address..." : "0x..."}
                  className="w-full rounded-xl bg-[#18191c] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 border border-border/70 focus:outline-none focus:border-border"
                />
              </div>
              <button
                type="button"
                disabled={!receivingAddress.trim()}
                onClick={() => {
                  saveRecentAddress(receivingAddress);
                  setIsReceivingOpen(false);
                }}
                className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#1b1c1f] py-2.5 text-xs font-semibold text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#222327] hover:text-foreground transition-colors"
              >
                Done
              </button>
            </div>

            <div className="px-5 pt-1 pb-4">
              {recentAddresses.length > 0 && (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground mb-2">
                    Recent Addresses
                  </p>
                  <div className="space-y-2">
                    {recentAddresses.map((address) => (
                      <button
                        key={address}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-[#18191c] transition-colors"
                        onClick={() => setReceivingAddress(address)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#232428] flex-shrink-0">
                            <Wallet className="h-3.5 w-3.5 text-foreground" />
                          </span>
                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-xs font-medium text-foreground truncate">
                              {address.length > 20
                                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                                : address}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
        </motion.div>
      </div>
      )}
      {/* Bridge success modal */}
      {showSuccessModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.28 }}
            className="fixed left-1/2 top-6 z-50 w-[min(95vw,27rem)] -translate-x-1/2"
          >
            <div className="rounded-[1.75rem] border border-white/10 bg-[#1d1d1f]/90 px-4 py-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1dd75f]">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <h2 className="text-[1.05rem] font-medium text-white">
                  Bridge Initiated!
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="text-[#b7b8bb] transition-colors hover:text-white"
                aria-label="Close bridge success notification"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 pl-9 text-[0.95rem] leading-6 text-[#e4e4e6]">
              <p>
                Your tokens are being bridged to{" "}
                <span className="font-semibold text-white">
                  {destinationChainName}
                </span>
              </p>
              <p className="text-sm text-[#a3a4a8]">
                Estimated time:{" "}
                <span className="font-semibold text-white">
                  {bridgeHook.estimatedTime}
                </span>
              </p>
            </div>

            <div className="mb-4 flex items-center gap-1.5 pl-9 text-xs text-[#a3a4a8]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#a3a4a8]"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Via Tower</span>
            </div>

            {bridgeHook.transactionHash && (
              <div className="mb-4 break-all rounded-xl bg-[#151517] px-3 py-3 text-left text-[11px] leading-5 text-[#c5c6ca]">
                TX: {bridgeHook.transactionHash}
              </div>
            )}

            <div
              className={
                bridgeTransactionUrl
                  ? "grid grid-cols-2 gap-3 pl-9"
                  : "pl-9"
              }
            >
              {bridgeTransactionUrl ? (
                <a
                  href={bridgeTransactionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-100"
                >
                  <span>View Transaction</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-black" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className={`${
                  bridgeTransactionUrl ? "w-full" : ""
                } inline-flex h-11 items-center justify-center rounded-full bg-[#6faeff] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#88bbff]`}
              >
                Done
              </button>
            </div>

            <div
              className="hidden"
            >
              {bridgeTransactionUrl ? (
                <a
                  href={bridgeTransactionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[0] transition-colors hover:bg-gray-100"
                >
                  View Transaction ↗
                  <span className="text-sm font-medium text-black">
                    View Transaction
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-black" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className={`${
                  bridgeTransactionUrl ? "w-full" : ""
                } inline-flex h-11 items-center justify-center rounded-full bg-[#6faeff] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#88bbff]`}
              >
                Done
              </button>
            </div>
            </div>
          </motion.div>
        </>
      )}
      </div>
    </>
  );
}
