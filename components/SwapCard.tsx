"use client";
import {
  ArrowDown,
  BarChart3,
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
import {
  supabase,
  registerSwapFee,
  updateSwapFeeConfirmation,
  formatTokenAmountByAddress,
} from "@/lib/supabase";
import { formatUsdAmount } from "@/lib/formatUsdAmount";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import {
  getBrowserWalletChainId,
  getBrowserWalletProvider,
  type BrowserWalletTransactionReceipt,
} from "@/lib/browser-wallet";
const NATIVE_USDC_GAS_RESERVE = 0.05;
const QUOTE_REFRESH_INTERVAL_MS = 10000;
const SWAP_SUCCESS_NOTIFICATION_DURATION_MS = 10000;
const SWAP_SUCCESS_RESET_DELAY_MS = SWAP_SUCCESS_NOTIFICATION_DURATION_MS + 500;
const ARC_RPC_PROXY_URL = `/api/rpc/${ARC_TESTNET_CONFIG.chainId}`;
const ARC_NATIVE_USDC_DECIMALS = 18;
const RECEIPT_REQUEST_TIMEOUT_MS = 12000;
const RECEIPT_POLL_INTERVAL_MS = 1000;
const FEE_COLLECTOR_ADDRESS = "0xE71e5baDb9528647F0dd42298bC543D493FC9E40";
const BALANCE_OF_SELECTOR = "0x70a08231";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type TransactionReceiptLog = {
  address?: string;
  topics?: string[];
  data?: string;
};

type RpcTransaction = {
  blockNumber?: string | null;
  hash?: string;
  nonce?: string;
};

type BalanceIncreaseResult = {
  currentBalance: bigint;
  increase: bigint;
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

const encodeErc20BalanceOf = (ownerAddress: string): string => {
  const normalizedAddress = ownerAddress.replace(/^0x/i, "").toLowerCase();
  if (normalizedAddress.length !== 40) {
    throw new Error(`Invalid address for balance lookup: ${ownerAddress}`);
  }

  return `${BALANCE_OF_SELECTOR}${normalizedAddress.padStart(64, "0")}`;
};

const getTokenBalanceAtAddress = async (
  tokenAddress: string,
  ownerAddress: string,
  label: string,
): Promise<bigint> => {
  const rawBalance = await callArcRpc<string>(
    "eth_call",
    [
      {
        to: tokenAddress,
        data: encodeErc20BalanceOf(ownerAddress),
      },
      "latest",
    ],
    RECEIPT_REQUEST_TIMEOUT_MS,
    label,
  );

  return BigInt(rawBalance || "0x0");
};

const waitForTokenBalanceIncrease = async (
  tokenAddress: string,
  ownerAddress: string,
  previousBalance: bigint,
  minimumIncrease: bigint,
  label: string,
): Promise<BalanceIncreaseResult | null> => {
  const requiredBalance = previousBalance + minimumIncrease;

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const currentBalance = await getTokenBalanceAtAddress(
      tokenAddress,
      ownerAddress,
      label,
    );
    const increase =
      currentBalance > previousBalance ? currentBalance - previousBalance : 0n;

    if (currentBalance >= requiredBalance) {
      return {
        currentBalance,
        increase,
      };
    }

    if (attempt === 1 || attempt === 12) {
      console.warn(`${label} has not reached the expected balance yet`, {
        tokenAddress,
        ownerAddress,
        previousBalance: previousBalance.toString(),
        minimumIncrease: minimumIncrease.toString(),
        currentBalance: currentBalance.toString(),
        increase: increase.toString(),
      });
    }

    await sleep(1000);
  }

  return null;
};

const addressToTopic = (address: string) =>
  `0x${address.replace(/^0x/i, "").toLowerCase().padStart(64, "0")}`;

const sumTransferAmountFromReceipt = (
  receipt: BrowserWalletTransactionReceipt,
  tokenAddress: string,
  filters: {
    from?: string;
    to?: string;
  },
) => {
  const logs = Array.isArray(receipt.logs)
    ? (receipt.logs as TransactionReceiptLog[])
    : [];
  const token = tokenAddress.toLowerCase();
  const fromTopic = filters.from ? addressToTopic(filters.from) : null;
  const toTopic = filters.to ? addressToTopic(filters.to) : null;

  return logs.reduce((total, log) => {
    const [eventTopic, from, to] = log.topics || [];

    if ((log.address || "").toLowerCase() !== token) {
      return total;
    }

    if ((eventTopic || "").toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      return total;
    }

    if (fromTopic && (from || "").toLowerCase() !== fromTopic) {
      return total;
    }

    if (toTopic && (to || "").toLowerCase() !== toTopic) {
      return total;
    }

    return total + BigInt(log.data && log.data !== "0x" ? log.data : "0x0");
  }, 0n);
};

const amountFrom18Decimals = (amount: string | undefined, decimals: number) => {
  if (!amount) {
    return null;
  }

  try {
    const amountBn = BigInt(amount);

    if (decimals === 18) {
      return amountBn;
    }

    return decimals < 18
      ? amountBn / 10n ** BigInt(18 - decimals)
      : amountBn * 10n ** BigInt(decimals - 18);
  } catch {
    return null;
  }
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
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
  const [isWalletConnected, setIsWalletConnected] = useState(
    Boolean(authenticated && user),
  );
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

  const logSwapActivity = useCallback(
    async (status: "Successful" | "Failed", txHash?: string | null) => {
      try {
        if (!user?.wallet?.address) return;
        const amountUsd = (parseFloat(sellAmount) || 0) * sellToken.usdPrice;
        await supabase.from("activities").insert({
          wallet_address: user.wallet.address.toLowerCase(),
          type: "Swap",
          source_currency_ticker: sellToken.symbol,
          destination_currency_ticker: receiveToken?.symbol || null,
          source_network_name: "Arc",
          destination_network_name: "Arc",
          status,
          amount: parseFloat(sellAmount) || null,
          amount_usd: amountUsd || null,
          transaction_hash: txHash || null,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Error logging swap activity:", e);
      }
    },
    [
      sellToken.symbol,
      receiveToken?.symbol,
      sellAmount,
      user?.wallet?.address,
      sellToken.usdPrice,
    ],
  );

  // Actual wallet balances for tokens currently supported on the swap card
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    USDC: 0,
    EURC: 0,
    USDT: 0,
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);
  const sellUsdValueLabel = formatUsdAmount(sellAmount, sellToken.usdPrice);
  const shouldUseInputUsdValueForReceive =
    receiveToken?.symbol === "EURC" &&
    Number.parseFloat(sellAmount) > 0 &&
    Number.parseFloat(receiveAmount) > 0;
  const receiveUsdValueLabel = formatUsdAmount(
    receiveAmount,
    receiveToken?.usdPrice ?? 0,
  );
  const effectiveReceiveUsdValueLabel = shouldUseInputUsdValueForReceive
    ? sellUsdValueLabel
    : receiveUsdValueLabel;

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
      const [usdcBalance, eurcBalance, usdtBalance] = await Promise.all([
        fetchSwapTokenBalance("USDC"),
        fetchSwapTokenBalance("EURC"),
        fetchSwapTokenBalance("USDT"),
      ]);

      console.log("Swap token balances:", {
        USDC: usdcBalance,
        EURC: eurcBalance,
        USDT: usdtBalance,
      });

      setTokenBalances((prev) => ({
        ...prev,
        USDC: usdcBalance,
        EURC: eurcBalance,
        USDT: usdtBalance,
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
      setIsWalletConnected(true);
      fetchUserBalances();
    } else {
      setIsWalletConnected(false);
      setTokenBalances({
        USDC: 0,
        EURC: 0,
        USDT: 0,
      });
    }
  }, [authenticated, user, fetchUserBalances]);

  // Get display balance for a token (actual if available, mock otherwise)
  const getTokenBalance = (symbol: string): number => {
    return tokenBalances[symbol] || 0;
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
      setReceiveAmount("0.00");
      setRouteOptions([]);
      setSelectedRouterId(undefined);
    }
  }, [availableReceiveTokens, receiveToken, sellToken.symbol]);

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
    setReceiveAmount("0.00");
    setRouteOptions([]);
    setSelectedRouterId(undefined);
  };

  const handleReceiveTokenSelect = (token: SwapToken) => {
    setReceiveToken(token);
    setReceiveAmount("0.00");
    setRouteOptions([]);
    setSelectedRouterId(undefined);
  };

  // Get swap quote from Tower Exchange backend
  const getQuoteForSwap = useCallback(
    async (sellAmountValue: string, routerId?: string) => {
      try {
        if (
          !receiveToken ||
          !isSupportedSwapPair(sellToken.symbol, receiveToken.symbol)
        ) {
          setReceiveAmount("0.00");
          setRouteOptions([]);
          setSelectedRouterId(undefined);
          return;
        }

        const addressMap: Record<string, string> = TOKEN_CONTRACTS;
        const tokenInAddress = addressMap[sellToken.symbol] ?? null;
        const tokenOutAddress = addressMap[receiveToken.symbol] ?? null;

        if (!tokenInAddress || !tokenOutAddress) {
          console.warn(
            `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`,
          );
          setReceiveAmount("0.00");
          setRouteOptions([]);
          setSelectedRouterId(undefined);
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
        const displayPrecision = Math.min(receiveTokenDecimals, 6);
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
        setReceiveAmount("0.00");
        setRouteOptions([]);
        setSelectedRouterId(undefined);
      }
    },
    [getQuote, receiveToken, sellToken.symbol, slippageTolerance, towerError],
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
      setReceiveAmount("0.00");
      setRouteOptions([]);
      setSelectedRouterId(undefined);
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
      setIsWalletConnected(true);
      setSwapState("idle");
      return;
    }

    try {
      setSwapState("loading");
      // Trigger the RainbowKit wallet modal
      await login();
      setIsWalletConnected(true);
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
    setSwapState("loading");
    setRevertReason(null);
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
        setSwapState("success");
        setNotification("success");

        // Auto-dismiss after a longer confirmation window so users can review/open the transaction.
        successNotificationTimeout = setTimeout(() => {
          setNotification(null);
        }, SWAP_SUCCESS_NOTIFICATION_DURATION_MS);

        // Reset after the success modal has had time to remain visible.
        successResetTimeout = setTimeout(() => {
          setSellAmount("0.00");
          setReceiveAmount("0.00");
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

      // Step 4: Get swap transaction (which includes approval if needed)
      console.log(
        "Building swap transaction with automatic approval detection...",
      );
      const transaction = await buildSwapTransaction(quote, userAddress);

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

      const feeCollectorOutput = swapTx?.expectedFeeCollectorOutput;
      const outputTokenForFee = tokenOutAddress || quote.outputToken;
      const inputAmountForFeeValidation = parseUnits(
        sellAmount,
        TOKEN_DECIMALS[sellToken.symbol] || 18,
      ).toString();
      let feeCollectorBalanceBefore: bigint | null = null;

      if (feeCollectorOutput && feeCollectorOutput !== "0") {
        if (!outputTokenForFee) {
          throw new Error("Missing output token for fee distribution");
        }

        feeCollectorBalanceBefore = await getTokenBalanceAtAddress(
          outputTokenForFee,
          FEE_COLLECTOR_ADDRESS,
          "FeeCollector pre-swap output balance lookup",
        );

        console.log("[SwapCard] FeeCollector balance before swap:", {
          outputToken: outputTokenForFee,
          balanceBefore: feeCollectorBalanceBefore.toString(),
          expectedSwapOutput: feeCollectorOutput,
        });
      }

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

      // Step 8: Submit platform fee with atomic distribution through FeeCollector
      // Swap output went to FeeCollector, now execute atomic fee split
      console.log("[SwapCard] Fee collection check:", {
        hasExpectedFeeCollectorOutput: !!feeCollectorOutput,
        feeCollectorOutput: feeCollectorOutput,
        platformFeeAmount: swapTx?.platformFeeAmount,
        expectedUserOutput: swapTx?.expectedUserOutput,
        isNativeUSDC: sellToken.symbol === "USDC",
      });

      if (feeCollectorOutput && feeCollectorOutput !== "0") {
        const feeSubmitUrl = "/api/swap/submit-fee";
        const quotedFeeCollectorOutput = BigInt(feeCollectorOutput);
        const outputTokenDecimals = TOKEN_DECIMALS[receiveToken.symbol] || 18;
        const minFeeCollectorOutputFromQuote = amountFrom18Decimals(
          quote.minOut,
          outputTokenDecimals,
        );
        const minimumFeeCollectorOutput =
          minFeeCollectorOutputFromQuote && minFeeCollectorOutputFromQuote > 0n
            ? minFeeCollectorOutputFromQuote
            : 1n;

        if (!outputTokenForFee) {
          throw new Error("Missing output token for fee distribution");
        }

        if (feeCollectorBalanceBefore === null) {
          throw new Error(
            "Missing FeeCollector balance snapshot. Fee distribution was stopped to protect existing funds.",
          );
        }

        const feeCollectorOutputFromReceipt = sumTransferAmountFromReceipt(
          receipt,
          outputTokenForFee,
          { to: FEE_COLLECTOR_ADDRESS },
        );
        const receiptShowsFeeCollectorOutput =
          feeCollectorOutputFromReceipt >= minimumFeeCollectorOutput;
        const feeCollectorBalanceIncrease = receiptShowsFeeCollectorOutput
          ? null
          : await waitForTokenBalanceIncrease(
              outputTokenForFee,
              FEE_COLLECTOR_ADDRESS,
              feeCollectorBalanceBefore,
              minimumFeeCollectorOutput,
              "FeeCollector post-swap output balance lookup",
            );
        const settledFeeCollectorOutput = receiptShowsFeeCollectorOutput
          ? feeCollectorOutputFromReceipt
          : feeCollectorBalanceIncrease?.increase ?? 0n;

        if (settledFeeCollectorOutput < minimumFeeCollectorOutput) {
          throw new Error(
            "Swap confirmed, but the FeeCollector did not receive the minimum output from this swap. Fee distribution was stopped so existing FeeCollector funds are not sent out.",
          );
        }

        console.log("[SwapCard] Submitting fee with atomic distribution:", {
          outputToken: outputTokenForFee,
          totalAmount: settledFeeCollectorOutput.toString(),
          quotedFeeCollectorOutput: quotedFeeCollectorOutput.toString(),
          minimumFeeCollectorOutput: minimumFeeCollectorOutput.toString(),
          userAddress: userAddress,
          feeSubmitUrl,
          sellToken: sellToken.symbol,
          feeCollectorBalanceBefore: feeCollectorBalanceBefore.toString(),
          feeCollectorBalanceAfter:
            feeCollectorBalanceIncrease?.currentBalance.toString(),
          feeCollectorBalanceIncrease:
            feeCollectorBalanceIncrease?.increase.toString(),
          feeCollectorOutputFromReceipt:
            feeCollectorOutputFromReceipt.toString(),
          proofSource: receiptShowsFeeCollectorOutput
            ? "swap receipt transfer logs"
            : "FeeCollector balance increase",
        });

        try {
          console.log("[SwapCard] Submitting fee with transaction hash:", {
            txHash,
            txHashPresent: !!txHash,
            outputToken: outputTokenForFee,
            totalAmount: settledFeeCollectorOutput.toString(),
            userAddress,
          });

          const feeResponse = await withTimeout(
            fetch(feeSubmitUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                outputToken: outputTokenForFee,
                totalAmount: settledFeeCollectorOutput.toString(), // Actual amount the FeeCollector received
                userAddress: userAddress, // User address to receive (amount - fee)
                feeBps: 25, // 0.25% = 25 basis points
                swapTransactionHash: txHash,
                feeCollectorBalanceBefore: feeCollectorBalanceBefore.toString(),
                inputToken: tokenInAddress,
                inputAmount: inputAmountForFeeValidation,
              }),
            }),
            180000,
            "Fee distribution",
          );

          if (!feeResponse.ok) {
            const feeError = await withTimeout(
              feeResponse.text(),
              10000,
              "Fee error response",
            );
            console.warn("[SwapCard] Fee submission response not OK:", {
              status: feeResponse.status,
              error: feeError,
            });
            throw new Error(
              `Fee distribution failed (${feeResponse.status}): ${feeError}`,
            );
          } else {
            const feeResult = await withTimeout(
              feeResponse.json(),
              10000,
              "Fee distribution response",
            );
            const feeDistributionTxHash =
              feeResult.data?.transactionHash || feeResult.transactionHash;
            if (!feeDistributionTxHash) {
              throw new Error("Fee distribution did not return a transaction hash");
            }

            console.log(
              "[SwapCard] Atomic fee collection and distribution successful:",
              {
                transactionHash: feeDistributionTxHash,
                outputToken:
                  feeResult.data?.outputToken || feeResult.outputToken,
                feeAmount: feeResult.data?.feeAmount || feeResult.feeAmount,
              },
            );

            // Record the fee in the database
            let registerResult: Awaited<
              ReturnType<typeof registerSwapFee>
            > | null = null;
            const feeAmount =
              feeResult.data?.feeAmount || feeResult.feeAmount || "0";
            if (userAddress && feeAmount !== "0") {
              const formattedFeeAmount = formatTokenAmountByAddress(
                feeAmount,
                outputTokenForFee,
              );
              const feeUsdValue = formattedFeeAmount * receiveToken.usdPrice;
              registerResult = await registerSwapFee({
                walletAddress: userAddress,
                tokenAddress: outputTokenForFee,
                tokenSymbol: receiveToken.symbol,
                feeAmount: feeAmount,
                feeAmountUsd: feeUsdValue.toString(),
                feeBasisPoints: 25,
                totalAmount: settledFeeCollectorOutput.toString(),
                transactionHash: feeDistributionTxHash,
                status: "Recorded",
              });

              if (registerResult.success) {
                console.log("[SwapCard] Fee recorded in database:", {
                  feeId: registerResult.id,
                  feeAmount,
                  feeAmountFormatted: formattedFeeAmount,
                  feeAmountUsd: feeUsdValue,
                });
              } else {
                console.warn(
                  "[SwapCard] Failed to record fee in database:",
                  registerResult.error,
                );
              }
            }

            // CRITICAL: Wait for fee distribution transaction to finalize before refreshing balance
            // This ensures the user receives their tokens before we query the balance
            if (feeDistributionTxHash) {
              const backendBlockNumber = feeResult.data?.blockNumber
                ? Number(feeResult.data.blockNumber)
                : null;
              let confirmedBlockNumber =
                backendBlockNumber !== null && Number.isFinite(backendBlockNumber)
                  ? backendBlockNumber
                  : null;

              if (confirmedBlockNumber === null) {
                console.log(
                  "[SwapCard] Waiting for fee distribution transaction to finalize:",
                  feeDistributionTxHash,
                );

                const feeReceipt = await waitForArcTransactionReceipt(
                  feeDistributionTxHash,
                  {
                    label: "Fee distribution receipt lookup",
                    maxWaitMs: 45000,
                    walletReceiptLookup,
                  },
                );

                if (feeReceipt?.status === "0x0") {
                  throw new Error(
                    "Fee distribution transaction failed on-chain",
                  );
                }

                if (feeReceipt?.status === "0x1" && feeReceipt.blockNumber) {
                  console.log(
                    "[SwapCard] Fee distribution transaction confirmed!",
                  );
                  confirmedBlockNumber = parseInt(feeReceipt.blockNumber, 16);
                }
              }

              if (confirmedBlockNumber === null) {
                console.warn(
                  "Fee distribution transaction was submitted, but confirmation was not received within 45 seconds. Continuing because backend accepted the split transaction.",
                  { feeDistributionTxHash },
                );
              }

              if (
                confirmedBlockNumber !== null &&
                registerResult &&
                registerResult.success &&
                registerResult.id
              ) {
                await updateSwapFeeConfirmation(
                  registerResult.id,
                  feeDistributionTxHash,
                  confirmedBlockNumber,
                ).catch((err) => {
                  console.warn(
                    "[SwapCard] Failed to update fee confirmation:",
                    err,
                  );
                });
              }

              console.log(
                "[SwapCard] Refreshing balance after fee distribution confirmed",
              );
              await fetchUserBalances();
            }
          }
        } catch (feeError: unknown) {
          console.error(
            "[SwapCard] Error submitting fee with atomic distribution:",
            {
              message:
                feeError instanceof Error ? feeError.message : String(feeError),
              outputToken: outputTokenForFee,
              totalAmount: settledFeeCollectorOutput.toString(),
            },
          );
          throw new Error(
            `Fee distribution failed: ${
              feeError instanceof Error ? feeError.message : String(feeError)
            }`,
          );
        }
      } else {
        console.warn(
          "[SwapCard] Skipping fee submission - no expectedFeeCollectorOutput or value is 0",
        );
      }

      await logSwapActivity("Successful", txHash);
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

      setSwapState("failed");
      setNotification("failed");
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
    if (!isWalletConnected) {
      return "Connect Wallet";
    }

    if (swapState === "loading") {
      return (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          <span>Loading</span>
        </div>
      );
    }

    if (swapState === "pending") {
      return "Pending";
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

    if (isWalletConnected && (!isSwapActive || isSwapBalanceInsufficient)) {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    return `${baseStyles} bg-primary hover:opacity-90`;
  };

  return (
    <div className="flex w-full items-start justify-center gap-6">
      {/* Swap Notification */}
      <AnimatePresence>
        {notification && receiveToken && (
          <SwapNotification
            type={notification}
            sellAmount={sellAmount}
            sellToken={sellToken.symbol}
            receiveAmount={receiveAmount}
            receiveToken={receiveToken.symbol}
            onClose={() => {
              setNotification(null);
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
          className="bg-[#191A1C] border border-border rounded-2xl px-6 pt-6 pb-3 min-h-[520px] flex flex-col"
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
                onClick={() => setIsChartOpen(!isChartOpen)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </motion.button>
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            </div>
          </div>

          {/* Sell Section */}
          <div className="bg-[#151617] rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-2 ">
              <span className="text-sm text-muted-foreground">Sell</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Wallet className="w-4 h-4" />
                <span>
                  {isLoadingBalances
                    ? "Loading..."
                    : `${formatBalance(getTokenBalance(sellToken.symbol).toString())} ${sellToken.symbol}`}
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
                onClear={() => {
                  setSellAmount("0.00");
                  setReceiveAmount("0.00");
                }}
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
                      : `${formatBalance(getTokenBalance(receiveToken.symbol).toString())} ${receiveToken.symbol}`}
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
                onClear={() => setReceiveAmount("0.00")}
                usdValueLabel={effectiveReceiveUsdValueLabel}
              />
            </div>
          </div>

          {/* Action Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={isWalletConnected ? handleSwap : handleConnectWallet}
              disabled={
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
                  receiveToken?.symbol === "EURC" ? sellUsdValueLabel : undefined
                }
              />
            </div>
          )}
        </motion.div>

        {/* Token Quick Access Buttons */}
        <div className="flex items-center justify-center gap-4 mt-4">
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
