"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image, { type StaticImageData } from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  RefreshCw,
  Settings,
  ChevronDown,
  ExternalLink,
  Plus,
  X,
  Wallet,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import useBridge from "@/lib/hooks/useBridge";
import { SUPPORTED_CHAINS, isValidAddress } from "@/lib/bridgeService";
import { registerBridgeActivity, registerBridgeFee } from "@/lib/supabase";
import { BridgeErrorModal } from "@/components/BridgeErrorModal";
import ActivityTabModal, {
  type ActivityTabLiveItem,
} from "@/components/ActivityTabModal";
import TransactionStepsModal, {
  type TransactionStep,
} from "@/components/TransactionStepsModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import { useSolanaWallet } from "@/lib/solanaWalletStore";
import usdcLogo from "@/public/assets/usdc.svg";
import arcTestnetLogo from "@/public/assets/ARCSvg.svg";
import solanaLogo from "@/public/assets/solana.svg";
import baseSepoliaLogo from "@/public/assets/Base Sepolia logo.svg";
import optimismSepoliaLogo from "@/public/assets/Optimism Sepolia logo.svg";
import avalancheFujiLogo from "@/public/assets/Avalanche Fuji logo.svg";
import arbitrumSepoliaLogo from "@/public/assets/Arbitrum Sepolia logo (2).svg";
import ethereumSepoliaLogo from "@/public/assets/EthLogo.svg";
import lineaSepoliaLogo from "@/public/assets/Linea-Token_Round.svg";
import polygonAmoyLogo from "@/public/assets/polygon.svg";
import sonicTestnetLogo from "@/public/assets/S_token.svg";
import unichainSepoliaLogo from "@/public/assets/Mainnet.svg";
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

type BridgeStepsStep = "approve" | "burn" | "attestation" | "wait" | "mint";
type BridgeStepsPhase = BridgeStepsStep | "success" | "failed";

const BRIDGE_SUCCESS_MODAL_DELAY_MS = 700;
const BRIDGE_SUCCESS_MODAL_DURATION_MS = 12000;
const BRIDGE_PENDING_MODAL_DURATION_MS = 9000;

const getBridgeShortChainName = (chainName: string) =>
  chainName
    .replace(/\s+(Sepolia|Testnet|Devnet)$/i, "")
    .replace(/\s+Fuji$/i, "");

const formatBridgeStepAmount = (amount: string) => {
  const numericAmount = Number.parseFloat(amount);

  if (!Number.isFinite(numericAmount)) {
    return amount || "0.00";
  }

  return numericAmount.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
};

const getBridgeStepFromProgress = (step?: string): BridgeStepsStep | null => {
  const normalizedStep = step?.toLowerCase() || "";

  if (!normalizedStep) {
    return null;
  }

  if (normalizedStep.includes("mint")) {
    return "mint";
  }

  if (normalizedStep.includes("attestation")) {
    return "attestation";
  }

  if (
    normalizedStep.includes("burn") ||
    normalizedStep.includes("depositforburn")
  ) {
    return "burn";
  }

  if (normalizedStep.includes("approve")) {
    return "approve";
  }

  return null;
};

const isBridgeStepComplete = (
  phase: BridgeStepsPhase,
  step: BridgeStepsStep,
) => {
  if (phase === "success") {
    return true;
  }

  const order: BridgeStepsStep[] = [
    "approve",
    "burn",
    "attestation",
    "wait",
    "mint",
  ];
  const phaseIndex = order.indexOf(phase as BridgeStepsStep);
  const stepIndex = order.indexOf(step);

  return phaseIndex > stepIndex;
};

const getBridgeStepStatus = (
  phase: BridgeStepsPhase,
  failedPhase: BridgeStepsStep,
  step: BridgeStepsStep,
): TransactionStep["status"] => {
  if (phase === "failed") {
    return step === failedPhase
      ? "failed"
      : isBridgeStepComplete(failedPhase, step)
        ? "complete"
        : "pending";
  }

  if (phase === "success") {
    return "complete";
  }

  if (step === phase) {
    return "active";
  }

  return isBridgeStepComplete(phase, step) ? "complete" : "pending";
};

const getBridgeTokenAddress = (
  chainConfig: SupportedChainConfig,
  tokenSymbol?: string,
): string | null => {
  if (tokenSymbol === "EURC" && "eurcAddress" in chainConfig) {
    return typeof chainConfig.eurcAddress === "string"
      ? chainConfig.eurcAddress
      : null;
  }

  return typeof chainConfig.usdcAddress === "string"
    ? chainConfig.usdcAddress
    : null;
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
  { id: "solana", name: "Solana Devnet", logo: solanaLogo },
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
  const {
    address: solanaAddress,
    connected: isSolanaConnected,
    isConnecting: isConnectingSolana,
    openConnectModal: openSolanaConnectModal,
  } = useSolanaWallet();
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
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingAddress, setReceivingAddress] = useState("");
  const [isArrowHovered, setIsArrowHovered] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bridgeStepsModalOpen, setBridgeStepsModalOpen] = useState(false);
  const [bridgeStepsPhase, setBridgeStepsPhase] =
    useState<BridgeStepsPhase>("approve");
  const [bridgeStepsFailedPhase, setBridgeStepsFailedPhase] =
    useState<BridgeStepsStep>("approve");
  const [bridgeStepsFailureMessage, setBridgeStepsFailureMessage] =
    useState<string | null>(null);
  const [bridgeStepsDetails, setBridgeStepsDetails] = useState({
    amount: "0.00",
    tokenSymbol: "USDC",
    tokenIcon: usdcLogo as StaticImageData | undefined,
    destinationAmount: "0.00",
    sourceChainName: "source chain",
    destinationChainName: "destination chain",
    destinationChainLogo: undefined as StaticImageData | undefined,
  });
  const [bridgeActivityStartedAt, setBridgeActivityStartedAt] = useState<
    number | null
  >(null);
  const [walletBalance, setWalletBalance] = useState("0.00");
  const [toChainBalance, setToChainBalance] = useState("0.00");
  const [sourceGasBalance, setSourceGasBalance] = useState("0.00");
  const [destinationGasBalance, setDestinationGasBalance] = useState("0.00");
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const swapNavigationStartedRef = useRef(false);
  const latestBridgeStepRef = useRef<BridgeStepsStep>("approve");
  const previousFromChainIdRef = useRef<string | null>(null);
  const previousToChainIdRef = useRef<string | null>(null);

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

  const getBridgeAddressForChain = useCallback(
    (chainId: string | null, fallbackAddress?: string | null) => {
      if (!chainId) {
        return fallbackAddress || "";
      }

      if (chainId === "solana") {
        return solanaAddress || "";
      }

      return fallbackAddress || "";
    },
    [solanaAddress],
  );

  const getDestinationBridgeAddress = useCallback(
    (chainId: string | null, fallbackAddress?: string | null) => {
      const manualAddress = receivingAddress.trim();
      const chainType = chainId === "solana" ? "solana" : "evm";

      if (manualAddress && isValidAddress(manualAddress, chainType)) {
        return manualAddress;
      }

      if (chainId === "solana" || fromChainId === "solana") {
        return "";
      }

      return getBridgeAddressForChain(chainId, fallbackAddress);
    },
    [fromChainId, getBridgeAddressForChain, receivingAddress],
  );

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

  useEffect(() => {
    const previousFromChainId = previousFromChainIdRef.current;

    if (
      previousFromChainId &&
      previousFromChainId !== fromChainId &&
      fromChainId === "solana" &&
      !isSolanaConnected &&
      !isConnectingSolana
    ) {
      openSolanaConnectModal();
    }

    previousFromChainIdRef.current = fromChainId;
  }, [
    fromChainId,
    isConnectingSolana,
    isSolanaConnected,
    openSolanaConnectModal,
  ]);

  useEffect(() => {
    const previousToChainId = previousToChainIdRef.current;
    const manualAddress = receivingAddress.trim();

    if (
      previousToChainId &&
      previousToChainId !== toChainId &&
      manualAddress &&
      toChainId
    ) {
      const chainType = toChainId === "solana" ? "solana" : "evm";
      if (!isValidAddress(manualAddress, chainType)) {
        setReceivingAddress("");
      }
    }

    previousToChainIdRef.current = toChainId;
  }, [toChainId, receivingAddress]);

  const fetchWalletBalance = useCallback(async () => {
    if (!fromChainId || !fromToken) {
      setWalletBalance("0.00");
      return;
    }

    if (fromChainId === "solana" && !isSolanaConnected) {
      setWalletBalance("0.00");
      return;
    }

    const sourceAddress = getBridgeAddressForChain(
      fromChainId,
      user?.wallet?.address,
    );

    if (!sourceAddress) {
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
          address: sourceAddress,
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
  }, [getBridgeAddressForChain, isSolanaConnected, user?.wallet?.address, fromChainId, fromToken]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const fetchToChainBalance = useCallback(async () => {
    if (!toChainId || !toToken) {
      setToChainBalance("0.00");
      return;
    }

    const destinationAddress = getDestinationBridgeAddress(
      toChainId,
      user?.wallet?.address,
    );

    if (!destinationAddress) {
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
          address: destinationAddress,
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
  }, [getDestinationBridgeAddress, user?.wallet?.address, toChainId, toToken]);

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
    try {
      if (fromChainId) {
        if (fromChainId === "solana" && !isSolanaConnected) {
          setSourceGasBalance("0.00");
        } else {
          const sourceAddress = getBridgeAddressForChain(
            fromChainId,
            user?.wallet?.address,
          );

          if (sourceAddress) {
            const balance = await fetchNativeGasBalance(fromChainId, sourceAddress);
            setSourceGasBalance(balance);
          } else {
            setSourceGasBalance("0.00");
          }
        }
      } else {
        setSourceGasBalance("0.00");
      }

      if (toChainId) {
        const destinationAddress = getDestinationBridgeAddress(
          toChainId,
          user?.wallet?.address,
        );

        if (destinationAddress) {
          const balance = await fetchNativeGasBalance(
            toChainId,
            destinationAddress,
          );
          setDestinationGasBalance(balance);
        } else {
          setDestinationGasBalance("0.00");
        }
      } else {
        setDestinationGasBalance("0.00");
      }
    } catch (error) {
      console.error("Error fetching bridge gas balances:", error);
      setSourceGasBalance("0.00");
      setDestinationGasBalance("0.00");
    }
  }, [
    getBridgeAddressForChain,
    getDestinationBridgeAddress,
    isSolanaConnected,
    user?.wallet?.address,
    fromChainId,
    toChainId,
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
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount("0.00");
      return;
    }

    const estimatedReceivedAmount = parseFloat(bridgeHook.estimatedReceivedAmount);
    setToAmount(
      Number.isFinite(estimatedReceivedAmount)
        ? Math.max(estimatedReceivedAmount, 0).toFixed(2)
        : "0.00",
    );
  }, [bridgeHook.estimatedReceivedAmount, fromAmount]);

  const handleFromAmountFocus = () => {
    if (fromAmount === "0.00") setFromAmount("");
  };
  const handleFromAmountBlur = () => {
    if (!fromAmount.trim()) setFromAmount("0.00");
  };

  const handleFiftyPercent = () => {
    const availableBalance = Number.parseFloat(walletBalance);
    const platformFee = Number.parseFloat(bridgeHook.estimatedPlatformFee);
    const maxTransferableAmount = Number.isFinite(availableBalance)
      ? Math.max(
          availableBalance - (Number.isFinite(platformFee) ? platformFee : 0),
          0,
        )
      : 0;

    if (maxTransferableAmount > 0) {
      setFromAmount((maxTransferableAmount * 0.5).toFixed(4));
    }
  };

  const handleMaxAmount = () => {
    const availableBalance = Number.parseFloat(walletBalance);
    const platformFee = Number.parseFloat(bridgeHook.estimatedPlatformFee);
    const maxTransferableAmount = Number.isFinite(availableBalance)
      ? Math.max(
          availableBalance - (Number.isFinite(platformFee) ? platformFee : 0),
          0,
        )
      : 0;

    setFromAmount(maxTransferableAmount > 0 ? maxTransferableAmount.toFixed(4) : "0.00");
  };

  const handleSwapChains = () => {
    const nextFromChainId = toChainId;
    const nextToChainId = fromChainId;

    setFromChainId(nextFromChainId);
    setToChainId(nextToChainId);
    setFromAmount(toAmount);
    setToAmount(fromAmount);

    const manualAddress = receivingAddress.trim();
    if (manualAddress && nextToChainId) {
      const chainType = nextToChainId === "solana" ? "solana" : "evm";
      if (!isValidAddress(manualAddress, chainType)) {
        setReceivingAddress("");
      }
    }
  };

  const openBridgeStepsModal = useCallback(() => {
    const sourceChain = BRIDGE_CHAINS.find((chain) => chain.id === fromChainId);
    const destinationChain = BRIDGE_CHAINS.find((chain) => chain.id === toChainId);

    setBridgeStepsDetails({
      amount: fromAmount,
      tokenSymbol: fromToken?.symbol || "USDC",
      tokenIcon: fromToken?.logo || usdcLogo,
      destinationAmount: toAmount,
      sourceChainName: sourceChain?.name || "source chain",
      destinationChainName: destinationChain?.name || "destination chain",
      destinationChainLogo: destinationChain?.logo,
    });
    setBridgeStepsFailureMessage(null);
    setBridgeStepsFailedPhase("approve");
    setBridgeStepsPhase("approve");
    latestBridgeStepRef.current = "approve";
    setBridgeActivityStartedAt(Date.now());
    setShowSuccessModal(false);
    setBridgeStepsModalOpen(true);
  }, [fromAmount, fromChainId, fromToken?.logo, fromToken?.symbol, toAmount, toChainId]);

  const handleBridge = useCallback(async () => {
    if (fromChainId === "solana" && !isSolanaConnected) {
      openSolanaConnectModal();
      return;
    }

    if (!user && fromChainId !== "solana") {
      alert("Please connect your wallet first");
      return;
    }

    const sourceAddress = getBridgeAddressForChain(
      fromChainId,
      user?.wallet?.address,
    );
    const destinationAddress = getDestinationBridgeAddress(
      toChainId,
      user?.wallet?.address,
    );
    const requestedAmount = Number.parseFloat(fromAmount);
    const availableBalance = Number.parseFloat(walletBalance);
    const platformFee = Number.parseFloat(bridgeHook.estimatedPlatformFee);
    const requiredSourceBalance =
      Number.isFinite(requestedAmount) && requestedAmount > 0
        ? requestedAmount + (Number.isFinite(platformFee) ? platformFee : 0)
        : 0;
    if (
      sourceAddress &&
      Number.isFinite(requiredSourceBalance) &&
      requiredSourceBalance > 0 &&
      requiredSourceBalance > availableBalance
    ) {
      return;
    }

    openBridgeStepsModal();
    const result = await bridgeHook.executeBridge({
      fromChain: fromChainId || "",
      toChain: toChainId || "",
      amount: fromAmount,
      token: fromToken?.symbol || "USDC",
      toAddress: destinationAddress,
      sourceAddress: sourceAddress || user?.wallet?.address,
      onProgress: (progress) => {
        const progressStep =
          getBridgeStepFromProgress(progress.lastStep) ||
          getBridgeStepFromProgress(
            progress.events[progress.events.length - 1]?.step,
          );

        if (progressStep) {
          latestBridgeStepRef.current = progressStep;
          setBridgeStepsPhase(progressStep);
        }
      },
    });
    if (!result.success) {
      setBridgeStepsFailedPhase(latestBridgeStepRef.current);
      setBridgeStepsFailureMessage(result.error || "Bridge failed");
      setBridgeStepsPhase("failed");
      return;
    }

    if (result.success) {
      const isPending = result.status === "pending";
      if (isPending) {
        const pendingStep =
          latestBridgeStepRef.current === "mint" ? "mint" : "wait";
        latestBridgeStepRef.current = pendingStep;
        setBridgeStepsPhase(pendingStep);
      } else {
        setBridgeStepsPhase("success");
      }

      const activityWalletAddress =
        user?.wallet?.address ||
        (toChainId !== "solana" ? destinationAddress : "") ||
        (fromChainId !== "solana" ? sourceAddress : "");
      const fromChainName =
        SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS]?.name ||
        fromChainId ||
        "";
      const toChainName =
        SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS]?.name ||
        toChainId ||
        "";
      const tokenSymbol = fromToken?.symbol || "USDC";
      const fromChainConfig = fromChainId
        ? SUPPORTED_CHAINS[fromChainId as keyof typeof SUPPORTED_CHAINS]
        : null;
      const toChainConfig = toChainId
        ? SUPPORTED_CHAINS[toChainId as keyof typeof SUPPORTED_CHAINS]
        : null;
      const sourceTokenAddress = fromChainConfig
        ? getBridgeTokenAddress(fromChainConfig, tokenSymbol)
        : null;
      const destinationTokenAddress = toChainConfig
        ? getBridgeTokenAddress(toChainConfig, tokenSymbol)
        : null;
      const bridgeFeeRecipientAddress = bridgeHook.customFeeEnabled
        ? fromChainId === "solana"
          ? process.env.NEXT_PUBLIC_BRIDGE_FEE_RECIPIENT_SOLANA?.trim() || null
          : process.env.NEXT_PUBLIC_BRIDGE_FEE_RECIPIENT_EVM?.trim() || null
        : null;

      if (activityWalletAddress) {
        const activityResult = await registerBridgeActivity({
          walletAddress: activityWalletAddress,
          fromChain: fromChainName,
          toChain: toChainName,
          amount: fromAmount,
          token: tokenSymbol,
          transactionHash: result.transactionHash,
          fee: bridgeHook.estimatedFee,
          status: isPending ? "Pending" : "Successful",
        });

        await registerBridgeFee({
          walletAddress: activityWalletAddress,
          fromChain: fromChainName,
          toChain: toChainName,
          sourceTokenAddress,
          destinationTokenAddress,
          tokenSymbol,
          bridgeAmount: fromAmount,
          platformFeeAmount: bridgeHook.estimatedPlatformFee,
          platformFeeAmountUsd: bridgeHook.estimatedPlatformFee,
          protocolFeeAmount: bridgeHook.estimatedCircleFee,
          protocolFeeAmountUsd: bridgeHook.estimatedCircleFee,
          totalFeeAmount: bridgeHook.estimatedFee,
          totalFeeAmountUsd: bridgeHook.estimatedFee,
          amountReceived: bridgeHook.estimatedReceivedAmount,
          sourceDebitTotal: bridgeHook.estimatedSourceDebit,
          feeType: "Flat",
          feeRecipientAddress: bridgeFeeRecipientAddress,
          protocolProvider: "Circle",
          transactionHash: result.transactionHash,
          status: isPending ? "Pending" : "Recorded",
          activityId: activityResult.id ?? null,
        });
      }

      setTimeout(() => {
        setBridgeStepsModalOpen(false);
        setShowSuccessModal(true);
      }, BRIDGE_SUCCESS_MODAL_DELAY_MS);

      if (!isPending) {
        setTimeout(() => {
          bridgeHook.resetBridgeState();
          setFromAmount("0.00");
          setToAmount("0.00");
          setShowSuccessModal(false);
          setBridgeStepsModalOpen(false);
          fetchWalletBalance();
          fetchToChainBalance();
        }, BRIDGE_SUCCESS_MODAL_DURATION_MS);
      } else {
        setTimeout(() => {
          setShowSuccessModal(false);
        }, BRIDGE_PENDING_MODAL_DURATION_MS);
      }
    }
  }, [
    user,
    bridgeHook,
    fromChainId,
    toChainId,
    fromAmount,
    fromToken,
    walletBalance,
    fetchWalletBalance,
    fetchToChainBalance,
    getBridgeAddressForChain,
    getDestinationBridgeAddress,
    isSolanaConnected,
    openBridgeStepsModal,
    openSolanaConnectModal,
  ]);

  const fromDisplayToken = fromToken ?? BRIDGE_TOKENS[0];
  const toDisplayToken = toToken ?? BRIDGE_TOKENS[0];
  const sourceBridgeAddress =
    fromChainId === "solana"
      ? isSolanaConnected
        ? getBridgeAddressForChain(fromChainId, user?.wallet?.address)
        : ""
      : getBridgeAddressForChain(fromChainId, user?.wallet?.address);
  const destinationBridgeAddress = getDestinationBridgeAddress(
    toChainId,
    user?.wallet?.address,
  );
  const requestedBridgeAmount = Number.parseFloat(fromAmount);
  const availableBridgeBalance = Number.parseFloat(walletBalance);
  const platformFeeAmount = Number.parseFloat(bridgeHook.estimatedPlatformFee);
  const requiredSourceBalance =
    Number.isFinite(requestedBridgeAmount) && requestedBridgeAmount > 0
      ? requestedBridgeAmount +
        (Number.isFinite(platformFeeAmount) ? platformFeeAmount : 0)
      : 0;
  const isBridgeBalanceInsufficient =
    Boolean(sourceBridgeAddress) &&
    Number.isFinite(requiredSourceBalance) &&
    requiredSourceBalance > 0 &&
    requiredSourceBalance > availableBridgeBalance;
  const fromChain = fromChainId
    ? (BRIDGE_CHAINS.find((c) => c.id === fromChainId) ?? null)
    : null;
  const toChain = toChainId
    ? (BRIDGE_CHAINS.find((c) => c.id === toChainId) ?? null)
    : null;
  const requiresManualDestinationAddress =
    Boolean(toChainId) && (toChainId === "solana" || fromChainId === "solana");
  const isDestinationAddressMissing =
    requiresManualDestinationAddress && !destinationBridgeAddress;
  const isBridgeActionDisabled =
    !fromChainId ||
    !toChainId ||
    !fromAmount ||
    parseFloat(fromAmount) <= 0 ||
    isDestinationAddressMissing ||
    isBridgeBalanceInsufficient ||
    bridgeHook.isBridging ||
    bridgeHook.isLoading;
  const shouldPromptConnectWallet =
    fromChainId === "solana" ? !isSolanaConnected : !user;
  const isBridgeButtonDisabled = shouldPromptConnectWallet
    ? false
    : isBridgeActionDisabled;
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
    solana: "https://explorer.solana.com/tx/",
    "unichain-sepolia": "https://unichain-sepolia.blockscout.com/tx/",
  };
  const bridgeTransactionUrl =
    bridgeHook.transactionHash && toChainId && bridgeExplorerUrls[toChainId]
      ? toChainId === "solana"
        ? `${bridgeExplorerUrls[toChainId]}${bridgeHook.transactionHash}?cluster=devnet`
        : `${bridgeExplorerUrls[toChainId]}${bridgeHook.transactionHash}`
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
    if (fromChainId === "solana") {
      openSolanaConnectModal();
      return;
    }

    if (authenticated) return;
    try {
      await login();
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const handleNavigateToSwap = useCallback(() => {
    if (swapNavigationStartedRef.current) {
      return;
    }

    swapNavigationStartedRef.current = true;

    if (onNavigateToSwap) {
      onNavigateToSwap();
      return;
    }

    router.push("/");
  }, [onNavigateToSwap, router]);

  const getBridgeButtonContent = () => {
    if (shouldPromptConnectWallet) {
      return fromChainId === "solana" && isConnectingSolana
        ? "Connecting Wallet..."
        : "Connect Wallet";
    }

    if (bridgeHook.isBridging) {
      return "Bridge";
    }


    if (isDestinationAddressMissing) {
      return toChainId === "solana"
        ? "Enter Solana Address"
        : "Enter EVM Address";
    }

    if (isBridgeBalanceInsufficient) {
      return "Insufficient Balance";
    }

    return "Bridge";
  };

  const bridgeModalAmount = formatBridgeStepAmount(bridgeStepsDetails.amount);
  const bridgeModalDestinationAmount = formatBridgeStepAmount(
    bridgeStepsDetails.destinationAmount || bridgeStepsDetails.amount,
  );
  const bridgeModalDestinationChain = getBridgeShortChainName(
    bridgeStepsDetails.destinationChainName,
  );
  const bridgeModalSourceChain = getBridgeShortChainName(
    bridgeStepsDetails.sourceChainName,
  );
  const getModalBridgeStepStatus = (step: BridgeStepsStep) =>
    getBridgeStepStatus(bridgeStepsPhase, bridgeStepsFailedPhase, step);
  const getBridgeStepDetail = (
    step: BridgeStepsStep,
    activeDetail: string,
    failedDetail: string,
  ) => {
    if (bridgeStepsPhase === "failed" && bridgeStepsFailedPhase === step) {
      return bridgeStepsFailureMessage || failedDetail;
    }

    return getModalBridgeStepStatus(step) === "active"
      ? activeDetail
      : undefined;
  };
  const bridgeTransactionSteps: TransactionStep[] = [
    {
      id: "approve",
      label: `Approve ${bridgeStepsDetails.tokenSymbol}`,
      status: getModalBridgeStepStatus("approve"),
      detail: getBridgeStepDetail(
        "approve",
        "Approving in your wallet",
        "Approval failed",
      ),
      kind: "wallet",
    },
    {
      id: "burn",
      label: "Burn",
      status: getModalBridgeStepStatus("burn"),
      detail: getBridgeStepDetail(
        "burn",
        `Burning on ${bridgeModalSourceChain}`,
        "Burn failed",
      ),
      kind: "wallet",
    },
    {
      id: "attestation",
      label: "Fetch Attestation",
      status: getModalBridgeStepStatus("attestation"),
      detail: getBridgeStepDetail(
        "attestation",
        "Fetching attestation",
        "Attestation failed",
      ),
      kind: "wallet",
    },
    {
      id: "wait",
      label: "Wait ~2 min",
      status: getModalBridgeStepStatus("wait"),
      detail: getBridgeStepDetail("wait", "Waiting on Circle", "Bridge delayed"),
      kind: "wait",
    },
    {
      id: "mint",
      label: `Mint ${bridgeModalDestinationAmount} ${bridgeStepsDetails.tokenSymbol} on ${bridgeModalDestinationChain}`,
      status: getModalBridgeStepStatus("mint"),
      detail: getBridgeStepDetail(
        "mint",
        `Minting on ${bridgeModalDestinationChain}`,
        "Mint failed",
      ),
      kind: "mint",
      icon: bridgeStepsDetails.destinationChainLogo,
    },
  ];
  const bridgeActivityProgressByPhase: Record<BridgeStepsPhase, number> = {
    approve: 16,
    burn: 36,
    attestation: 55,
    wait: 72,
    mint: 88,
    success: 100,
    failed: 100,
  };
  const shouldShowBridgePendingIndicator =
    !bridgeStepsModalOpen &&
    (bridgeHook.isBridging || bridgeHook.status === "pending");
  // const shouldShowBridgePendingIndicator = true;
  const bridgeLiveActivityItems: ActivityTabLiveItem[] = bridgeHook.isBridging
    ? [
        {
          id: bridgeHook.transactionHash || "active-bridge",
          kind: "bridge",
          title: `Bridge ${bridgeModalAmount} ${bridgeStepsDetails.tokenSymbol}`,
          routeLabel: "CCTP (Fast)",
          status: "processing",
          statusLabel: "Submitting Bridge",
          progress: bridgeActivityProgressByPhase[bridgeStepsPhase],
          timestamp: bridgeActivityStartedAt ?? Date.now(),
          sourceIcon: bridgeStepsDetails.tokenIcon,
          sourceChainIcon: fromChain?.logo,
          targetChainIcon: bridgeStepsDetails.destinationChainLogo,
          transactionHash: bridgeHook.transactionHash ?? null,
          onClick: () => {
            setIsActivityOpen(false);
            setBridgeStepsModalOpen(true);
          },
        },
      ]
    : [];

  return (
    <>
      <TransactionStepsModal
        isOpen={bridgeStepsModalOpen}
        onClose={() => setBridgeStepsModalOpen(false)}
        variant="bridge"
        title={`Bridge ${bridgeModalAmount} ${bridgeStepsDetails.tokenSymbol}`}
        subtitle="via CCTP"
        fromIcon={bridgeStepsDetails.tokenIcon}
        steps={bridgeTransactionSteps}
      />
      <ActivityTabModal
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        isWalletConnected={Boolean(user)}
        walletAddress={user?.wallet?.address ?? null}
        liveItems={bridgeLiveActivityItems}
      />

      {!bridgeStepsModalOpen && (
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
      )}

      <div className="flex w-full items-start justify-center">
        <div className="w-full max-w-md shrink-0">
          <motion.div
            className="bg-[#191A1C] border border-border rounded-2xl px-6 pt-6 pb-6 flex flex-col"
            whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-1 rounded-full bg-[#111214] p-1">
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleNavigateToSwap();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavigateToSwap();
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground"
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
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  aria-label="Open activity tab"
                  onClick={() => setIsActivityOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg p-2 bg-secondary hover:bg-secondary transition-colors cursor-pointer ml-1"
                  variants={{
                    hover: { scale: 1.1 },
                    tap: { scale: 0.9 },
                  }}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <motion.span
                    variants={{
                      hover: { rotate: 90 },
                      tap: { scale: 0.9 },
                    }}
                    className="inline-flex"
                  >
                    <Clock className="h-5 w-5 text-white" />
                  </motion.span>
                  {shouldShowBridgePendingIndicator ? (
                    <span className="text-xs font-medium text-gray-300 hidden min-[390px]:inline">
                      Pending
                    </span>
                  ) : null}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => {
                    setFromAmount("0.00");
                    setToAmount("0.00");
                  }}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 90  }}
                  // transition={{ duration: 0.5 }}
                >
                  <RefreshCw className="w-5 h-5 text-white" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 90  }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Settings className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </div>

            {/* Bridge From */}
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

              <div className="flex min-w-0 items-center justify-between gap-2">
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
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors mb-4"
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
                          className="h-full w-full rounded-full object-cover"
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

            {/* Swap direction button */}
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

            {/* ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ Bridge To ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â mirrors SwapCard "Receive" section ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ */}
            {/* Bridge To */}
            <div className="bg-[#151617] rounded-xl p-4 mt-2 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Bridge to</span>
                {toChainId && toToken && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wallet className="w-4 h-4" />
                    <span>
                      {toChainBalance !== "0.00" ? toChainBalance : "0.00"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2">
                <motion.button
                  type="button"
                  onClick={() => {
                    const current = new URLSearchParams(
                      Array.from(searchParams.entries()),
                    );
                    current.set("side", "to");
                    router.push(`/bridge/select?${current.toString()}`);
                  }}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors mb-4"
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
                          className="h-full w-full rounded-full object-cover"
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
            <button
              type="button"
              onClick={() => setIsReceivingOpen(true)}
              className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-xs font-medium text-white/65 transition-colors hover:border-border hover:text-white"
            >
              <Plus className="h-3 w-3 text-current" />
              <span>
                {receivingAddress.trim()
                  ? `${receivingAddress.trim().slice(0, 6)}...${receivingAddress.trim().slice(-4)}`
                  : toChainId === "solana"
                    ? "Add Solana receiving wallet"
                    : fromChainId === "solana"
                      ? "Add EVM receiving wallet"
                      : "Add receiving wallet"}
              </span>
            </button>

            {/* Fee + estimated time info */}
            {fromChainId && toChainId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 space-y-1 text-xs text-muted-foreground"
              >
                <div className="flex items-center justify-between rounded-lg bg-[#151617] px-3 py-2">
                  <span>Bridge Fee</span>
                  <span className="font-medium text-foreground">
                    {bridgeHook.estimatedFee} {fromDisplayToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#151617] px-3 py-2">
                  <span>Estimated Time</span>
                  <span className="font-medium text-foreground">
                    {bridgeHook.estimatedTime}
                  </span>
                </div>
              </motion.div>
            )}


            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={shouldPromptConnectWallet ? handleConnectWallet : handleBridge}
                disabled={isBridgeButtonDisabled}
                className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all ${
                  isBridgeButtonDisabled
                    ? "cursor-not-allowed bg-[#2a2d31] text-gray-500 hover:bg-[#2a2d31]"
                    : "bg-primary text-black hover:opacity-90"
                }`}
              >
                {getBridgeButtonContent()}
              </button>
            </motion.div>
          </motion.div>

          <div className="mt-4 flex items-center justify-center gap-4">
            {[fromDisplayToken, toDisplayToken].map((token, idx) => (
              <motion.div
                key={`${token.symbol}-${idx}`}
                className="flex items-center gap-2 rounded-full border border-border bg-[#191A1C] px-6 py-3"
                whileHover={{ scale: 1.05 }}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary/30">
                  {token.logo ? (
                    <Image
                      src={token.logo}
                      alt={`${token.symbol} logo`}
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </span>
                <span className="font-medium text-foreground">{token.symbol}</span>
                <span className="text-[11px] text-muted-foreground">
                  {token.usdValue}
                </span>
              </motion.div>
            ))}
          </div>

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
                className="w-full max-w-sm overflow-hidden rounded-2xl border border-border/70 bg-[#111214] shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <h2 className="text-sm font-semibold text-foreground">
                    Receiving Address
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsReceivingOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#18191c] text-muted-foreground transition-colors hover:bg-[#202225]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 px-5 pb-3 pt-4">
                  <div>
                    <label className="mb-2 block text-xs text-muted-foreground">
                      Enter Destination Address{" "}
                      {toChainId === "solana"
                        ? "(Solana)"
                        : fromChainId === "solana"
                          ? "(EVM)"
                          : ""}
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
                      className="w-full rounded-xl border border-border/70 bg-[#18191c] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-border focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!receivingAddress.trim()}
                    onClick={() => {
                      saveRecentAddress(receivingAddress);
                      setIsReceivingOpen(false);
                    }}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#1b1c1f] py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[#222327] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Done
                  </button>
                </div>
                <div className="px-5 pb-4 pt-1">
                  {recentAddresses.length > 0 && (
                    <>
                      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                        Recent Addresses
                      </p>
                      <div className="space-y-2">
                        {recentAddresses.map((address) => (
                          <button
                            key={address}
                            type="button"
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors hover:bg-[#18191c]"
                            onClick={() => setReceivingAddress(address)}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#232428]">
                                <Wallet className="h-3.5 w-3.5 text-foreground" />
                              </span>
                              <span className="truncate text-xs font-medium text-foreground">
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
          {showSuccessModal && !bridgeStepsModalOpen && (
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
                        Pending:{" "}
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
                      bridgeTransactionUrl ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""
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

