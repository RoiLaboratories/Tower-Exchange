"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { 
  fetchArcBalance, 
  fetchERC20Balance,
  formatBalance, 
  getSwapQuoteFromQuantumExchange,
  getSwapTransactionFromQuantumExchange,
  TOKEN_CONTRACTS,
  TOKEN_DECIMALS
} from "@/lib/arcNetwork";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import eurcLogo from "@/public/assets/Euro_Coin logo.png";
import swprcLogo from "@/public/assets/swapr_logo.png";
import quantumLogo from "@/public/assets/quantum-logo.png";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";
import TokenInput from "./reusable/TokenInput";
import SwapNotification from "./SwapNotification";

// Tokens available on frontend (includes QuantumExchange supported tokens: USDC, WUSDC, QTM)
const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin", balance: 1000 },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum", balance: 2.5 },
  { symbol: "USDT", icon: usdtLogo, name: "Tether", balance: 500 },
  { symbol: "EURC", icon: eurcLogo, name: "Euro Coin", balance: 750 },
  { symbol: "SWPRC", icon: swprcLogo, name: "Swaparc Token", balance: 300 },
  { symbol: "UNI", icon: uniLogo, name: "Uniswap", balance: 50 },
  { symbol: "HYPE", icon: hypeLogo, name: "Hyperliquid", balance: 100 },
  { symbol: "WUSDC", icon: usdcLogo, name: "Wrapped USDC", balance: 500 },
  { symbol: "QTM", icon: quantumLogo, name: "Quantum", balance: 100 },
];

interface TokenSelectorProps {
  selected: (typeof tokens)[0];
  onSelect: (token: (typeof tokens)[0]) => void;
  excludeSymbol?: string;
  onOpenModal: () => void;
}

const TokenSelector = ({ selected, onOpenModal }: TokenSelectorProps) => {
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

const SwapCard = () => {
  // Privy hook
  const { user, login, authenticated } = usePrivy();
  const { wallets } = useWallets();

  // Wallet and transaction states
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [swapState, setSwapState] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [notification, setNotification] = useState<"success" | "failed" | null>(
    null
  );
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Token and amount states
  const [sellAmount, setSellAmount] = useState("0.00");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [sellToken, setSellToken] = useState(tokens[0]);
  const [receiveToken, setReceiveToken] = useState(tokens[1]);

  // Actual wallet balances
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({
    USDC: 0,
    ETH: 0,
    USDT: 0,
    EURC: 0,
    SWPRC: 0,
    UNI: 0,
    HYPE: 0,
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);

  // Fetch actual wallet balances from Arc testnet
  const fetchUserBalances = useCallback(async () => {
    if (!user?.wallet?.address) {
      console.log("Wallet address not available");
      return;
    }

    console.log("Fetching balances for wallet:", user.wallet.address);
    setIsLoadingBalances(true);
    try {
      // Fetch USDC balance from Arc testnet (native balance)
      const usdcBalance = await fetchArcBalance(user.wallet.address);
      console.log("USDC balance:", usdcBalance);
      
      if (usdcBalance) {
        setTokenBalances((prev) => ({
          ...prev,
          USDC: parseFloat(formatBalance(usdcBalance)),
        }));
      }

      // Fetch EURC balance
      if (TOKEN_CONTRACTS.EURC) {
        console.log("Fetching EURC balance from:", TOKEN_CONTRACTS.EURC);
        const eurcBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.EURC
        );
        console.log("EURC balance (wei):", eurcBalanceWei);
        if (eurcBalanceWei && eurcBalanceWei !== "0x0") {
          const eurcBalance =
            parseInt(eurcBalanceWei, 16) / 10 ** (TOKEN_DECIMALS.EURC || 18);
          console.log("EURC balance (converted):", eurcBalance);
          setTokenBalances((prev) => ({
            ...prev,
            EURC: eurcBalance,
          }));
        }
      }

      // Fetch SWPRC balance
      if (TOKEN_CONTRACTS.SWPRC) {
        console.log("Fetching SWPRC balance from:", TOKEN_CONTRACTS.SWPRC);
        const swprcBalanceWei = await fetchERC20Balance(
          user.wallet.address,
          TOKEN_CONTRACTS.SWPRC
        );
        console.log("SWPRC balance (wei):", swprcBalanceWei);
        if (swprcBalanceWei && swprcBalanceWei !== "0x0") {
          const swprcBalance =
            parseInt(swprcBalanceWei, 16) / 10 ** (TOKEN_DECIMALS.SWPRC || 18);
          console.log("SWPRC balance (converted):", swprcBalance);
          setTokenBalances((prev) => ({
            ...prev,
            SWPRC: swprcBalance,
          }));
        }
      }

      // TODO: Fetch other token balances (ETH, USDT, UNI, HYPE)
      // Add token contract addresses to TOKEN_CONTRACTS and use fetchERC20Balance
    } catch (error) {
      console.error("Failed to fetch wallet balances:", error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [user?.wallet?.address]);

  // Sync wallet connection with Privy authentication
  useEffect(() => {
    if (authenticated && user) {
      setIsWalletConnected(true);
      fetchUserBalances();
    } else {
      setIsWalletConnected(false);
      setTokenBalances({
        USDC: 0,
        ETH: 0,
        USDT: 0,
        EURC: 0,
        SWPRC: 0,
        UNI: 0,
        HYPE: 0,
      });
    }
  }, [authenticated, user, fetchUserBalances]);

  // Get display balance for a token (actual if available, mock otherwise)
  const getTokenBalance = (symbol: string): number => {
    return tokenBalances[symbol] || 0;
  };

  // Check if swap button should be active
  const isSwapActive =
    isWalletConnected &&
    parseFloat(sellAmount) > 0 &&
    sellAmount !== "0.00" &&
    parseFloat(receiveAmount) > 0 &&
    receiveAmount !== "0.00";

  const handleSwapTokens = () => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);
    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  };

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

  // Get swap quote from QuantumExchange API
  const getQuoteForSwap = async (sellAmountValue: string) => {
    try {
      // Get token addresses for the swap
      let tokenInAddress: string | null = null;
      let tokenOutAddress: string | null = null;

      // Map token symbols to contract addresses
      const addressMap: Record<string, string> = TOKEN_CONTRACTS;
      
      if (addressMap[sellToken.symbol]) {
        tokenInAddress = addressMap[sellToken.symbol];
      }

      if (addressMap[receiveToken.symbol]) {
        tokenOutAddress = addressMap[receiveToken.symbol];
      }

      if (!tokenInAddress || !tokenOutAddress) {
        console.warn(
          `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`
        );
        calculateMockRate(sellAmountValue);
        return;
      }

      // Convert sell amount to wei using correct decimals for the sell token
      const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;
      const amountInWei = BigInt(
        parseFloat(sellAmountValue) * 10 ** sellTokenDecimals
      ).toString();

      console.log("Getting quote from QuantumExchange:", {
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
      });

      // Get quote from QuantumExchange API
      const quoteData = await getSwapQuoteFromQuantumExchange(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        0.5 // 0.5% slippage tolerance
      );

      console.log("Quote received from QuantumExchange:", quoteData);

      // Convert quote back from wei using correct decimals for the receive token
      const receiveTokenDecimals = TOKEN_DECIMALS[receiveToken.symbol] || 18;
      const quoteAmount = parseFloat(quoteData.toAmount) / 10 ** receiveTokenDecimals;

      console.log("Quote converted:", {
        receiveTokenDecimals,
        quoteAmount,
        priceImpact: quoteData.priceImpact,
      });

      setReceiveAmount(quoteAmount.toFixed(2));
    } catch (error) {
      console.error("Error getting swap quote:", error);
      // Fallback to mock calculation on error
      calculateMockRate(sellAmountValue);
    }
  };

  // Helper function to calculate using mock rates
  const calculateMockRate = (sellAmountValue: string) => {
    const mockRate =
      sellToken.symbol === "ETH"
        ? 1500
        : sellToken.symbol === "USDC"
        ? 1
        : sellToken.symbol === "USDT"
        ? 1
        : sellToken.symbol === "UNI"
        ? 12
        : sellToken.symbol === "EURC"
        ? 1.05
        : sellToken.symbol === "SWPRC"
        ? 0.5
        : 8;
    const calculated = (parseFloat(sellAmountValue) * mockRate).toFixed(2);
    setReceiveAmount(calculated);
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
    const maxAmount = balance.toFixed(2);
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
      // Trigger Privy login modal
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

    try {
      if (!user?.wallet?.address) {
        throw new Error("Wallet not connected");
      }

      // Get the connected wallet
      const connectedWallet = wallets.find(
        (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
      );

      if (!connectedWallet) {
        throw new Error("Connected wallet not found. Please reconnect your wallet.");
      }

      // Get the provider from the connected wallet
      const eip1193Provider = await connectedWallet.getEthereumProvider();
      
      if (!eip1193Provider) {
        throw new Error("Failed to get wallet provider");
      }

      // Use the EIP1193 provider directly to send transactions
      const userAddress = user.wallet?.address;
      if (!userAddress) {
        throw new Error("User wallet address not available");
      }

      const sendTransactionViaProvider = async (txData: { to: string; value: string; data: string }, txType: string = "transaction") => {
        try {
          console.log(`[${txType}] Sending to provider:`, {
            from: userAddress,
            to: txData.to,
            value: txData.value,
            dataLength: txData.data?.length || 0,
            data: txData.data?.substring(0, 100) + "...",
          });

          const result = await eip1193Provider.request({
            method: 'eth_sendTransaction',
            params: [{
              from: userAddress, // Use the validated address
              to: txData.to,
              value: txData.value,
              data: txData.data,
            }],
          });

          console.log(`[${txType}] Successfully sent, hash:`, result);
          return result as string;
        } catch (error: unknown) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          console.error(`[${txType}] Failed with error:`, {
            message: errorObj.message,
            code: (error as Record<string, unknown>)?.code,
            data: (error as Record<string, unknown>)?.data,
            fullError: error,
          });
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
          `Token address not found for ${sellToken.symbol} or ${receiveToken.symbol}`
        );
      }

      // Step 1: Convert amounts to wei using correct decimals
      const sellTokenDecimals = TOKEN_DECIMALS[sellToken.symbol] || 18;

      const amountInWei = BigInt(
        parseFloat(sellAmount) * 10 ** sellTokenDecimals
      ).toString();

      console.log("Preparing swap via QuantumExchange:", {
        sellToken: sellToken.symbol,
        receiveToken: receiveToken.symbol,
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        walletAddress: user.wallet.address,
        balanceOfSellToken: getTokenBalance(sellToken.symbol),
      });

      // Step 2: Get swap transaction data from QuantumExchange
      const swapData = await getSwapTransactionFromQuantumExchange(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        0.5, // 0.5% slippage
        user.wallet.address
      );

      console.log("Swap transaction data received:", swapData);

      // Step 3: Handle token approval if needed
      if (swapData.approvalAddress && swapData.approvalAmount) {
        console.log("Token approval needed:", {
          approvalAddress: swapData.approvalAddress,
          approvalAmount: swapData.approvalAmount,
        });

        // Send approval transaction via provider
        try {
          console.log("Sending approval transaction...");
          const approveTxHash = await sendTransactionViaProvider({
            to: tokenInAddress,
            value: "0",
            data: swapData.data,
          }, "APPROVAL");

          console.log("Approval transaction sent:", approveTxHash);

          // Wait for approval confirmation
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (approvalError: unknown) {
          const approvalErrorObj = approvalError instanceof Error ? approvalError : new Error(String(approvalError));
          console.error("Approval transaction error details:", {
            message: approvalErrorObj.message,
            code: (approvalError as Record<string, unknown>)?.code,
            data: (approvalError as Record<string, unknown>)?.data,
            fullError: approvalError,
          });
          console.warn("Approval transaction failed or already approved, continuing with swap...");
          // Continue with swap even if approval fails (it might already be approved)
        }
      }

      // Step 4: Send swap transaction via provider
      console.log("Sending swap transaction...");
      console.log("Swap transaction data:", {
        to: swapData.to,
        value: swapData.value,
        dataLength: swapData.data?.length || 0,
      });

      // Try to estimate gas, but don't block if it fails
      // (some RPC endpoints have issues with gas estimation on complex transactions)
      try {
        console.log("Estimating gas...");
        const gasEstimate = await eip1193Provider.request({
          method: 'eth_estimateGas',
          params: [{
            from: userAddress,
            to: swapData.to,
            value: swapData.value,
            data: swapData.data,
          }],
        });
        console.log("Gas estimate successful:", gasEstimate);
      } catch (estimateError: unknown) {
        // Log the error but continue - the wallet will provide its own gas estimation
        const estimateErrorObj = estimateError instanceof Error ? estimateError : new Error(String(estimateError));
        console.error("Gas estimation error details:", {
          message: estimateErrorObj.message,
          code: (estimateError as Record<string, unknown>)?.code,
          data: (estimateError as Record<string, unknown>)?.data,
        });
        console.warn("Gas estimation failed (wallet will estimate)");
      }

      const txHash = await sendTransactionViaProvider({
        to: swapData.to,
        value: swapData.value,
        data: swapData.data,
      }, "SWAP");

      console.log("Swap transaction executed with hash:", txHash);
      
      // Wait for transaction receipt to verify success
      let receipt = null;
      let retries = 0;
      const maxRetries = 30; // Try for up to 30 seconds (1 second intervals)
      
      while (receipt === null && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        try {
          receipt = await eip1193Provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          
          if (receipt) {
            console.log("Transaction receipt received:", receipt);
            
            // Check if transaction was successful (status === '0x1')
            if (receipt.status === '0x0') {
              console.error("Transaction failed! Getting revert reason...");
              
              // Try to get the revert reason by calling eth_call on the failed transaction
              try {
                const tx = await eip1193Provider.request({
                  method: 'eth_getTransactionByHash',
                  params: [txHash],
                });
                
                console.log("Failed transaction data:", tx);
                
                // Try to call the same transaction to get the revert reason
                const callResult = await eip1193Provider.request({
                  method: 'eth_call',
                  params: [
                    {
                      from: tx.from,
                      to: tx.to,
                      value: tx.value,
                      data: tx.input,
                    },
                    'latest'
                  ],
                });
                
                console.log("eth_call result:", callResult);
              } catch (callError: unknown) {
                const callErrorObj = callError instanceof Error ? callError : new Error(String(callError));
                console.error("Revert reason extraction error:", {
                  message: callErrorObj.message,
                  error: callError,
                });
                
                // Try to decode the error message if it's available
                if (callError instanceof Error && callError.message.includes('revert')) {
                  console.error("Revert reason:", callError.message);
                }
              }
              
              throw new Error("Transaction failed on-chain (status: 0x0)");
            }
            break;
          }
        } catch (receiptError: unknown) {
          const receiptErrorObj = receiptError instanceof Error ? receiptError : new Error(String(receiptError));
          // Only throw if it's the "Transaction failed on-chain" error
          if (receiptErrorObj.message.includes("Transaction failed on-chain")) {
            throw receiptError;
          }
          console.error("Error fetching receipt:", receiptError);
        }
        
        retries++;
      }
      
      if (receipt === null) {
        console.warn("Transaction receipt not received after 30 seconds, but hash was confirmed");
      } else if (receipt.status === '0x0') {
        throw new Error("Transaction failed on-chain");
      }
      
      // Store the transaction hash
      setTransactionHash(txHash);
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
        // Refresh wallet balances after successful swap
        fetchUserBalances();
      }, 3000);
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error("Swap transaction error - Full details:", {
        message: errorObj.message,
        code: (error as Record<string, unknown>)?.code,
        data: (error as Record<string, unknown>)?.data,
        stack: errorObj.stack,
        errorObj: error,
      });
      
      setSwapState("failed");
      setNotification("failed");
      setTransactionHash(null);

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);

      setTimeout(() => {
        setSwapState("idle");
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

    if (isWalletConnected && !isSwapActive) {
      return `${baseStyles} bg-[#2a2d31] hover:bg-[#2a2d31] cursor-not-allowed text-gray-500`;
    }

    return `${baseStyles} bg-primary hover:opacity-90`;
  };

  return (
    <div className="flex gap-6 items-start w-full justify-center">
      {/* Swap Notification */}
      <AnimatePresence>
        {notification && (
          <SwapNotification
            type={notification}
            sellAmount={sellAmount}
            sellToken={sellToken.symbol}
            receiveAmount={receiveAmount}
            receiveToken={receiveToken.symbol}
            onClose={() => setNotification(null)}
            transactionHash={transactionHash}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          className="bg-[#191A1C] border border-border rounded-2xl p-6"
          whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Swap</h2>
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span>
                  {isLoadingBalances ? "Loading..." : `${formatBalance(getTokenBalance(sellToken.symbol).toString())} ${sellToken.symbol}`}
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
            <div className="flex items-center justify-between">
              <TokenSelector
                selected={sellToken}
                onSelect={setSellToken}
                excludeSymbol={receiveToken.symbol}
                onOpenModal={() => setIsSellTokenModalOpen(true)}
              />
              <TokenInput
                value={sellAmount}
                onChange={handleSellAmountChange}
                onClear={() => {
                  setSellAmount("0.00");
                  setReceiveAmount("0.00");
                }}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span>{isLoadingBalances ? "Loading..." : `${formatBalance(getTokenBalance(receiveToken.symbol).toString())} ${receiveToken.symbol}`}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <TokenSelector
                selected={receiveToken}
                onSelect={setReceiveToken}
                excludeSymbol={sellToken.symbol}
                onOpenModal={() => setIsReceiveTokenModalOpen(true)}
              />
              <TokenInput
                value={receiveAmount}
                onChange={setReceiveAmount}
                onClear={() => setReceiveAmount("0.00")}
              />
            </div>
          </div>

          {/* Action Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={isWalletConnected ? handleSwap : handleConnectWallet}
              disabled={
                swapState === "loading" || (isWalletConnected && !isSwapActive)
              }
              className={getButtonStyles()}
            >
              {getButtonContent()}
            </Button>
          </motion.div>
        </motion.div>

        {/* Token Quick Access Buttons */}
        <div className="flex items-center justify-center gap-4 mt-6">
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
            <span className="text-muted-foreground">$1</span>
          </motion.button>
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
            <span className="text-muted-foreground">$1</span>
          </motion.button>
        </div>

        {/* Modals */}
        <TokenModal
          isOpen={isSellTokenModalOpen}
          onClose={() => setIsSellTokenModalOpen(false)}
          selected={sellToken}
          onSelect={setSellToken}
          excludeSymbol={receiveToken.symbol}
        />

        <TokenModal
          isOpen={isReceiveTokenModalOpen}
          onClose={() => setIsReceiveTokenModalOpen(false)}
          selected={receiveToken}
          onSelect={setReceiveToken}
          excludeSymbol={sellToken.symbol}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </motion.div>

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
