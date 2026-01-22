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
import { usePrivy } from "@privy-io/react-auth";
import { 
  fetchArcBalance, 
  formatBalance, 
  getSwapQuote, 
  prepareSwapTransaction, 
  getPoolInfo 
} from "@/lib/arcNetwork";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import eurcLogo from "@/public/assets/Euro_Coin logo.png";
import swprcLogo from "@/public/assets/swapr_logo.png";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";
import TokenInput from "./reusable/TokenInput";
import SwapNotification from "./SwapNotification";

const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin", balance: 1000 },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum", balance: 2.5 },
  { symbol: "USDT", icon: usdtLogo, name: "Tether", balance: 500 },
  { symbol: "EURC", icon: eurcLogo, name: "Euro Coin", balance: 750 },
  { symbol: "SWPRC", icon: swprcLogo, name: "Swaparc Token", balance: 300 },
  { symbol: "UNI", icon: uniLogo, name: "Uniswap", balance: 50 },
  { symbol: "HYPE", icon: hypeLogo, name: "Hyperliquid", balance: 100 },
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

  // Wallet and transaction states
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [swapState, setSwapState] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [notification, setNotification] = useState<"success" | "failed" | null>(
    null
  );

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
    if (!user?.wallet?.address) return;

    setIsLoadingBalances(true);
    try {
      // Fetch USDC balance from Arc testnet
      const usdcBalance = await fetchArcBalance(user.wallet.address);
      
      if (usdcBalance) {
        setTokenBalances((prev) => ({
          ...prev,
          USDC: parseFloat(formatBalance(usdcBalance)),
        }));
      }

      // TODO: Fetch other token balances
      // For ETH, USDT, EURC, SWPRC, UNI, HYPE - you'll need to:
      // 1. Make RPC calls to get ERC20 token balances using eth_call
      // 2. Call the balanceOf function on each token contract
      // Token Contract Addresses:
      // EURC: 0x... (to be configured)
      // SWPRC: 0x... (to be configured)
      // UNI: 0x... (to be configured)
      // HYPE: 0x... (to be configured)
      // Example:
      // const eurcBalance = await fetchERC20Balance(user.wallet.address, EURC_CONTRACT_ADDRESS);
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

  // Get swap quote from Arc pool
  const getQuoteForSwap = async (sellAmountValue: string) => {
    try {
      // Determine pool pair based on selected tokens
      const poolKey = `${sellToken.symbol}/${receiveToken.symbol}`;
      const poolInfo = getPoolInfo(poolKey);
      
      if (!poolInfo) {
        // If pool doesn't exist, use a fallback mock rate
        const mockRate =
          sellToken.symbol === "ETH"
            ? 1500
            : sellToken.symbol === "USDC"
            ? 1
            : sellToken.symbol === "USDT"
            ? 1
            : sellToken.symbol === "UNI"
            ? 12
            : 8;
        const calculated = (parseFloat(sellAmountValue) * mockRate).toFixed(2);
        setReceiveAmount(calculated);
        return;
      }

      // Convert sell amount to wei (18 decimals)
      const amountInWei = BigInt(parseFloat(sellAmountValue) * 10 ** 18).toString();

      // Get quote from Arc pool (token indices: 0 for first token in pair, 1 for second)
      const quoteInWei = await getSwapQuote(
        poolInfo.address,
        0, // sellToken index
        1, // receiveToken index
        amountInWei
      );

      // Convert quote back from wei to decimal
      const quoteAmount = parseFloat(quoteInWei) / 10 ** 18;
      setReceiveAmount(quoteAmount.toFixed(2));
    } catch (error) {
      console.error("Error getting swap quote:", error);
      // Fallback to mock calculation on error
      const mockRate =
        sellToken.symbol === "ETH"
          ? 1500
          : sellToken.symbol === "USDC"
          ? 1
          : sellToken.symbol === "USDT"
          ? 1
          : sellToken.symbol === "UNI"
          ? 12
          : 8;
      const calculated = (parseFloat(sellAmountValue) * mockRate).toFixed(2);
      setReceiveAmount(calculated);
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

      // Step 1: Get pool info for the swap pair
      const poolKey = `${sellToken.symbol}/${receiveToken.symbol}`;
      const poolInfo = getPoolInfo(poolKey);
      
      if (!poolInfo) {
        throw new Error(`Pool not found for pair: ${poolKey}`);
      }

      // Step 2: Convert amounts to wei (18 decimals)
      const amountInWei = BigInt(parseFloat(sellAmount) * 10 ** 18).toString();
      const minAmountOutWei = BigInt(
        parseFloat(receiveAmount) * 10 ** 18 * 0.99
      ).toString(); // 1% slippage tolerance

      // Step 3: Get quote for the swap
      const expectedAmountOut = await getSwapQuote(
        poolInfo.address,
        0, // Assuming token0 is the sell token
        1, // Assuming token1 is the receive token
        amountInWei
      );

      console.log("Swap quote received:", expectedAmountOut);

      // Step 4: Prepare swap transaction
      const txData = prepareSwapTransaction(
        poolInfo.address,
        0, // tokenInIndex
        1, // tokenOutIndex
        amountInWei,
        minAmountOutWei
      );

      console.log("Transaction prepared:", txData);

      // Step 5: Send transaction to user's wallet via Privy
      // Note: This would typically be handled by the wallet provider
      // For now, we simulate the transaction
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
        // Refresh wallet balances after successful swap
        fetchUserBalances();
      }, 3000);
    } catch (error) {
      console.error("Swap failed:", error);
      setSwapState("failed");
      setNotification("failed");

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
