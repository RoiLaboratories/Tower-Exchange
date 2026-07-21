"use client";
import {
  ArrowDown,
  BarChart3,
  Clock,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { formatUnits, parseUnits } from "viem";
import {
  formatBalance,
  getRevertReasonViaPublicRpc,
  ARC_TESTNET_CONFIG,
  TOKEN_CONTRACTS,
  TOKEN_DECIMALS,
  NATIVE_TOKENS,
  ARC_CHAIN_HEX,
  ARC_ADD_NETWORK_PARAMS,
} from "@/lib/arcNetwork";
import { useTowerSwap, type SwapRouteOption } from "@/lib/hooks/useTowerSwap";
import {
  getSupportedCounterpartyTokens,
  isSupportedSwapPair,
  SWAP_TOKENS,
  type SwapToken,
  type SwapTokenSymbol,
} from "@/lib/swapTokens";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";
import TokenInput from "./reusable/TokenInput";
import SwapNotification from "./SwapNotification";
import RouterDisplay from "./RouterDisplay";
import ActivityTabModal, {
  type ActivityTabLiveItem,
} from "./ActivityTabModal";
import TransactionStepsModal, {
  type TransactionStep,
} from "./TransactionStepsModal";
import {
  supabase,
} from "@/lib/supabase";
import { recordExecutorSwapFee } from "@/lib/swapFeeTracking";
import { formatUsdAmount } from "@/lib/formatUsdAmount";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import {
  getBrowserWalletChainId,
  getBrowserWalletProvider,
  type BrowserWalletTransactionReceipt,
} from "@/lib/browser-wallet";
import arcTestnetLogo from "@/public/assets/ARCSvg.svg";
const NATIVE_USDC_GAS_RESERVE = 0.05;
const QUOTE_REFRESH_INTERVAL_MS = 10000;
const SWAP_SUCCESS_NOTIFICATION_DURATION_MS = 10000;
const SWAP_SUCCESS_RESET_DELAY_MS = SWAP_SUCCESS_NOTIFICATION_DURATION_MS + 500;
const ARC_RPC_PROXY_URL = `/api/rpc/${ARC_TESTNET_CONFIG.chainId}`;
const ARC_NATIVE_USDC_DECIMALS = 18;
const RECEIPT_REQUEST_TIMEOUT_MS = 12000;
const RECEIPT_POLL_INTERVAL_MS = 1000;
const SWAPS_DISABLED = process.env.NEXT_PUBLIC_SWAPS_DISABLED !== "false";
const SWAPS_DISABLED_MESSAGE =
  "Swaps are temporarily paused for maintenance.";
const SWAP_DISPLAY_DECIMALS: Partial<Record<SwapTokenSymbol, number>> = {
  cirBTC: 8,
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type RpcTransaction = {
  blockNumber?: string | null;
  hash?: string;
  nonce?: string;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const callArcRpc = async <T,>(
  method: string,
  params: unknown[],
  timeoutMs: number,
  label: string,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ARC_RPC_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `${label} failed (${response.status}): ${errorText.slice(0, 240)}`,
      );
    }

    const data = (await response.json()) as JsonRpcResponse<T>;
    if (data.error) {
      throw new Error(data.error.message || `${label} returned an RPC error`);
    }

    return data.result as T;
  } catch (error: unknown) {
    const errorObj =
      error instanceof Error ? error : new Error(String(error));
    if (errorObj.name === "AbortError") {
      throw new Error(
        `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`,
      );
    }
    throw errorObj;
  } finally {
    clearTimeout(timeoutId);
  }
};

const waitForArcTransactionReceipt = async (
  txHash: string,
  {
    label,
    maxWaitMs,
    requestTimeoutMs = RECEIPT_REQUEST_TIMEOUT_MS,
    pollIntervalMs = RECEIPT_POLL_INTERVAL_MS,
    walletReceiptLookup,
  }: {
    label: string;
    maxWaitMs: number;
    requestTimeoutMs?: number;
    pollIntervalMs?: number;
    walletReceiptLookup?: (
      txHash: string,
      label: string,
    ) => Promise<BrowserWalletTransactionReceipt | null>;
  },
): Promise<BrowserWalletTransactionReceipt | null> => {
  const startedAt = Date.now();
  let attempt = 0;
  let lastErrorMessage: string | null = null;

  while (Date.now() - startedAt < maxWaitMs) {
    attempt += 1;

    const lookups = [
      callArcRpc<BrowserWalletTransactionReceipt | null>(
        "eth_getTransactionReceipt",
        [txHash],
        requestTimeoutMs,
        `${label} via Arc RPC`,
      ).then((receipt) => ({ source: "Arc RPC", receipt })),
    ];

    if (walletReceiptLookup) {
      lookups.push(
        walletReceiptLookup(txHash, `${label} via wallet`).then((receipt) => ({
          source: "wallet",
          receipt,
        })),
      );
    }

    const receiptResult = await new Promise<{
      source: string;
      receipt: BrowserWalletTransactionReceipt;
    } | null>((resolve) => {
      let pending = lookups.length;
      let settled = false;

      lookups.forEach((lookup) => {
        lookup
          .then((result) => {
            if (settled) {
              return;
            }

            if (result.receipt) {
              settled = true;
              resolve({
                source: result.source,
                receipt: result.receipt,
              });
              return;
            }

            pending -= 1;
            if (pending === 0) {
              resolve(null);
            }
          })
          .catch((error: unknown) => {
            lastErrorMessage =
              error instanceof Error ? error.message : String(error);
            pending -= 1;
            if (!settled && pending === 0) {
              resolve(null);
            }
          });
      });
    });

    if (receiptResult) {
      console.log(`${label} found through ${receiptResult.source}`, {
        txHash,
        attempt,
      });
      return receiptResult.receipt;
    }

    if (lastErrorMessage && (attempt === 1 || attempt % 10 === 0)) {
      console.warn(`${label} still pending`, {
        txHash,
        attempt,
        message: lastErrorMessage,
      });
    }

    if (Date.now() - startedAt + pollIntervalMs < maxWaitMs) {
      await sleep(pollIntervalMs);
    }
  }

  if (lastErrorMessage) {
    console.warn(`${label} did not return a receipt before timeout`, {
      txHash,
      message: lastErrorMessage,
    });
  }

  return null;
};

const getArcTransactionByHash = (txHash: string, label: string) =>
  callArcRpc<RpcTransaction | null>(
    "eth_getTransactionByHash",
    [txHash],
    RECEIPT_REQUEST_TIMEOUT_MS,
    label,
  );

const getArcLatestNonce = (address: string, label: string) =>
  callArcRpc<string>(
    "eth_getTransactionCount",
    [address, "latest"],
    RECEIPT_REQUEST_TIMEOUT_MS,
    label,
  );

const getArcFeeParams = async () => {
  const [latestBlock, priorityFee] = await Promise.all([
    callArcRpc<{ baseFeePerGas?: string }>(
      "eth_getBlockByNumber",
      ["latest", false],
      RECEIPT_REQUEST_TIMEOUT_MS,
      "Arc latest block lookup",
    ),
    callArcRpc<string>(
      "eth_maxPriorityFeePerGas",
      [],
      RECEIPT_REQUEST_TIMEOUT_MS,
      "Arc priority fee lookup",
    ).catch(() => "0x59682f00"),
  ]);
  const baseFee = BigInt(latestBlock?.baseFeePerGas || "0x0");
  const priority = BigInt(priorityFee || "0x59682f00");
  const minimumPriority = 1500000000n;
  const maxPriorityFeePerGas =
    priority > minimumPriority ? priority : minimumPriority;
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  return {
    maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
  };
};

const applyGasBuffer = (gasEstimate: unknown) => {
  if (typeof gasEstimate !== "string") {
    return null;
  }

  return `0x${((BigInt(gasEstimate) * 13n) / 10n).toString(16)}`;
};

interface TokenSelectorProps {
  selected: SwapToken | null;
  onOpenModal: () => void;
}

const TokenSelector = ({ selected, onOpenModal }: TokenSelectorProps) => {
  if (!selected) {
    return (
      <motion.button
        onClick={onOpenModal}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors mb-4"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="font-medium text-muted-foreground">Select Token</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onOpenModal}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors mb-4"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
        <Image
          src={selected.icon}
          alt={`${selected.symbol} logo`}
          width={24}
          height={24}
          className="object-contain w-full h-full"
        />
      </div>
      <span className="font-medium text-white">{selected.symbol}</span>
      <ChevronDown className="w-4 h-4 text-muted-foreground" />
    </motion.button>
  );
};

const SwapCard = ({
  onNavigateToBridge,
}: {
  onNavigateToBridge?: () => void;
}) => {
  const router = useRouter();
  const { user, login, authenticated } = useRainbowKitAuth();
  const bridgeNavigationStartedRef = useRef(false);

  // Tower Exchange DEX Aggregator hook
  const { getQuote, buildSwapTransaction, error: towerError } = useTowerSwap();

  // Wallet and transaction states
  const isWalletConnected = Boolean(authenticated && user);
  const [, setChainId] = useState<string | null>(null);
  const [selectedRouterId, setSelectedRouterId] = useState<string | undefined>(
    undefined,
  );
  const [routeOptions, setRouteOptions] = useState<SwapRouteOption[]>([]);
  const [swapState, setSwapState] = useState<
    "idle" | "loading" | "pending" | "success" | "failed"
  >("idle");
  const [notification, setNotification] = useState<
    "success" | "pending" | "failed" | null
  >(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [notificationSwapDetails, setNotificationSwapDetails] = useState<{
    sellAmount: string;
    sellTokenSymbol: string;
    receiveAmount: string;
    receiveTokenSymbol: string;
  } | null>(null);
  const [swapStepsModalOpen, setSwapStepsModalOpen] = useState(false);
  const [swapStepsPhase, setSwapStepsPhase] = useState<
    "approval" | "confirm" | "wait" | "success" | "failed"
  >("approval");
  const [swapStepsFailedPhase, setSwapStepsFailedPhase] = useState<
    "approval" | "confirm" | "wait"
  >("confirm");
  const [swapStepsFailureMessage, setSwapStepsFailureMessage] =
    useState<string | null>(null);
  const [swapStepsDetails, setSwapStepsDetails] = useState<{
    sellAmount: string;
    sellTokenSymbol: string;
    sellTokenIcon: SwapToken["icon"];
    receiveAmount: string;
    receiveTokenSymbol: string;
    receiveTokenIcon?: SwapToken["icon"];
    dexName: string;
  }>({
    sellAmount: "0.00",
    sellTokenSymbol: SWAP_TOKENS[0].symbol,
    sellTokenIcon: SWAP_TOKENS[0].icon,
    receiveAmount: "0.00",
    receiveTokenSymbol: "",
    receiveTokenIcon: undefined,
    dexName: "Swap",
  });
  const [swapActivityStartedAt, setSwapActivityStartedAt] = useState<
    number | null
  >(null);
  const [revertReason, setRevertReason] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(1); // 1% default to reduce "execution reverted" from slippage

  // Monitor chain ID changes
  useEffect(() => {
    if (!authenticated) {
      setChainId(null);
      return;
    }

    let isMounted = true;

    const checkChainId = async () => {
      try {
        const currentChainId = await getBrowserWalletChainId();

        if (isMounted) {
          setChainId(currentChainId);
        }
      } catch (error) {
        console.error("Error checking chain ID:", error);
      }
    };

    checkChainId();

    // Listen for chain changes
    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    try {
      const provider = getBrowserWalletProvider();
      provider.on?.("chainChanged", handleChainChanged);

      return () => {
        isMounted = false;
        provider.removeListener?.("chainChanged", handleChainChanged);
      };
    } catch {
      return () => {
        isMounted = false;
      };
    }
  }, [authenticated, user?.wallet?.address]);

  // Function to switch/add Arc Testnet network
  const switchToArcTestnet = async () => {
    const ethereum = getBrowserWalletProvider();
    const getWalletErrorCode = (error: unknown) =>
      error && typeof error === "object" && "code" in error
        ? (error as { code?: number }).code
        : undefined;

    try {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: ARC_ADD_NETWORK_PARAMS,
        });
      } catch (addOrUpdateError) {
        if (getWalletErrorCode(addOrUpdateError) === 4001) {
          throw new Error(
            "Please approve the Arc Testnet RPC update in your wallet before swapping.",
          );
        }

        console.warn(
          "Unable to refresh Arc Testnet RPC config:",
          addOrUpdateError,
        );
      }

      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_HEX }],
      });
    } catch (switchError: unknown) {
      const switchErrorCode = getWalletErrorCode(switchError);
      // This error code indicates that the chain has not been added to MetaMask
      if (switchErrorCode === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: ARC_ADD_NETWORK_PARAMS,
          });
        } catch {
          throw new Error("Failed to add Arc Testnet network");
        }
      } else {
        throw switchError;
      }
    }
  };

  const toHexQuantity = (value: bigint | number | string) => {
    const v = typeof value === "bigint" ? value : BigInt(value);
    return "0x" + v.toString(16);
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`,
          ),
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const extractTransactionHash = (result: unknown, txType: string) => {
    const candidate =
      typeof result === "string"
        ? result
        : result && typeof result === "object"
          ? (result as Record<string, unknown>).hash ||
            (result as Record<string, unknown>).transactionHash ||
            (result as Record<string, unknown>).txHash
          : null;

    if (typeof candidate !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(candidate)) {
      throw new Error(
        `${txType} did not return a valid transaction hash. Please check your wallet activity.`,
      );
    }

    return candidate;
  };

  const getActiveWalletAddress = async (
    provider = getBrowserWalletProvider(),
  ) => {
    const accounts = await provider.request({ method: "eth_accounts" });

    if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
      throw new Error(
        "No active wallet account found. Please reconnect your wallet.",
      );
    }

    return accounts[0];
  };

  // Token and amount states
  const [sellAmount, setSellAmount] = useState("0.00");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [sellToken, setSellToken] = useState<SwapToken>(SWAP_TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState<SwapToken | null>(null);

  // Listen for external cirBTC selection events or URL parameters
  useEffect(() => {
    const handleSelectTokenEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.symbol === "cirBTC") {
        const cirbtcToken = SWAP_TOKENS.find(t => t.symbol === "cirBTC");
        if (cirbtcToken) {
          setSellToken(cirbtcToken);
          // Clean URL params if present
          const url = new URL(window.location.href);
          if (url.searchParams.has("select")) {
            url.searchParams.delete("select");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      }
    };

    window.addEventListener("select-sell-token", handleSelectTokenEvent);

    // Check URL parameters on mount
    const params = new URLSearchParams(window.location.search);
    const selectToken = params.get("select");
    if (selectToken === "cirBTC") {
      const cirbtcToken = SWAP_TOKENS.find(t => t.symbol === "cirBTC");
      if (cirbtcToken) {
        setSellToken(cirbtcToken);
        // Clean URL params
        const url = new URL(window.location.href);
        url.searchParams.delete("select");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }

    return () => {
      window.removeEventListener("select-sell-token", handleSelectTokenEvent);
    };
  }, []);
  const quoteRequestIdRef = useRef(0);

  const resetSwapQuote = useCallback(() => {
    quoteRequestIdRef.current += 1;
    setReceiveAmount("0.00");
    setRouteOptions([]);
    setSelectedRouterId(undefined);
  }, []);

  const resetSwapForm = useCallback(() => {
    setSellAmount("0.00");
    resetSwapQuote();
  }, [resetSwapQuote]);

  const getActiveSwapRouteName = useCallback(() => {
    if (selectedRouterId) {
      return (
        routeOptions.find((option) => option.dexId === selectedRouterId)
          ?.dexName || selectedRouterId
      );
    }

    return routeOptions[0]?.dexName || "Swap";
  }, [routeOptions, selectedRouterId]);

  const openSwapStepsModal = useCallback(() => {
    setSwapStepsDetails({
      sellAmount,
      sellTokenSymbol: sellToken.symbol,
      sellTokenIcon: sellToken.icon,
      receiveAmount,
      receiveTokenSymbol: receiveToken?.symbol || "",
      receiveTokenIcon: receiveToken?.icon,
      dexName: getActiveSwapRouteName(),
    });
    setSwapStepsFailureMessage(null);
    setSwapStepsFailedPhase("confirm");
    setSwapStepsPhase("approval");
    setSwapActivityStartedAt(Date.now());
    setSwapStepsModalOpen(true);
  }, [
    receiveAmount,
    receiveToken?.icon,
    receiveToken?.symbol,
    getActiveSwapRouteName,
    sellAmount,
    sellToken.icon,
    sellToken.symbol,
  ]);

  const updateSwapStepsRoute = useCallback(
    (dexName?: string, outputAmount?: string) => {
      setSwapStepsDetails((current) => ({
        ...current,
        dexName: dexName || current.dexName,
        receiveAmount: outputAmount || current.receiveAmount,
      }));
    },
    [],
  );

  const logSwapActivity = useCallback(
    async (
      status: "Successful" | "Failed",
      txHash?: string | null,
      routeLabel?: string | null,
    ) => {
      try {
        if (!user?.wallet?.address) return null;
        const amountUsd = (parseFloat(sellAmount) || 0) * sellToken.usdPrice;
        const resolvedRouteLabel = routeLabel || getActiveSwapRouteName();
        const { data, error } = await supabase
          .from("activities")
          .insert({
            wallet_address: user.wallet.address.toLowerCase(),
            type:
              resolvedRouteLabel && resolvedRouteLabel !== "Swap"
                ? `Swap via ${resolvedRouteLabel}`
                : "Swap",
            source_currency_ticker: sellToken.symbol,
            destination_currency_ticker: receiveToken?.symbol || null,
            source_network_name: "Arc",
            destination_network_name: "Arc",
            status,
            amount: parseFloat(sellAmount) || null,
            amount_usd: amountUsd || null,
            transaction_hash: txHash || null,
            timestamp: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        return data?.id ?? null;
      } catch (e) {
        console.error("Error logging swap activity:", e);
        return null;
      }
    },
    [
      sellToken.symbol,
      receiveToken?.symbol,
      sellAmount,
      user?.wallet?.address,
      sellToken.usdPrice,
      getActiveSwapRouteName,
    ],
  );

  const getEmptySwapTokenBalances = () =>
    Object.fromEntries(SWAP_TOKENS.map((token) => [token.symbol, 0]));

  // Actual wallet balances for tokens currently supported on the swap card
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>(
    getEmptySwapTokenBalances,
  );
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);
  const sellUsdValueLabel = formatUsdAmount(sellAmount, sellToken.usdPrice);
  const shouldUseInputUsdValueForReceive =
    (receiveToken?.symbol === "EURC" || receiveToken?.symbol === "cirBTC") &&
    Number.parseFloat(sellAmount) > 0 &&
    Number.parseFloat(receiveAmount) > 0;
  const receiveUsdValueLabel = formatUsdAmount(
    receiveAmount,
    receiveToken?.usdPrice ?? 0,
  );
  const effectiveReceiveUsdValueLabel = shouldUseInputUsdValueForReceive
    ? sellUsdValueLabel
    : receiveUsdValueLabel;
  const shouldUseQuoteUsdValueLabel =
    receiveToken?.symbol === "EURC" || receiveToken?.symbol === "cirBTC";

  const fetchSwapTokenBalance = useCallback(async (tokenSymbol: SwapTokenSymbol) => {
    const tokenAddress = TOKEN_CONTRACTS[tokenSymbol];

      if (!tokenAddress || !user?.wallet?.address) {
        return 0;
      }

      if (tokenSymbol === "USDC") {
        const nativeBalance = await callArcRpc<string>(
          "eth_getBalance",
          [user.wallet.address, "latest"],
          12000,
          `${tokenSymbol} balance lookup`,
        );

        return Number.parseFloat(
          formatUnits(BigInt(nativeBalance || "0x0"), ARC_NATIVE_USDC_DECIMALS),
        );
      }

      const balanceOfCallData =
        "0x70a08231" + user.wallet.address.slice(2).padStart(64, "0");
      const rawBalance = await callArcRpc<string>(
        "eth_call",
        [
          {
            to: tokenAddress,
            data: balanceOfCallData,
          },
          "latest",
        ],
        12000,
        `${tokenSymbol} balance lookup`,
      );

      if (!rawBalance || rawBalance === "0x") {
        return 0;
      }

      return Number.parseFloat(
        formatUnits(BigInt(rawBalance), TOKEN_DECIMALS[tokenSymbol] ?? 18),
      );
    },
    [user?.wallet?.address],
  );

  // Fetch actual wallet balances from Arc testnet
  const fetchUserBalances = useCallback(async () => {
    if (!user?.wallet?.address) {
      console.log("Wallet address not available");
      return;
    }

    console.log("Fetching balances for wallet:", user.wallet.address);
    setIsLoadingBalances(true);
    try {
      const balanceEntries = await Promise.all(
        SWAP_TOKENS.map(async (token) => [
          token.symbol,
          await fetchSwapTokenBalance(token.symbol),
        ] as const),
      );
      const nextTokenBalances = Object.fromEntries(balanceEntries);

      console.log("Swap token balances:", nextTokenBalances);

      setTokenBalances((prev) => ({
        ...prev,
        ...nextTokenBalances,
      }));
    } catch (error) {
      console.error("Failed to fetch wallet balances:", error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [fetchSwapTokenBalance, user?.wallet?.address]);

  // Sync wallet connection state with the active browser wallet
  useEffect(() => {
    if (authenticated && user) {
      fetchUserBalances();
    } else {
      setTokenBalances(getEmptySwapTokenBalances());
    }
  }, [authenticated, user, fetchUserBalances]);

  // Get display balance for a token (actual if available, mock otherwise)
  const getTokenBalance = (symbol: string): number => {
    return tokenBalances[symbol] || 0;
  };

  const getFormattedBalance = (symbol: string): string => {
    const balance = getTokenBalance(symbol);
    // Use appropriate decimal places based on token type
    const decimals = symbol === "cirBTC" ? 8 : 2;
    return formatBalance(balance.toString(), decimals);
  };

  const sellTokenBalance = getTokenBalance(sellToken.symbol);
  const maxSwapAmount = NATIVE_TOKENS.includes(sellToken.symbol)
    ? Math.max(0, sellTokenBalance - NATIVE_USDC_GAS_RESERVE)
    : sellTokenBalance;
  const sellAmountValue = Number.parseFloat(sellAmount);
  const isSwapBalanceInsufficient =
    isWalletConnected &&
    Number.isFinite(sellAmountValue) &&
    sellAmountValue > 0 &&
    sellAmountValue > maxSwapAmount;

  // Check if swap button should be active
  const isSwapActive =
    isWalletConnected &&
    parseFloat(sellAmount) > 0 &&
    sellAmount !== "0.00" &&
    parseFloat(receiveAmount) > 0 &&
    receiveAmount !== "0.00";
  const shouldShowRouterDisplay =
    parseFloat(sellAmount) > 0 &&
    sellAmount !== "0.00" &&
    Boolean(receiveToken) &&
    isSupportedSwapPair(sellToken.symbol, receiveToken?.symbol);

  const availableSellTokens = useMemo(
    () =>
      receiveToken
        ? SWAP_TOKENS.filter(
            (token) =>
              token.symbol !== receiveToken.symbol &&
              isSupportedSwapPair(token.symbol, receiveToken.symbol),
          )
        : [...SWAP_TOKENS],
    [receiveToken],
  );
  const availableReceiveTokens = useMemo(
    () => getSupportedCounterpartyTokens(sellToken.symbol),
    [sellToken.symbol],
  );

  useEffect(() => {
    if (!receiveToken) {
      return;
    }

    if (!isSupportedSwapPair(sellToken.symbol, receiveToken.symbol)) {
      setReceiveToken(availableReceiveTokens[0] ?? null);
      resetSwapQuote();
    }
  }, [availableReceiveTokens, receiveToken, resetSwapQuote, sellToken.symbol]);

  const handleSwapTokens = () => {
    if (!receiveToken) {
      // If receive token is not selected, just do nothing
      return;
    }
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);
    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
    setRouteOptions([]);
    setSelectedRouterId(undefined);
  };

  const handleSellTokenSelect = (token: SwapToken) => {
    setSellToken(token);
    resetSwapQuote();
  };

  const handleReceiveTokenSelect = (token: SwapToken) => {
    setReceiveToken(token);
    resetSwapQuote();
  };

  // Get swap quote from Tower Exchange backend
  const getQuoteForSwap = useCallback(
    async (sellAmountValue: string, routerId?: string) => {
      const requestId = quoteRequestIdRef.current + 1;
      quoteRequestIdRef.current = requestId;

      try {
        if (SWAPS_DISABLED) {
          resetSwapQuote();
          return;
        }

        if (
          !receiveToken ||
          !isSupportedSwapPair(sellToken.symbol, receiveToken.symbol)
        ) {
          resetSwapQuote();
          return;
        }

        const addressMap: Record<string, string> = TOKEN_CONTRACTS;
        const tokenInAddress = addressMap[sellToken.symbol] ?? null;
        const tokenOutAddress = addressMap[receiveToken.symbol] ?? null;

        if (!tokenInAddress || !tokenOutAddress) {
          console.warn(
            `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`,
          );
          resetSwapQuote();
          return;
        }

        const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;
        const amountInWei = parseUnits(
          sellAmountValue,
          sellTokenDecimals,
        ).toString();

        console.log("Getting quote from Tower Exchange:", {
          sellToken: sellToken.symbol,
          receiveToken: receiveToken.symbol,
          tokenInAddress,
          tokenOutAddress,
          amountInWei,
        });

        const quoteData = await getQuote(
          tokenInAddress,
          tokenOutAddress,
          amountInWei,
          slippageTolerance,
          routerId,
        );

        if (!quoteData) {
          throw new Error(
            towerError || "Failed to get quote from Tower Exchange",
          );
        }

        if (requestId !== quoteRequestIdRef.current) {
          return;
        }

        console.log("Quote received from Tower Exchange:", quoteData);

        const selectedDexId = quoteData.route?.hops?.[0]?.dexId;
        if (selectedDexId) {
          setSelectedRouterId(selectedDexId);
          console.log(
            routerId ? "Selected router from quote:" : "Auto-selected router from backend:",
            quoteData.route.hops[0].dexName,
            "ID:",
            selectedDexId,
          );
        }

        setRouteOptions(quoteData.routeOptions || []);

        const receiveTokenDecimals = TOKEN_DECIMALS[receiveToken.symbol] || 18;
        const displayPrecision =
          SWAP_DISPLAY_DECIMALS[receiveToken.symbol] ??
          Math.min(receiveTokenDecimals, 6);
        const quoteAmount = Number.parseFloat(
          formatUnits(BigInt(quoteData.outputAmount || "0"), 18),
        );
        const priceImpactPercent =
          typeof quoteData.priceImpact === "number"
            ? (quoteData.priceImpact / 100).toFixed(2)
            : quoteData.priceImpact;

        console.log("Quote conversion details:", {
          outputAmount_wei: quoteData.outputAmount,
          quoteAmount_tokens: quoteAmount,
          priceImpact: priceImpactPercent,
          displayPrecision,
        });

        setReceiveAmount(
          Number.isFinite(quoteAmount)
            ? quoteAmount.toFixed(displayPrecision)
            : "0.00",
        );
      } catch (error) {
        console.error("Error getting swap quote:", error);
        if (requestId === quoteRequestIdRef.current) {
          resetSwapQuote();
        }
      }
    },
    [
      getQuote,
      receiveToken,
      resetSwapQuote,
      sellToken.symbol,
      slippageTolerance,
      towerError,
    ],
  );

  useEffect(() => {
    if (!shouldShowRouterDisplay || swapState === "loading") {
      return;
    }

    const refreshQuotes = () => {
      getQuoteForSwap(sellAmount);
    };
    refreshQuotes();
    const intervalId = window.setInterval(
      refreshQuotes,
      QUOTE_REFRESH_INTERVAL_MS,
    );

    return () => window.clearInterval(intervalId);
  }, [getQuoteForSwap, sellAmount, shouldShowRouterDisplay, swapState]);

  // Simulate DEX aggregator calculation
  const handleSellAmountChange = (value: string) => {
    setSellAmount(value);
    if (value && parseFloat(value) > 0) {
      // Get quote from Arc pool for actual exchange rate
      getQuoteForSwap(value);
    } else {
      resetSwapQuote();
    }
  };

  // Handle 50% button click
  const handle50Percent = () => {
    const balance = getTokenBalance(sellToken.symbol);
    const fiftyPercent = (balance * 0.5).toFixed(2);
    handleSellAmountChange(fiftyPercent);
  };

  // Handle Max button click
  const handleMaxAmount = () => {
    const balance = getTokenBalance(sellToken.symbol);
    const spendableBalance = NATIVE_TOKENS.includes(sellToken.symbol)
      ? Math.max(0, balance - NATIVE_USDC_GAS_RESERVE)
      : balance;
    const maxAmount = spendableBalance.toFixed(2);
    handleSellAmountChange(maxAmount);
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    if (authenticated) {
      setSwapState("idle");
      return;
    }

    try {
      setSwapState("loading");
      // Trigger the RainbowKit wallet modal
      await login();
      setSwapState("idle");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setSwapState("idle");
    }
  };

  const handleNavigateToBridge = useCallback(() => {
    if (bridgeNavigationStartedRef.current) {
      return;
    }

    bridgeNavigationStartedRef.current = true;

    if (onNavigateToBridge) {
      onNavigateToBridge();
      return;
    }

    router.push("/bridge");
  }, [onNavigateToBridge, router]);

  // Handle swap transaction
  const handleSwap = async () => {
    if (SWAPS_DISABLED) {
      setSwapState("failed");
      setRevertReason(SWAPS_DISABLED_MESSAGE);
      return;
    }

    setSwapState("loading");
    setRevertReason(null);
    openSwapStepsModal();
    let successNotificationTimeout: ReturnType<typeof setTimeout> | undefined;
    let successResetTimeout: ReturnType<typeof setTimeout> | undefined;
    let submittedSwapTxHash: string | null = null;

    try {
      if (!user?.wallet?.address) {
        throw new Error("Wallet not connected");
      }

      const eip1193Provider = getBrowserWalletProvider();
      const walletRequest = async <T,>(
        args: Parameters<typeof eip1193Provider.request>[0],
        timeoutMs: number,
        label: string,
      ) =>
        withTimeout(
          eip1193Provider.request(args) as Promise<T>,
          timeoutMs,
          label,
        );
      const walletReceiptLookup = (
        hash: string,
        label: string,
      ): Promise<BrowserWalletTransactionReceipt | null> =>
        walletRequest<BrowserWalletTransactionReceipt | null>(
          {
            method: "eth_getTransactionReceipt",
            params: [hash],
          },
          RECEIPT_REQUEST_TIMEOUT_MS,
          label,
        );
      const markSwapSuccess = (hash: string) => {
        setTransactionHash(hash);
        setRevertReason(null);
        setNotificationSwapDetails({
          sellAmount,
          sellTokenSymbol: sellToken.symbol,
          receiveAmount,
          receiveTokenSymbol: receiveToken?.symbol || "",
        });
        setSwapState("success");
        setNotification("success");
        resetSwapForm();

        window.setTimeout(() => {
          setSwapStepsModalOpen(false);
        }, 700);

        // Auto-dismiss after a longer confirmation window so users can review/open the transaction.
        successNotificationTimeout = setTimeout(() => {
          setNotification(null);
          setNotificationSwapDetails(null);
        }, SWAP_SUCCESS_NOTIFICATION_DURATION_MS);

        // Reset after the success modal has had time to remain visible.
        successResetTimeout = setTimeout(() => {
          setSwapState("idle");
          setTransactionHash(null);
          fetchUserBalances();
        }, SWAP_SUCCESS_RESET_DELAY_MS);
      };

      if (!receiveToken) {
        throw new Error("Please select a receive token");
      }

      if (!isSupportedSwapPair(sellToken.symbol, receiveToken.symbol)) {
        throw new Error("This token pair is not currently supported on Tower Swap.");
      }

      // Refresh the Arc wallet RPC config before swaps. A stale wallet RPC can
      // return a hash for a tx that never propagates to Arc's public RPCs.
      try {
        await switchToArcTestnet();
        await sleep(1000);
        const currentChainId = await walletRequest<string>(
          { method: "eth_chainId" },
          15000,
          "Arc network check",
        );
        if (currentChainId !== ARC_CHAIN_HEX) {
          throw new Error("Please switch to Arc Testnet to continue");
        }
      } catch (networkError: unknown) {
        const networkErrorMessage =
          networkError instanceof Error ? networkError.message : null;
        throw new Error(
          networkErrorMessage ||
            "Please switch to Arc Testnet network to perform swaps",
        );
      }

      // Use the EIP1193 provider directly to send transactions
      const userAddress = await getActiveWalletAddress(eip1193Provider);
      if (!userAddress) {
        throw new Error("User wallet address not available");
      }

      const sendTransactionViaProvider = async (
        txData: {
          to: string;
          value: string;
          data: string;
          gas?: number | string;
          maxFeePerGas?: string;
          maxPriorityFeePerGas?: string;
          nonce?: string;
        },
        txType: string = "transaction",
      ) => {
        try {
          console.log(`[${txType}] Sending to provider:`, {
            from: userAddress,
            to: txData.to,
            value: txData.value,
            dataLength: txData.data?.length || 0,
            data: txData.data?.substring(0, 100) + "...",
            gas: txData.gas,
            maxFeePerGas: txData.maxFeePerGas,
            maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
            nonce: txData.nonce,
          });

          // Get current chain ID to include in transaction
          const currentChainId = await walletRequest<string>(
            { method: "eth_chainId" },
            15000,
            `${txType} network check`,
          );

          if (currentChainId !== ARC_CHAIN_HEX) {
            throw new Error(
              `Invalid chain ID. Expected ${ARC_CHAIN_HEX} (Arc Testnet), got ${currentChainId}. Please switch to Arc Testnet.`,
            );
          }

          const result = await walletRequest<unknown>(
            {
              method: "eth_sendTransaction",
              params: [
                {
                  from: userAddress, // Use the validated address
                  to: txData.to,
                  value: txData.value?.startsWith("0x")
                    ? txData.value
                    : toHexQuantity(txData.value || "0"),
                  data: txData.data,
                  // NOTE: Do NOT pass chainId here; wallets derive it from the connected network.
                  ...(txData.nonce
                    ? {
                        nonce: txData.nonce,
                      }
                    : {}),
                  ...(txData.gas
                    ? {
                        gas:
                          typeof txData.gas === "string"
                            ? txData.gas
                            : toHexQuantity(txData.gas),
                      }
                    : {}),
                  ...(txData.maxFeePerGas && txData.maxPriorityFeePerGas
                    ? {
                        maxFeePerGas: txData.maxFeePerGas,
                        maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
                      }
                    : {}),
                },
              ],
            },
            300000,
            `${txType} wallet signing`,
          );
          const txHash = extractTransactionHash(result, txType);

          console.log(`[${txType}] Successfully sent, hash:`, txHash);
          return txHash;
        } catch (error: unknown) {
          // Better error serialization
          let errorDetails: Record<string, unknown> = {
            type: txType,
            timestamp: new Date().toISOString(),
          };

          if (error instanceof Error) {
            errorDetails.message = error.message;
            errorDetails.stack = error.stack;
            errorDetails.name = error.name;
          } else if (typeof error === "string") {
            errorDetails.message = error;
          } else if (error && typeof error === "object") {
            // Handle EIP-1193 errors and other structured errors
            const err = error as Record<string, unknown>;
            errorDetails = {
              ...errorDetails,
              message: err.message || err.reason || String(error),
              code: err.code,
              data: err.data,
              // Common EIP-1193 error properties
              shortMessage: err.shortMessage,
              cause: err.cause,
            };
          } else {
            errorDetails.message = String(error);
          }

          console.error(`[${txType}] Failed with error:`, errorDetails);
          throw error;
        }
      };

      // Get token addresses for the swap
      let tokenInAddress: string | null = null;
      let tokenOutAddress: string | null = null;

      const addressMap: Record<string, string> = TOKEN_CONTRACTS;

      if (addressMap[sellToken.symbol]) {
        tokenInAddress = addressMap[sellToken.symbol];
      }

      if (addressMap[receiveToken.symbol]) {
        tokenOutAddress = addressMap[receiveToken.symbol];
      }

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error(
          `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`,
        );
      }

      // Step 1: Validate balance before proceeding
      const sellAmountNum = parseFloat(sellAmount);
      const balance = getTokenBalance(sellToken.symbol);

      if (sellAmountNum <= 0) {
        throw new Error("Swap amount must be greater than 0");
      }

      if (sellAmountNum > balance) {
        throw new Error(
          `Insufficient balance. You have ${balance.toFixed(6)} ${sellToken.symbol}, but trying to swap ${sellAmount} ${sellToken.symbol}`,
        );
      }

      if (
        NATIVE_TOKENS.includes(sellToken.symbol) &&
        sellAmountNum + NATIVE_USDC_GAS_RESERVE > balance
      ) {
        throw new Error(
          `Keep at least ${NATIVE_USDC_GAS_RESERVE} ${sellToken.symbol} for Arc gas. You have ${balance.toFixed(6)} ${sellToken.symbol}, so reduce the swap amount.`,
        );
      }

      // Step 2: Convert amounts to wei using correct decimals
      const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;
      const amountInWei = parseUnits(sellAmount, sellTokenDecimals).toString();

      console.log("Preparing swap via Tower Exchange:", {
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        amountInHuman: sellAmount,
        walletAddress: userAddress,
        balanceOfSellToken: balance,
        sellTokenDecimals,
      });

      // Step 3: Get swap quote from Tower Exchange backend
      let quote = await getQuote(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        slippageTolerance,
      );

      if (!quote) {
        throw new Error(
          towerError || "Failed to get swap quote from Tower Exchange",
        );
      }

      console.log("Swap quote received:", {
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        minOut: quote.minOut,
        priceImpact: quote.priceImpact,
        routeType: quote.route.type,
        hopsCount: quote.route.hops.length,
      });
      updateSwapStepsRoute(quote.route.hops[0]?.dexName);

      // Step 4: Get swap transaction (which includes approval if needed)
      console.log(
        "Building swap transaction with automatic approval detection...",
      );
      // Convert wallet balance to token's native decimals format for approval limit
      const tokenDecimals = TOKEN_DECIMALS[sellToken.symbol] ?? 18;
      const walletBalanceForApproval = parseUnits(
        sellTokenBalance.toString(),
        tokenDecimals
      ).toString();
      
      const transaction = await buildSwapTransaction(
        quote,
        userAddress,
        undefined,
        walletBalanceForApproval
      );

      if (!transaction) {
        throw new Error(towerError || "Failed to build swap transaction");
      }

      const { approval: approvalTx, swap: swapTx } = transaction;
      const approvalTxs = approvalTx
        ? Array.isArray(approvalTx)
          ? approvalTx
          : [approvalTx]
        : [];

      // Step 5: If approval is needed, submit approval transaction first
      if (approvalTxs.length > 0) {
        setSwapStepsPhase("approval");
        console.log("Approval required - submitting approval transaction...");
        try {
          for (
            let approvalIndex = 0;
            approvalIndex < approvalTxs.length;
            approvalIndex++
          ) {
            const approvalTx = approvalTxs[approvalIndex];
            const approvalLabel =
              approvalTxs.length > 1
                ? `APPROVAL ${approvalIndex + 1}/${approvalTxs.length}`
                : "APPROVAL";
            const approvalFeeParams = await getArcFeeParams().catch(
              (feeError: unknown) => {
                console.warn(
                  `[${approvalLabel}] Could not load Arc EIP-1559 fee params; wallet will choose fees`,
                  feeError,
                );
                return null;
              },
            );
            const approvalNonce = await getArcLatestNonce(
              userAddress,
              `${approvalLabel} nonce lookup`,
            );

            console.log(`Sending ${approvalLabel} transaction to MetaMask...`);
            const approveTxHash = await sendTransactionViaProvider(
              {
                to: approvalTx.to,
                data: approvalTx.data,
                value: "0x0",
                gas: approvalTx.gasLimit,
                nonce: approvalNonce,
                ...(approvalFeeParams || {}),
              },
              approvalLabel,
            );

            console.log(`${approvalLabel} transaction sent:`, approveTxHash);

            const approvalReceipt = await waitForArcTransactionReceipt(
              approveTxHash,
              {
                label: `${approvalLabel} receipt lookup`,
                maxWaitMs: 60000,
                walletReceiptLookup,
              },
            );

            if (!approvalReceipt) {
              throw new Error(
                `${approvalLabel} transaction not confirmed after 60 seconds`,
              );
            }

            if (approvalReceipt.status === "0x0") {
              throw new Error(
                `${approvalLabel} transaction failed on-chain`,
              );
            }

            console.log(`${approvalLabel} transaction confirmed:`, approvalReceipt);

            // Additional wait to ensure block is finalized
            await sleep(2000);
          }

          console.log("Approval transaction(s) confirmed successfully!");

          // CRITICAL: Rebuild swap transaction after approval to get fresh deadline
          // Using old swap data will cause "execution reverted" due to stale deadline
          console.log(
            "Rebuilding swap transaction with fresh deadline after approval...",
          );
          const freshQuote = await getQuote(
            tokenInAddress,
            tokenOutAddress,
            amountInWei,
            slippageTolerance,
          );

          if (!freshQuote) {
            throw new Error(
              towerError || "Failed to get fresh quote after approval",
            );
          }

          const freshTransaction = await buildSwapTransaction(
            freshQuote,
            userAddress,
            undefined,
            walletBalanceForApproval,
          );
          if (!freshTransaction) {
            throw new Error(
              towerError ||
                "Failed to build fresh swap transaction after approval",
            );
          }

          // Update swapTx to the fresh one with new deadline
          Object.assign(swapTx, freshTransaction.swap);
          quote = freshQuote;
          updateSwapStepsRoute(freshQuote.route.hops[0]?.dexName);

          console.log("Fresh swap transaction ready:", {
            to: swapTx.to,
            dataLength: swapTx.data?.length,
            gasLimit: swapTx.gasLimit,
          });
        } catch (approvalError: unknown) {
          let approvalErrorDetails: Record<string, unknown> = {
            context: "tokenApproval",
            timestamp: new Date().toISOString(),
            token: sellToken.symbol,
          };

          if (approvalError instanceof Error) {
            approvalErrorDetails.message = approvalError.message;
            approvalErrorDetails.stack = approvalError.stack;
            approvalErrorDetails.name = approvalError.name;
          } else if (typeof approvalError === "string") {
            approvalErrorDetails.message = approvalError;
          } else if (approvalError && typeof approvalError === "object") {
            const err = approvalError as Record<string, unknown>;
            approvalErrorDetails = {
              ...approvalErrorDetails,
              message: err.message || err.reason || String(approvalError),
              code: err.code,
              data: err.data,
            };
          } else {
            approvalErrorDetails.message = String(approvalError);
          }

          console.error(
            "Approval transaction error details:",
            approvalErrorDetails,
          );
          throw new Error(
            `Token approval failed: ${approvalErrorDetails.message || "Unknown error"}. Please try again.`,
          );
        }
      } else {
        console.log("No approval needed - proceeding with swap");
      }
      setSwapStepsPhase("confirm");

      // Step 6: Send swap transaction
      const swapDataToSend = {
        to: swapTx.to,
        value: swapTx.value,
        data: swapTx.data,
        gasLimit: swapTx.gasLimit,
      };

      // Step 7: Send swap transaction via provider
      console.log("Sending swap transaction...");
      console.log("Swap transaction data:", {
        to: swapDataToSend.to,
        value: swapDataToSend.value,
        dataLength: swapDataToSend.data?.length || 0,
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        amountIn: amountInWei,
        slippage: slippageTolerance,
      });

      // Preflight the swap before signing. If this fails, the transaction is
      // likely to be dropped or reverted, so do not broadcast it.
      let bufferedSwapGas: string | null = null;
      try {
        console.log("Estimating gas...");
        const gasEstimate = await walletRequest<unknown>(
          {
            method: "eth_estimateGas",
            params: [
              {
                from: userAddress,
                to: swapDataToSend.to,
                value: swapDataToSend.value,
                data: swapDataToSend.data,
              },
            ],
          },
          15000,
          "Swap gas estimation",
        );
        console.log("Gas estimate successful:", gasEstimate);
        bufferedSwapGas = applyGasBuffer(gasEstimate);
      } catch (estimateError: unknown) {
        // Log the error but continue - the wallet will provide its own gas estimation
        let estimateErrorDetails: Record<string, unknown> = {
          context: "gasEstimation",
          timestamp: new Date().toISOString(),
          note: "Continuing with swap - wallet will estimate gas",
        };

        if (estimateError instanceof Error) {
          estimateErrorDetails.message = estimateError.message;
          estimateErrorDetails.stack = estimateError.stack;
          estimateErrorDetails.name = estimateError.name;
        } else if (typeof estimateError === "string") {
          estimateErrorDetails.message = estimateError;
        } else if (estimateError && typeof estimateError === "object") {
          const err = estimateError as Record<string, unknown>;
          estimateErrorDetails = {
            ...estimateErrorDetails,
            message: err.message || err.reason || String(estimateError),
            code: err.code,
            data: err.data,
            shortMessage: err.shortMessage,
            cause: err.cause,
          };
        } else {
          estimateErrorDetails.message = String(estimateError);
        }

        console.error("Gas estimation error details:", estimateErrorDetails);
        throw new Error(
          `Swap preflight failed: ${
            estimateErrorDetails.message || "gas estimation failed"
          }`,
        );
      }

      // Ensure value is properly formatted (should be hex string)
      const swapValue = swapDataToSend.value?.startsWith("0x")
        ? swapDataToSend.value
        : swapDataToSend.value
          ? toHexQuantity(swapDataToSend.value)
          : "0x0";

      // CRITICAL FIX: Only zero out value for pure ERC-20 token swaps (no native tokens)
      // Native tokens (like USDC) REQUIRE non-zero ETH value via payable functions
      // ERC-20 tokens should NEVER have a non-zero value
      const isNativeInputFinal = NATIVE_TOKENS.includes(sellToken.symbol);
      const isNativeOutputFinal = NATIVE_TOKENS.includes(receiveToken.symbol);
      const finalSwapValue =
        !isNativeInputFinal && !isNativeOutputFinal ? "0x0" : swapValue;

      if (finalSwapValue !== swapValue) {
        console.warn("Corrected swap value to 0x0 for pure ERC-20 token swap", {
          originalValue: swapValue,
          correctedValue: finalSwapValue,
          sellToken: sellToken.symbol,
          receiveToken: receiveToken.symbol,
        });
      }

      const swapFeeParams = await getArcFeeParams().catch((feeError: unknown) => {
        console.warn(
          "[SWAP] Could not load Arc EIP-1559 fee params; wallet will choose fees",
          feeError,
        );
        return null;
      });
      const swapNonce = await getArcLatestNonce(userAddress, "Swap nonce lookup");

      console.log("Final swap transaction parameters:", {
        to: swapDataToSend.to,
        value: finalSwapValue,
        dataLength: swapDataToSend.data?.length,
        gasLimit: swapDataToSend.gasLimit,
      });

      const txHash = await sendTransactionViaProvider(
        {
          to: swapDataToSend.to,
          value: finalSwapValue,
          data: swapDataToSend.data,
          gas: bufferedSwapGas ?? swapDataToSend.gasLimit ?? undefined,
          nonce: swapNonce,
          ...(swapFeeParams || {}),
        },
        "SWAP",
      );

      console.log("Swap transaction executed with hash:", txHash);
      console.log("[SwapCard] Transaction hash captured:", {
        txHash,
        isString: typeof txHash === 'string',
        length: typeof txHash === 'string' ? txHash.length : 'N/A',
      });
      submittedSwapTxHash = txHash;
      setTransactionHash(txHash);
      setRevertReason(null);
      setSwapStepsPhase("wait");

      let receipt = await waitForArcTransactionReceipt(txHash, {
        label: "Swap receipt lookup",
        maxWaitMs: 120000,
        walletReceiptLookup,
      });

      if (!receipt) {
        const pendingTx = await getArcTransactionByHash(
          txHash,
          "Pending swap transaction lookup",
        ).catch((error: unknown) => {
          console.warn("[SwapCard] Could not look up pending swap transaction", {
            txHash,
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        });

        if (pendingTx && !pendingTx.blockNumber) {
          console.warn(
            "[SwapCard] Swap transaction is still pending after initial receipt timeout",
            {
              txHash,
              nonce: pendingTx.nonce,
            },
          );
          setSwapState("pending");
          setNotification("pending");
          setSwapStepsPhase("wait");

          const extendedWaitStartedAt = Date.now();
          let missingPendingLookups = 0;

          while (!receipt && Date.now() - extendedWaitStartedAt < 900000) {
            await sleep(5000);
            receipt = await waitForArcTransactionReceipt(txHash, {
              label: "Extended swap receipt lookup",
              maxWaitMs: 15000,
              pollIntervalMs: 3000,
              walletReceiptLookup,
            });

            if (receipt) {
              break;
            }

            const latestPendingTx = await getArcTransactionByHash(
              txHash,
              "Extended pending swap transaction lookup",
            ).catch(() => null);

            if (!latestPendingTx) {
              missingPendingLookups += 1;
            } else {
              missingPendingLookups = 0;
            }

            if (missingPendingLookups >= 2) {
              throw new Error(
                "Swap transaction was dropped by Arc RPC before confirmation. Retrying will replace the dropped wallet nonce with the current Arc nonce.",
              );
            }
          }

          if (!receipt) {
            console.warn(
              "[SwapCard] Swap transaction is still pending after extended receipt wait",
              { txHash },
            );
            setSwapState("idle");
            return;
          }
        } else {
          throw new Error(
            "Swap transaction was submitted, but confirmation was not received within 120 seconds and the transaction is not visible as pending on Arc RPC. Please check Arcscan before trying again.",
          );
        }
      }

      console.log("Transaction receipt received:", receipt);

      // Check if transaction was successful (status === '0x1')
      if (receipt.status === "0x0") {
        console.error("Transaction failed! Getting revert reason...");
        let decodedReason: string | null = null;

        try {
          const tx = await walletRequest<{
            from?: string;
            to?: string;
            value?: string;
            input?: string;
          } | null>(
            {
              method: "eth_getTransactionByHash",
              params: [txHash],
            },
            10000,
            "Failed swap transaction lookup",
          );

          if (tx?.from && tx?.to && tx?.input) {
            console.log(
              "Failed transaction data:",
              JSON.stringify(
                {
                  from: tx.from,
                  to: tx.to,
                  value: tx.value,
                  inputLength: tx.input?.length,
                },
                null,
                2,
              ),
            );
            // Use public RPC for eth_call so we get revert data instead of "Internal JSON-RPC error"
            decodedReason = await getRevertReasonViaPublicRpc({
              from: tx.from,
              to: tx.to,
              value: tx.value ?? "0x0",
              data: tx.input,
            });
            if (decodedReason) {
              setRevertReason(decodedReason);
              console.error("Revert reason (decoded):", decodedReason);
            }
          }
        } catch (callError: unknown) {
          const callErrorObj =
            callError instanceof Error
              ? callError
              : new Error(String(callError));
          console.error("Revert reason extraction error:", {
            message: callErrorObj.message,
            error: callError,
          });
        }

        throw new Error(
          decodedReason
            ? `Transaction failed: ${decodedReason}`
            : "Transaction failed on-chain (status: 0x0)",
        );
      }

      console.log("[SwapCard] TowerSwapExecutor swap settled:", {
        txHash,
        feeMode: swapTx?.feeMode,
        feeToken: swapTx?.feeToken,
        platformFeeAmount: swapTx?.platformFeeAmount,
        executorAddress: swapTx?.executorAddress,
      });
      await fetchUserBalances();

      const swapActivityId = await logSwapActivity(
        "Successful",
        txHash,
        quote.route.hops[0]?.dexName || getActiveSwapRouteName(),
      );

      if (
        swapTx?.feeMode === "tower-swap-executor" &&
        swapTx.platformFeeAmount &&
        swapTx.feeToken
      ) {
        const receiptBlockNumber =
          typeof receipt.blockNumber === "string"
            ? Number.parseInt(receipt.blockNumber, 16)
            : undefined;
        const swapFeeResult = await recordExecutorSwapFee({
          walletAddress: userAddress,
          tokenAddress: swapTx.feeToken,
          tokenSymbol: sellToken.symbol,
          totalAmount: amountInWei,
          feeAmount: swapTx.platformFeeAmount,
          feeBps: swapTx.feeBps ?? quote.feeBps ?? 25,
          transactionHash: txHash,
          blockNumber: receiptBlockNumber,
          activityId: swapActivityId,
          usdPrice: sellToken.usdPrice,
        });

        if (!swapFeeResult.success) {
          console.error("[SwapCard] Failed to persist executor swap fee:", {
            txHash,
            error: swapFeeResult.error,
          });
        }
      }

      setSwapStepsPhase("success");
      markSwapSuccess(txHash);
    } catch (error: unknown) {
      // Better error serialization for swap errors
      let errorDetails: Record<string, unknown> = {
        context: "handleSwap",
        timestamp: new Date().toISOString(),
        sellToken: sellToken.symbol,
        receiveToken: receiveToken?.symbol || "Not Selected",
        sellAmount,
        transactionHash: submittedSwapTxHash ?? undefined,
        revertReason: revertReason ?? undefined,
      };

      if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.stack = error.stack;
        errorDetails.name = error.name;
      } else if (typeof error === "string") {
        errorDetails.message = error;
      } else if (error && typeof error === "object") {
        // Handle EIP-1193 errors and other structured errors
        const err = error as Record<string, unknown>;
        errorDetails = {
          ...errorDetails,
          message: err.message || err.reason || String(error),
          code: err.code,
          data: err.data,
          shortMessage: err.shortMessage,
          cause: err.cause,
        };
      } else {
        errorDetails.message = String(error);
      }

      if (successNotificationTimeout) {
        clearTimeout(successNotificationTimeout);
      }
      if (successResetTimeout) {
        clearTimeout(successResetTimeout);
      }

      // Ensure UI shows decoded revert reason (state may not have updated yet)
      const msg = errorDetails.message as string | undefined;
      const decodedFromMessage = msg?.startsWith("Transaction failed: ")
        ? msg.slice("Transaction failed: ".length)
        : null;
      if (decodedFromMessage) {
        const displayReason =
          decodedFromMessage.toLowerCase() === "execution reverted"
            ? "Execution reverted (check allowance, slippage, or liquidity)"
            : decodedFromMessage;
        setRevertReason(displayReason);
        errorDetails.revertReason = decodedFromMessage;
        if (decodedFromMessage.toLowerCase() === "execution reverted") {
          errorDetails.hint =
            "Try: approve the sell token again, or increase slippage in Settings.";
        }
      }

      console.error(
        "Swap transaction error - Full details:",
        JSON.stringify(errorDetails, null, 2),
      );

      setSwapStepsPhase("failed");
      setSwapStepsFailedPhase(
        submittedSwapTxHash
          ? "wait"
          : typeof errorDetails.message === "string" &&
              errorDetails.message.toLowerCase().includes("approval")
            ? "approval"
            : "confirm",
      );
      setSwapStepsFailureMessage(
        typeof errorDetails.message === "string"
          ? errorDetails.message
          : "Swap failed",
      );
      setSwapState("failed");
      setNotification("failed");
      setNotificationSwapDetails(null);
      if (!submittedSwapTxHash) {
        setTransactionHash(null);
      }

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);

      setTimeout(() => {
        setSwapState("idle");
        setRevertReason(null);
      }, 3000);
    }
  };

  // Get button content based on state
  const getButtonContent = () => {
    if (SWAPS_DISABLED) {
      return "Swaps Paused";
    }

    if (!isWalletConnected) {
      return "Connect Wallet";
    }

    if (swapState === "loading" || swapState === "pending") {
      return "Swap";
    }

    if (isSwapBalanceInsufficient) {
      return "Insufficient Balance";
    }

    if (!isSwapActive) {
      return "Swap";
    }

    return "Swap";
  };

  // Get button styles based on state
  const getButtonStyles = () => {
    const baseStyles =
      "w-full rounded-xl h-14 text-base font-semibold text-black transition-all";

    if (swapState === "loading" || swapState === "pending") {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    if (
      SWAPS_DISABLED ||
      (isWalletConnected && (!isSwapActive || isSwapBalanceInsufficient))
    ) {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    return `${baseStyles} bg-primary hover:opacity-90`;
  };

  const activeNotificationSwapDetails =
    notificationSwapDetails ??
    (receiveToken
      ? {
          sellAmount,
          sellTokenSymbol: sellToken.symbol,
          receiveAmount,
          receiveTokenSymbol: receiveToken.symbol,
        }
      : null);

  const isSwapStepComplete = (step: "approval" | "confirm" | "wait") => {
    if (swapStepsPhase === "success") {
      return true;
    }

    if (swapStepsPhase === "wait") {
      return step === "approval" || step === "confirm";
    }

    if (swapStepsPhase === "confirm") {
      return step === "approval";
    }

    return false;
  };

  const getSwapStepStatus = (
    step: "approval" | "confirm" | "wait" | "receive",
  ): TransactionStep["status"] => {
    if (swapStepsPhase === "failed") {
      if (step === swapStepsFailedPhase) {
        return "failed";
      }

      if (step === "receive") {
        return "pending";
      }

      return isSwapStepComplete(step) ? "complete" : "pending";
    }

    if (swapStepsPhase === "success") {
      return "complete";
    }

    if (step === "receive") {
      return "pending";
    }

    if (step === swapStepsPhase) {
      return "active";
    }

    return isSwapStepComplete(step) ? "complete" : "pending";
  };

  const swapTransactionSteps: TransactionStep[] = [
    {
      id: "approve",
      label: `Approve ${swapStepsDetails.sellTokenSymbol}`,
      status: getSwapStepStatus("approval"),
      detail:
        swapStepsPhase === "failed" && swapStepsFailedPhase === "approval"
          ? swapStepsFailureMessage || "Approval failed"
          : getSwapStepStatus("approval") === "active"
            ? "Approving in your wallet"
            : undefined,
      kind: "wallet",
    },
    {
      id: "confirm",
      label: "Confirm Swap",
      status: getSwapStepStatus("confirm"),
      detail:
        swapStepsPhase === "failed" && swapStepsFailedPhase === "confirm"
          ? swapStepsFailureMessage || "Swap failed"
          : getSwapStepStatus("confirm") === "active"
            ? "Confirming in your wallet"
            : undefined,
      kind: "wallet",
    },
    {
      id: "wait",
      label: "Wait ~2 sec",
      status: getSwapStepStatus("wait"),
      detail:
        swapStepsPhase === "failed" && swapStepsFailedPhase === "wait"
          ? swapStepsFailureMessage || "Confirmation failed"
          : getSwapStepStatus("wait") === "active"
            ? "Waiting on Arc"
            : undefined,
      kind: "wait",
    },
    {
      id: "receive",
      label: `Got ${swapStepsDetails.receiveAmount || "0.00"} ${
        swapStepsDetails.receiveTokenSymbol || "tokens"
      } on Arc`,
      status: getSwapStepStatus("receive"),
    },
  ];
  const swapActivityProgressByPhase: Record<typeof swapStepsPhase, number> = {
    approval: 18,
    confirm: 44,
    wait: 72,
    success: 100,
    failed: 100,
  };
  const isSwapActivityProcessing =
    swapState === "loading" || swapState === "pending";
  const shouldShowSwapPendingIndicator =
    isSwapActivityProcessing && !swapStepsModalOpen;
  const swapLiveActivityItems: ActivityTabLiveItem[] =
    isSwapActivityProcessing
      ? [
          {
            id: transactionHash || "active-swap",
            kind: "swap",
            title: `Swap ${swapStepsDetails.sellAmount} ${
              swapStepsDetails.sellTokenSymbol
            } to ${swapStepsDetails.receiveAmount || "0.00"} ${
              swapStepsDetails.receiveTokenSymbol || "tokens"
            }`,
            routeLabel: swapStepsDetails.dexName || getActiveSwapRouteName(),
            status: "processing",
            statusLabel: "Submitting Swap",
            progress: swapActivityProgressByPhase[swapStepsPhase],
            timestamp: swapActivityStartedAt ?? Date.now(),
            sourceIcon: swapStepsDetails.sellTokenIcon,
            targetIcon: swapStepsDetails.receiveTokenIcon,
            sourceChainIcon: arcTestnetLogo,
            targetChainIcon: arcTestnetLogo,
            transactionHash,
            onClick: () => {
              setIsActivityOpen(false);
              setSwapStepsModalOpen(true);
            },
          },
        ]
      : [];

  return (
    <div className="flex w-full items-start justify-center gap-6">
      <TransactionStepsModal
        isOpen={swapStepsModalOpen}
        onClose={() => setSwapStepsModalOpen(false)}
        variant="swap"
        title={`Swap ${swapStepsDetails.sellAmount} ${
          swapStepsDetails.sellTokenSymbol
        } to ${swapStepsDetails.receiveAmount || "0.00"} ${
          swapStepsDetails.receiveTokenSymbol || ""
        }`.trim()}
        subtitle={`via ${swapStepsDetails.dexName || getActiveSwapRouteName()}`}
        fromIcon={swapStepsDetails.sellTokenIcon}
        toIcon={swapStepsDetails.receiveTokenIcon}
        fromBadgeIcon={arcTestnetLogo}
        toBadgeIcon={arcTestnetLogo}
        steps={swapTransactionSteps}
      />
      <ActivityTabModal
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        isWalletConnected={isWalletConnected}
        walletAddress={user?.wallet?.address ?? null}
        liveItems={swapLiveActivityItems}
      />

      {/* Swap Notification */}
      <AnimatePresence>
        {notification && activeNotificationSwapDetails && !swapStepsModalOpen && (
          <SwapNotification
            type={notification}
            sellAmount={activeNotificationSwapDetails.sellAmount}
            sellToken={activeNotificationSwapDetails.sellTokenSymbol}
            receiveAmount={activeNotificationSwapDetails.receiveAmount}
            receiveToken={activeNotificationSwapDetails.receiveTokenSymbol}
            onClose={() => {
              setNotification(null);
              setNotificationSwapDetails(null);
              // CRITICAL: Refresh balances when user closes the notification
              // This ensures the displayed balance is up-to-date after successful swap
              if (notification === "success") {
                console.log(
                  "[SwapCard] Success notification closed - refreshing balances",
                );
                fetchUserBalances();
              }
            }}
            transactionHash={transactionHash}
            revertReason={revertReason}
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-md shrink-0">
        <motion.div
          className="bg-[#191A1C] border border-border rounded-2xl px-6 pt-6 pb-6 flex flex-col"
          whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#111214] p-1">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#1f2125] text-foreground"
              >
                Swap
              </button>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleNavigateToBridge();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  handleNavigateToBridge();
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground"
              >
                Bridge
              </button>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                aria-label="Open activity tab"
                onClick={() => setIsActivityOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg p-2 transition-colors cursor-pointer ml-1 ${shouldShowSwapPendingIndicator ? "bg-secondary hover:bg-secondary" : "hover:bg-secondary"}`}
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
                {shouldShowSwapPendingIndicator ? (
                  <span className="text-xs font-medium text-gray-300">
                    Pending
                  </span>
                ) : null}
              </motion.button>
              <motion.button
                onClick={() => setIsChartOpen(!isChartOpen)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <BarChart3 className="w-5 h-5 text-white" />
              </motion.button>
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </div>

          {SWAPS_DISABLED && (
            <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
              {SWAPS_DISABLED_MESSAGE}
            </div>
          )}

          {/* Sell Section */}
          <div className="bg-[#151617] rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-2 ">
              <span className="text-sm text-muted-foreground">Sell</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Wallet className="w-4 h-4" />
                <span>
                  {isLoadingBalances
                    ? "Loading..."
                    : `${getFormattedBalance(sellToken.symbol)} ${sellToken.symbol}`}
                </span>
                <button
                  onClick={handle50Percent}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={handleMaxAmount}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <TokenSelector
                selected={sellToken}
                onOpenModal={() => setIsSellTokenModalOpen(true)}
              />
              <TokenInput
                value={sellAmount}
                onChange={handleSellAmountChange}
                onClear={resetSwapForm}
                usdValueLabel={sellUsdValueLabel}
              />
            </div>
          </div>

          {/* Swap Arrow Button */}
          <div className="flex justify-center -my-6 relative z-10">
            <motion.button
              onClick={handleSwapTokens}
              className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors"
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          {/* Receive Section */}
          <div className="bg-[#151617] rounded-xl p-4 mt-2 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receive</span>
              {receiveToken && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="w-4 h-4" />
                  <span>
                    {isLoadingBalances
                      ? "Loading..."
                      : `${getFormattedBalance(receiveToken.symbol)} ${receiveToken.symbol}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <TokenSelector
                selected={receiveToken}
                onOpenModal={() => setIsReceiveTokenModalOpen(true)}
              />
              <TokenInput
                value={receiveAmount}
                onChange={setReceiveAmount}
                onClear={resetSwapQuote}
                usdValueLabel={effectiveReceiveUsdValueLabel}
              />
            </div>
          </div>

          {/* Action Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={isWalletConnected ? handleSwap : handleConnectWallet}
              disabled={
                SWAPS_DISABLED ||
                swapState === "loading" ||
                swapState === "pending" ||
                (isWalletConnected && (!isSwapActive || isSwapBalanceInsufficient))
              }
              className={getButtonStyles()}
            >
              {getButtonContent()}
            </Button>
          </motion.div>

          {shouldShowRouterDisplay && (
            <div className="mt-4">
              <RouterDisplay
                selectedRouterId={selectedRouterId}
                routeOptions={routeOptions}
                isAutoSelected={!selectedRouterId}
                quoteUsdValueLabel={
                  shouldUseQuoteUsdValueLabel
                    ? effectiveReceiveUsdValueLabel
                    : undefined
                }
              />
            </div>
          )}
        </motion.div>

        {/* Token Quick Access Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 w-full">
          <motion.button
            onClick={() => setSellToken(sellToken)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
              <Image
                src={sellToken.icon}
                alt={`${sellToken.symbol} logo`}
                width={24}
                height={24}
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-medium text-foreground">
              {sellToken.symbol}
            </span>
            <span className="text-muted-foreground">
              {formatUsdAmount(1, sellToken.usdPrice)}
            </span>
          </motion.button>
          {receiveToken && (
            <motion.button
              onClick={() => setReceiveToken(receiveToken)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
                <Image
                  src={receiveToken.icon}
                  alt={`${receiveToken.symbol} logo`}
                  width={24}
                  height={24}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="font-medium text-foreground">
                {receiveToken.symbol}
              </span>
              <span className="text-muted-foreground">
                {formatUsdAmount(1, receiveToken.usdPrice)}
              </span>
            </motion.button>
          )}
        </div>

        {/* Modals */}
        <TokenModal
          isOpen={isSellTokenModalOpen}
          onClose={() => setIsSellTokenModalOpen(false)}
          selected={sellToken}
          onSelect={handleSellTokenSelect}
          excludeSymbol={receiveToken?.symbol || ""}
          availableTokens={availableSellTokens}
          tokenBalances={tokenBalances}
        />

        <TokenModal
          isOpen={isReceiveTokenModalOpen}
          onClose={() => setIsReceiveTokenModalOpen(false)}
          selected={receiveToken || availableReceiveTokens[0] || sellToken}
          onSelect={handleReceiveTokenSelect}
          excludeSymbol={sellToken.symbol}
          availableTokens={availableReceiveTokens}
          tokenBalances={tokenBalances}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          slippageTolerance={slippageTolerance}
          onSlippageChange={setSlippageTolerance}
        />
      </div>

      <AnimatePresence>
        {isChartOpen && (
          <ChartModal
            isOpen={isChartOpen}
            onClose={() => setIsChartOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwapCard;
