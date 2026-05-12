"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Tower Exchange DEX Aggregator hook
  const { getQuote, buildSwapTransaction, error: towerError } = useTowerSwap();

  // Wallet and transaction states
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [selectedRouterId, setSelectedRouterId] = useState<string | undefined>(
    undefined,
  );
  const [routeOptions, setRouteOptions] = useState<SwapRouteOption[]>([]);
  const [swapState, setSwapState] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [notification, setNotification] = useState<"success" | "failed" | null>(
    null,
  );
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

  // Check if on Arc Testnet
  const isOnArcTestnet = chainId === ARC_CHAIN_HEX;

  // Function to switch/add Arc Testnet network
  const switchToArcTestnet = async () => {
    const ethereum = getBrowserWalletProvider();

    try {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: ARC_ADD_NETWORK_PARAMS,
        });
      } catch (addOrUpdateError) {
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
      const switchErrorCode =
        switchError && typeof switchError === "object" && "code" in switchError
          ? (switchError as { code?: number }).code
          : undefined;
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
  const receiveUsdValueLabel = formatUsdAmount(
    receiveAmount,
    receiveToken?.usdPrice ?? 0,
  );

  const fetchSwapTokenBalance = useCallback(async (tokenSymbol: SwapTokenSymbol) => {
    const tokenAddress = TOKEN_CONTRACTS[tokenSymbol];

      if (!tokenAddress || !user?.wallet?.address) {
        return 0;
      }

      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: user.wallet.address,
          chainId: "arc-testnet",
          rpcUrl: ARC_TESTNET_CONFIG.rpcUrl,
          tokenAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || `Failed to fetch ${tokenSymbol} balance`,
        );
      }

      return Number.parseFloat(data?.balance ?? "0") || 0;
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

        if (!routerId && quoteData.route?.hops?.[0]?.dexId) {
          setSelectedRouterId(quoteData.route.hops[0].dexId);
          console.log(
            "Auto-selected router from backend:",
            quoteData.route.hops[0].dexName,
            "ID:",
            quoteData.route.hops[0].dexId,
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

  // Handle swap transaction
  const handleSwap = async () => {
    setSwapState("loading");
    setRevertReason(null);

    try {
      if (!user?.wallet?.address) {
        throw new Error("Wallet not connected");
      }

      const eip1193Provider = getBrowserWalletProvider();

      if (!receiveToken) {
        throw new Error("Please select a receive token");
      }

      if (!isSupportedSwapPair(sellToken.symbol, receiveToken.symbol)) {
        throw new Error("This token pair is not currently supported on Tower Swap.");
      }

      // Check if on correct network
      if (!isOnArcTestnet) {
        try {
          await switchToArcTestnet();
          // Wait a moment for chain switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // Re-check chain ID
          const currentChainId = await getBrowserWalletChainId(eip1193Provider);
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
          });

          // Get current chain ID to include in transaction
          const currentChainId = await eip1193Provider.request({
            method: "eth_chainId",
          });

          if (currentChainId !== ARC_CHAIN_HEX) {
            throw new Error(
              `Invalid chain ID. Expected ${ARC_CHAIN_HEX} (Arc Testnet), got ${currentChainId}. Please switch to Arc Testnet.`,
            );
          }

          const result = await eip1193Provider.request({
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
                ...(txData.gas
                  ? {
                      gas:
                        typeof txData.gas === "string"
                          ? txData.gas
                          : toHexQuantity(txData.gas),
                    }
                  : {}),
              },
            ],
          });

          console.log(`[${txType}] Successfully sent, hash:`, result);
          return result as string;
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
      const quote = await getQuote(
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

            console.log(`Sending ${approvalLabel} transaction to MetaMask...`);
            const approveTxHash = await sendTransactionViaProvider(
              {
                to: approvalTx.to,
                data: approvalTx.data,
                value: "0x0",
                gas: approvalTx.gasLimit,
              },
              approvalLabel,
            );

            console.log(`${approvalLabel} transaction sent:`, approveTxHash);

            // Wait for approval confirmation - poll until receipt is found
            let approvalReceipt: BrowserWalletTransactionReceipt | null = null;
            let approvalRetries = 0;
            const maxApprovalRetries = 30; // Wait up to 30 seconds

            while (
              approvalReceipt === null &&
              approvalRetries < maxApprovalRetries
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000));

              try {
                approvalReceipt = (await eip1193Provider.request({
                  method: "eth_getTransactionReceipt",
                  params: [approveTxHash],
                })) as BrowserWalletTransactionReceipt | null;

                if (approvalReceipt) {
                  if (approvalReceipt.status === "0x0") {
                    throw new Error(
                      `${approvalLabel} transaction failed on-chain`,
                    );
                  }
                  console.log(
                    `${approvalLabel} transaction confirmed:`,
                    approvalReceipt,
                  );
                  break;
                }
              } catch {
                // Continue polling
              }

              approvalRetries++;
            }

            if (!approvalReceipt) {
              throw new Error(
                `${approvalLabel} transaction not confirmed after 30 seconds`,
              );
            }

            // Additional wait to ensure block is finalized
            await new Promise((resolve) => setTimeout(resolve, 2000));
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

      // Try to estimate gas, but don't block if it fails
      // (some RPC endpoints have issues with gas estimation on complex transactions)
      try {
        console.log("Estimating gas...");
        const gasEstimate = await eip1193Provider.request({
          method: "eth_estimateGas",
          params: [
            {
              from: userAddress,
              to: swapDataToSend.to,
              value: swapDataToSend.value,
              data: swapDataToSend.data,
            },
          ],
        });
        console.log("Gas estimate successful:", gasEstimate);
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
        console.warn("Gas estimation failed (wallet will estimate)");
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
          // Per Tower Router convention, use the provided gasLimit when available
          gas: swapDataToSend.gasLimit ?? undefined,
        },
        "SWAP",
      );

      console.log("Swap transaction executed with hash:", txHash);

      // Wait for transaction receipt to verify success
      let receipt: BrowserWalletTransactionReceipt | null = null;
      let retries = 0;
      const maxRetries = 30; // Try for up to 30 seconds (1 second intervals)

      while (receipt === null && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          receipt = (await eip1193Provider.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          })) as BrowserWalletTransactionReceipt | null;

          if (receipt) {
            console.log("Transaction receipt received:", receipt);

            // Check if transaction was successful (status === '0x1')
            if (receipt.status === "0x0") {
              console.error("Transaction failed! Getting revert reason...");
              let decodedReason: string | null = null;

              try {
                const tx = (await eip1193Provider.request({
                  method: "eth_getTransactionByHash",
                  params: [txHash],
                })) as {
                  from?: string;
                  to?: string;
                  value?: string;
                  input?: string;
                } | null;

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
            break;
          }
        } catch (receiptError: unknown) {
          const receiptErrorObj =
            receiptError instanceof Error
              ? receiptError
              : new Error(String(receiptError));
          // Rethrow our "Transaction failed" errors so the outer catch can show the decoded reason
          if (receiptErrorObj.message.startsWith("Transaction failed")) {
            throw receiptError;
          }
          console.error("Error fetching receipt:", receiptError);
        }

        retries++;
      }

      if (receipt === null) {
        console.warn(
          "Transaction receipt not received after 30 seconds, but hash was confirmed",
        );
      } else if (receipt.status === "0x0") {
        throw new Error("Transaction failed on-chain");
      }

      // Store the transaction hash
      setTransactionHash(txHash);
      setRevertReason(null);

      // Log successful swap activity
      logSwapActivity("Successful", txHash);

      // Step 8: Submit platform fee with atomic distribution through FeeCollector
      // Swap output went to FeeCollector, now execute atomic fee split
      const feeCollectorOutput = swapTx?.expectedFeeCollectorOutput;
      console.log("[SwapCard] Fee collection check:", {
        hasExpectedFeeCollectorOutput: !!feeCollectorOutput,
        feeCollectorOutput: feeCollectorOutput,
        platformFeeAmount: swapTx?.platformFeeAmount,
        expectedUserOutput: swapTx?.expectedUserOutput,
        isNativeUSDC: sellToken.symbol === "USDC",
      });

      if (feeCollectorOutput && feeCollectorOutput !== "0") {
        const outputTokenForFee = tokenOutAddress || quote.outputToken;
        const feeSubmitUrl = "/api/swap/submit-fee";

        console.log("[SwapCard] Submitting fee with atomic distribution:", {
          outputToken: outputTokenForFee,
          totalAmount: feeCollectorOutput,
          userAddress: userAddress,
          feeSubmitUrl,
          sellToken: sellToken.symbol,
        });

        try {
          const feeResponse = await fetch(feeSubmitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outputToken: outputTokenForFee,
              totalAmount: feeCollectorOutput, // Full amount that FeeCollector received
              userAddress: userAddress, // User address to receive (amount - fee)
              feeBps: 25, // 0.25% = 25 basis points
            }),
          });

          if (!feeResponse.ok) {
            const feeError = await feeResponse.text();
            console.error("[SwapCard] Fee submission response not OK:", {
              status: feeResponse.status,
              error: feeError,
            });
            throw new Error(
              `Fee distribution failed (${feeResponse.status}): ${feeError}`,
            );
          } else {
            const feeResult = await feeResponse.json();
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
                totalAmount: feeCollectorOutput,
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
              console.log(
                "[SwapCard] Waiting for fee distribution transaction to finalize:",
                feeDistributionTxHash,
              );

              // Poll for fee distribution confirmation (up to 30 seconds)
              let feeDistributionConfirmed = false;
              for (let attempt = 0; attempt < 30; attempt++) {
                try {
                  const feeReceipt = (await eip1193Provider.request({
                    method: "eth_getTransactionReceipt",
                    params: [feeDistributionTxHash],
                  })) as { status: string; blockNumber: string } | null;

                  if (feeReceipt && feeReceipt.status === "0x1") {
                    console.log(
                      "[SwapCard] Fee distribution transaction confirmed!",
                    );
                    feeDistributionConfirmed = true;

                    // Update fee confirmation status with block number
                    if (
                      registerResult &&
                      registerResult.success &&
                      registerResult.id
                    ) {
                      const blockNumber = parseInt(feeReceipt.blockNumber, 16);
                      await updateSwapFeeConfirmation(
                        registerResult.id,
                        feeDistributionTxHash,
                        blockNumber,
                      ).catch((err) => {
                        console.warn(
                          "[SwapCard] Failed to update fee confirmation:",
                          err,
                        );
                      });
                    }
                    break;
                  }
                } catch {
                  // Continue polling
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }

              if (feeDistributionConfirmed) {
                console.log(
                  "[SwapCard] Refreshing balance after fee distribution confirmed",
                );
                // Immediate balance refresh after fee distribution is confirmed
                await fetchUserBalances();
              } else {
                console.warn(
                  "[SwapCard] Fee distribution transaction not confirmed within timeout - will refresh anyway",
                );
              }
            }
          }
        } catch (feeError: unknown) {
          console.error(
            "[SwapCard] Error submitting fee with atomic distribution:",
            {
              message:
                feeError instanceof Error ? feeError.message : String(feeError),
              outputToken: outputTokenForFee,
              totalAmount: feeCollectorOutput,
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

      setSwapState("success");
      setNotification("success");

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);

      // Reset amounts after success
      setTimeout(() => {
        setSellAmount("0.00");
        setReceiveAmount("0.00");
        setSwapState("idle");
        setTransactionHash(null);
        // Refresh wallet balances after successful swap (second pass as fallback)
        // This ensures balance is updated even if fee distribution was not monitored
        fetchUserBalances();
      }, 3000);
    } catch (error: unknown) {
      // Better error serialization for swap errors
      let errorDetails: Record<string, unknown> = {
        context: "handleSwap",
        timestamp: new Date().toISOString(),
        sellToken: sellToken.symbol,
        receiveToken: receiveToken?.symbol || "Not Selected",
        sellAmount,
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
      setTransactionHash(null);

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

    if (swapState === "loading") {
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
                onClick={() =>
                  onNavigateToBridge
                    ? onNavigateToBridge()
                    : router.push("/bridge")
                }
                className="px-3 py-1.5 text-xs font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-[#1b1d21] transition-colors"
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
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
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
                usdValueLabel={receiveUsdValueLabel}
              />
            </div>
          </div>

          {/* Action Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={isWalletConnected ? handleSwap : handleConnectWallet}
              disabled={
                swapState === "loading" ||
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
              {sellToken.symbol === "EURC" ? "$1.15" : "$1"}
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
                {receiveToken.symbol === "EURC" ? "$1.15" : "$1"}
              </span>
            </motion.button>
          )}
        </div>

        {/* Modals */}
        <TokenModal
          isOpen={isSellTokenModalOpen}
          onClose={() => setIsSellTokenModalOpen(false)}
          selected={sellToken}
          onSelect={setSellToken}
          excludeSymbol={receiveToken?.symbol || ""}
          availableTokens={availableSellTokens}
          tokenBalances={tokenBalances}
        />

        <TokenModal
          isOpen={isReceiveTokenModalOpen}
          onClose={() => setIsReceiveTokenModalOpen(false)}
          selected={receiveToken || availableReceiveTokens[0] || sellToken}
          onSelect={setReceiveToken}
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
