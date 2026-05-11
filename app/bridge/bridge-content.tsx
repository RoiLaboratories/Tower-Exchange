"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image, { type StaticImageData } from "next/image";
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
  Loader,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import useBridge from "@/lib/hooks/useBridge";
import { SUPPORTED_CHAINS } from "@/lib/bridgeService";
import { registerBridgeActivity } from "@/lib/supabase";
import { BridgeErrorModal } from "@/components/BridgeErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
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
import TokenInput from "@/components/reusable/TokenInput";

type BridgeToken = {
  symbol: string;
  label: string;
  usdValue: string;
  usdPrice: number;
  logo?: StaticImageData;
};

type BridgeChain = {
  id: string;
  name: string;
  logo?: StaticImageData;
};

type SupportedChainConfig =
  (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];

const getBridgeTokenAddress = (
  chainConfig: SupportedChainConfig,
  tokenSymbol?: string,
) => {
  if (tokenSymbol === "EURC" && "eurcAddress" in chainConfig) {
    return chainConfig.eurcAddress;
  }

  return chainConfig.usdcAddress;
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
  { id: "arc-testnet", name: "Arc Testnet", logo: arcTestnetLogo },
  { id: "base-sepolia", name: "Base Sepolia", logo: baseSepoliaLogo },
  {
    id: "optimism-sepolia",
    name: "Optimism Sepolia",
    logo: optimismSepoliaLogo,
  },
  { id: "avalanche-fuji", name: "Avalanche Fuji", logo: avalancheFujiLogo },
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
  { id: "linea-sepolia", name: "Linea Sepolia", logo: lineaSepoliaLogo },
  { id: "polygon-amoy", name: "Polygon Amoy", logo: polygonAmoyLogo },
  { id: "sonic-testnet", name: "Sonic Testnet", logo: sonicTestnetLogo },
  {
    id: "unichain-sepolia",
    name: "Unichain Sepolia",
    logo: unichainSepoliaLogo,
  },
];

export default function BridgePageContent({
  onNavigateToSwap,
}: {
  onNavigateToSwap?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, authenticated } = useRainbowKitAuth();
  const bridgeHook = useBridge();
  const calculateBridgeDetails = bridgeHook.calculateBridgeDetails;

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
  const [sourceGasBalance, setSourceGasBalance] = useState("0.00");
  const [destinationGasBalance, setDestinationGasBalance] = useState("0.00");
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);

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

  const saveRecentAddress = (address: string) => {
    if (!address.trim()) return;
    const updated = [
      address,
      ...recentAddresses.filter((a) => a !== address),
    ].slice(0, 5);
    setRecentAddresses(updated);
    localStorage.setItem("bridgeRecentAddresses", JSON.stringify(updated));
  };

  useEffect(() => {
    const fromChain = searchParams.get("fromChain");
    const toChain = searchParams.get("toChain");
    const fromTokenParam = searchParams.get("fromToken");
    const toTokenParam = searchParams.get("toToken");

    const selectedFromToken = fromTokenParam
      ? BRIDGE_TOKENS.find((t) => t.symbol === fromTokenParam)
      : BRIDGE_TOKENS[0];
    const selectedToToken = toTokenParam
      ? BRIDGE_TOKENS.find((t) => t.symbol === toTokenParam)
      : BRIDGE_TOKENS[0];

    if (fromChain) {
      setFromToken(selectedFromToken || BRIDGE_TOKENS[0]);
      setFromChainId(fromChain);
    }
    if (toChain) {
      setToToken(selectedToToken || BRIDGE_TOKENS[0]);
      setToChainId(toChain);
    }
  }, [searchParams]);

  const fetchWalletBalance = useCallback(async () => {
    if (!user?.wallet?.address || !fromChainId || !fromToken) {
      setWalletBalance("0.00");
      return;
    }
    try {
      const chainConfig =
        SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) return;
      const tokenAddress = getBridgeTokenAddress(chainConfig, fromToken?.symbol);
      if (!tokenAddress) {
        setWalletBalance("0.00");
        return;
      }
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

  const fetchToChainBalance = useCallback(async () => {
    if (!user?.wallet?.address || !toChainId || !toToken) {
      setToChainBalance("0.00");
      return;
    }
    try {
      const chainConfig =
        SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) return;
      const tokenAddress = getBridgeTokenAddress(chainConfig, toToken?.symbol);
      if (!tokenAddress) {
        setToChainBalance("0.00");
        return;
      }
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

  const fetchNativeGasBalance = useCallback(
    async (chainId: string, address: string) => {
      const chainConfig =
        SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) {
        return "0.00";
      }

      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          chainId,
          rpcUrl: chainConfig.rpcUrl,
          balanceType: "native",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch native gas balance");
      }

      const data = await response.json();
      return data.balance || "0.00";
    },
    [],
  );

  const fetchBridgeGasBalances = useCallback(async () => {
    if (!user?.wallet?.address) {
      setSourceGasBalance("0.00");
      setDestinationGasBalance("0.00");
      return;
    }

    try {
      if (fromChainId) {
        const balance = await fetchNativeGasBalance(
          fromChainId,
          user.wallet.address,
        );
        setSourceGasBalance(balance);
      } else {
        setSourceGasBalance("0.00");
      }

      if (toChainId) {
        const recipientAddress = receivingAddress || user.wallet.address;
        const balance = await fetchNativeGasBalance(
          toChainId,
          recipientAddress,
        );
        setDestinationGasBalance(balance);
      } else {
        setDestinationGasBalance("0.00");
      }
    } catch (error) {
      console.error("Error fetching bridge gas balances:", error);
      setSourceGasBalance("0.00");
      setDestinationGasBalance("0.00");
    }
  }, [
    user?.wallet?.address,
    fromChainId,
    toChainId,
    receivingAddress,
    fetchNativeGasBalance,
  ]);

  useEffect(() => {
    fetchBridgeGasBalances();
  }, [fetchBridgeGasBalances]);

  // Calculate bridge fees and estimated time when chain/amount changes
  const feeTokenSymbol = fromToken?.symbol || "USDC";

  useEffect(() => {
    if (fromChainId && toChainId && fromAmount && parseFloat(fromAmount) > 0) {
      calculateBridgeDetails(
        fromChainId,
        toChainId,
        fromAmount,
        feeTokenSymbol,
      );
    }
  }, [calculateBridgeDetails, fromChainId, toChainId, fromAmount, feeTokenSymbol]);

  useEffect(() => {
    const feeAmount = parseFloat(bridgeHook.estimatedFee);
    const estimated = (parseFloat(fromAmount) - feeAmount).toFixed(2);
    setToAmount(isNaN(parseFloat(estimated)) ? "0.00" : estimated);
  }, [bridgeHook.estimatedFee, fromAmount]);

  const handleFromAmountFocus = () => {
    if (fromAmount === "0.00") setFromAmount("");
  };
  const handleFromAmountBlur = () => {
    if (!fromAmount.trim()) setFromAmount("0.00");
  };

  const handleFiftyPercent = () => {
    if (walletBalance && walletBalance !== "0.00")
      setFromAmount((parseFloat(walletBalance) * 0.5).toFixed(4));
  };

  const handleMaxAmount = () => {
    if (walletBalance && walletBalance !== "0.00") setFromAmount(walletBalance);
  };

  const handleSwapChains = () => {
    setFromChainId(toChainId);
    setToChainId(fromChainId);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleBridge = useCallback(async () => {
    if (!user) {
      alert("Please connect your wallet first");
      return;
    }
    const requestedAmount = Number.parseFloat(fromAmount);
    const availableBalance = Number.parseFloat(walletBalance);
    if (
      Number.isFinite(requestedAmount) &&
      requestedAmount > 0 &&
      requestedAmount > availableBalance
    ) {
      return;
    }

    // Use receiving address if provided, otherwise use connected wallet
    const destinationAddress = receivingAddress || user.wallet?.address;
    const result = await bridgeHook.executeBridge({
      fromChain: fromChainId || "",
      toChain: toChainId || "",
      amount: fromAmount,
      token: fromToken?.symbol || "USDC",
      toAddress: destinationAddress,
      sourceAddress: user.wallet?.address,
    });
    if (result.success) {
      const isPending = result.status === "pending";
      await registerBridgeActivity({
        walletAddress: user.wallet?.address || "",
        fromChain:
          SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS]
            ?.name ||
          fromChainId ||
          "",
        toChain:
          SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS]?.name ||
          toChainId ||
          "",
        amount: fromAmount,
        token: fromToken?.symbol || "USDC",
        transactionHash: result.transactionHash,
        fee: bridgeHook.estimatedFee,
        status: isPending ? "Pending" : "Successful",
      });
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 1000);
      if (!isPending) {
        setTimeout(() => {
          bridgeHook.resetBridgeState();
          setFromAmount("0.00");
          setToAmount("0.00");
          setShowSuccessModal(false);
          fetchWalletBalance();
          fetchToChainBalance();
        }, 8500);
      } else {
        setTimeout(() => {
          setShowSuccessModal(false);
        }, 5000);
      }
    }
  }, [
    user,
    bridgeHook,
    fromChainId,
    toChainId,
    fromAmount,
    fromToken,
    receivingAddress,
    walletBalance,
    fetchWalletBalance,
    fetchToChainBalance,
  ]);

  const fromDisplayToken = fromToken ?? BRIDGE_TOKENS[0];
  const toDisplayToken = toToken ?? BRIDGE_TOKENS[0];
  const requestedBridgeAmount = Number.parseFloat(fromAmount);
  const availableBridgeBalance = Number.parseFloat(walletBalance);
  const isBridgeBalanceInsufficient =
    Boolean(user) &&
    Number.isFinite(requestedBridgeAmount) &&
    requestedBridgeAmount > 0 &&
    requestedBridgeAmount > availableBridgeBalance;
  const fromChain = fromChainId
    ? (BRIDGE_CHAINS.find((c) => c.id === fromChainId) ?? null)
    : null;
  const toChain = toChainId
    ? (BRIDGE_CHAINS.find((c) => c.id === toChainId) ?? null)
    : null;
  const isBridgeActionDisabled =
    !fromChainId ||
    !toChainId ||
    !fromAmount ||
    parseFloat(fromAmount) <= 0 ||
    isBridgeBalanceInsufficient ||
    bridgeHook.isBridging ||
    bridgeHook.isLoading;
  const isBridgeButtonDisabled = user ? isBridgeActionDisabled : false;
  const destinationChainName =
    toChain?.name ??
    (toChainId === "solana" ? "Solana Devnet" : "destination chain");
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
    fromToken?.usdPrice ?? fromDisplayToken.usdPrice,
  );
  const toUsdValueLabel = formatUsdAmount(
    toAmount,
    toToken?.usdPrice ?? toDisplayToken.usdPrice,
  );

  const handleConnectWallet = async () => {
    if (authenticated) return;
    try {
      await login();
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const getBridgeButtonContent = () => {
    if (!user) {
      return "Connect Wallet";
    }

    if (bridgeHook.isBridging) {
      return (
        <>
          <Loader className="h-4 w-4 animate-spin" />
          Bridging...
        </>
      );
    }

    if (isBridgeBalanceInsufficient) {
      return "Insufficient Balance";
    }

    return "Bridge";
  };

  return (
    <>
      <BridgeErrorModal
        error={bridgeHook.error}
        onClose={bridgeHook.clearError}
        onRetry={handleBridge}
        fromChainName={fromChain?.name}
        toChainName={toChain?.name}
        fromGasBalance={sourceGasBalance}
        toGasBalance={destinationGasBalance}
        fromGasTokenSymbol={
          fromChainId
            ? (SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS]
                ?.nativeTokenSymbol ?? null)
            : null
        }
        toGasTokenSymbol={
          toChainId
            ? (SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS]
                ?.nativeTokenSymbol ?? null)
            : null
        }
      />

      <div className="flex w-full items-start justify-center">
        <div className="w-full max-w-md shrink-0">
          <motion.div
            className="bg-[#191A1C] border border-border rounded-2xl px-6 pt-6 pb-3 flex flex-col"
            whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-1 rounded-full bg-[#111214] p-1 relative">
                <motion.span
                  layoutId="activeTab"
                  className="absolute inset-y-1 rounded-full bg-[#1f2125]"
                  style={{ width: "calc(50% - 2px)", left: "calc(50% + 2px)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToSwap ? onNavigateToSwap() : router.push("/")
                  }
                  className="relative px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  Swap
                </button>
                <button
                  type="button"
                  className="relative px-3 py-1.5 text-xs font-medium rounded-full text-foreground z-10"
                >
                  Bridge
                </button>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={() => {
                    setFromAmount("0.00");
                    setToAmount("0.00");
                  }}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  transition={{ duration: 0.5 }}
                >
                  <RefreshCw className="w-5 h-5 text-muted-foreground" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>
            </div>
            <div className="bg-[#151617] rounded-xl p-4 mb-2">
              <div className="flex items-center justify-between mb-2 ">
                <span className="text-sm text-muted-foreground">
                  Bridge from
                </span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="w-4 h-4" />
                  <span>
                    {walletBalance !== "0.00" ? walletBalance : "0.00"}
                  </span>
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

              <div className="flex items-center justify-between gap-2">
                {/* Token + chain selector button */}
                <motion.button
                  type="button"
                  onClick={() => {
                    const current = new URLSearchParams(
                      Array.from(searchParams.entries()),
                    );
                    current.set("side", "from");
                    router.push(`/bridge/select?${current.toString()}`);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative inline-flex h-6 w-6 items-center justify-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 overflow-hidden">
                      {fromToken?.logo && (
                        <Image
                          src={fromToken.logo}
                          alt={`${fromToken.symbol} logo`}
                          width={24}
                          height={24}
                          className="object-contain w-full h-full"
                        />
                      )}
                    </span>
                    {fromChain?.logo && (
                      <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#151617] bg-[#151617] overflow-hidden">
                        <Image
                          src={fromChain.logo}
                          alt={`${fromChain.name} logo`}
                          width={12}
                          height={12}
                          className="object-contain"
                        />
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-white">
                    {fromToken ? fromToken.label : "Select"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.button>

                <TokenInput
                  value={fromAmount}
                  onChange={setFromAmount}
                  onClear={() => setFromAmount("0.00")}
                  usdValueLabel={fromUsdValueLabel}
                />
              </div>
            </div>

            {/* ── Arrow swap button — mirrors SwapCard arrow ── */}
            <div className="flex justify-center -my-6 relative z-10">
              <motion.button
                type="button"
                onClick={handleSwapChains}
                onMouseEnter={() => setIsArrowHovered(true)}
                onMouseLeave={() => setIsArrowHovered(false)}
                className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors"
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowDown className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            </div>

            {/* ── Bridge To — mirrors SwapCard "Receive" section ── */}
            <div className="bg-[#151617] rounded-xl p-4 mt-2 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Bridge to</span>
                {toChainBalance !== "0.00" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wallet className="w-4 h-4" />
                    <span>{toChainBalance}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <motion.button
                  type="button"
                  onClick={() => {
                    const current = new URLSearchParams(
                      Array.from(searchParams.entries()),
                    );
                    current.set("side", "to");
                    router.push(`/bridge/select?${current.toString()}`);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative inline-flex h-6 w-6 items-center justify-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 overflow-hidden">
                      {toToken?.logo && (
                        <Image
                          src={toToken.logo}
                          alt={`${toToken.symbol} logo`}
                          width={24}
                          height={24}
                          className="object-contain w-full h-full"
                        />
                      )}
                    </span>
                    {toChain?.logo && (
                      <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#151617] bg-[#151617] overflow-hidden">
                        <Image
                          src={toChain.logo}
                          alt={`${toChain.name} logo`}
                          width={12}
                          height={12}
                          className="object-contain"
                        />
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-white">
                    {toToken ? toToken.label : "Select"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.button>

                <TokenInput
                  value={toAmount}
                  onChange={setToAmount}
                  onClear={() => setToAmount("0.00")}
                  usdValueLabel={toUsdValueLabel}
                />
              </div>
            </div>

            {/* Add receiving wallet row */}
            <div className="mb-4 inline-flex w-full select-none items-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-xs font-medium text-white pointer-events-none">
              <Plus className="h-3 w-3 text-white" />
              <span className="text-white">Add receiving wallet</span>
            </div>

            {/* Fee + estimated time info */}
            {fromChainId && toChainId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 text-xs text-muted-foreground space-y-1"
              >
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#151617]">
                  <span>Estimated Fee</span>
                  <span className="text-foreground font-medium">
                    {bridgeHook.estimatedFee} {fromDisplayToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#151617]">
                  <span>Estimated Time</span>
                  <span className="text-foreground font-medium">
                    {bridgeHook.estimatedTime}
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── Action button — same sizing/styles as SwapCard ── */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={!user ? handleConnectWallet : handleBridge}
                disabled={isBridgeButtonDisabled}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl h-14 text-base font-semibold transition-all ${
                  isBridgeButtonDisabled
                    ? "bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500"
                    : "bg-primary hover:opacity-90 text-black"
                }`}
              >
                {getBridgeButtonContent()}
              </button>
            </motion.div>
          </motion.div>

          {/* ── Token pills below card — mirrors SwapCard quick-access buttons ── */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {[fromDisplayToken, toDisplayToken].map((token, idx) => (
              <motion.div
                key={`${token.symbol}-${idx}`}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border"
                whileHover={{ scale: 1.05 }}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 overflow-hidden">
                  {token.logo ? (
                    <Image
                      src={token.logo}
                      alt={`${token.symbol} logo`}
                      width={24}
                      height={24}
                      className="object-contain w-full h-full"
                    />
                  ) : null}
                </span>
                <span className="font-medium text-foreground">
                  {token.symbol}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {token.usdValue}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Settings modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            slippageTolerance={slippageTolerance}
            onSlippageChange={setSlippageTolerance}
            title="Bridge Settings"
          />

          {/* Receiving address modal */}
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
                      Enter Destination Address{" "}
                      {toChainId === "solana" && "(Solana)"}
                    </label>
                    <input
                      type="text"
                      value={receivingAddress}
                      onChange={(e) => setReceivingAddress(e.target.value)}
                      placeholder={
                        toChainId === "solana"
                          ? "Enter Solana address..."
                          : "0x..."
                      }
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
                              <span className="text-xs font-medium text-foreground truncate">
                                {address.length > 20
                                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                                  : address}
                              </span>
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
                        <Check
                          className="h-3.5 w-3.5 text-white"
                          strokeWidth={3}
                        />
                      </div>
                      <h2 className="text-[1.05rem] font-medium text-white">
                        Bridge Initiated!
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSuccessModal(false)}
                      className="text-[#b7b8bb] transition-colors hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mb-3 text-[0.95rem] leading-6 text-[#e4e4e6]">
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
                    {bridgeHook.status === "pending" && (
                      <p className="mt-2 text-sm text-[#f59e0b]">
                        ⏳{" "}
                        {bridgeHook.message ||
                          "Your transaction is being settled on-chain. Please wait..."}
                      </p>
                    )}
                  </div>
                  <div className="mb-4 flex items-center gap-1.5 text-xs text-[#a3a4a8]">
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
                      bridgeTransactionUrl ? "grid grid-cols-2 gap-3" : ""
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
                      className={`${bridgeTransactionUrl ? "w-full" : ""} inline-flex h-11 items-center justify-center rounded-full bg-[#6faeff] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#88bbff]`}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
