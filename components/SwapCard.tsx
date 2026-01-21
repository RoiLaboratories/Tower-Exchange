"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";
import TokenInput from "./reusable/TokenInput";
import SwapNotification from "./SwapNotification";

const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin", balance: 1000 },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum", balance: 2.5 },
  { symbol: "USDT", icon: usdtLogo, name: "Tether", balance: 500 },
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

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);

  // Sync wallet connection with Privy authentication
  useEffect(() => {
    if (authenticated && user) {
      setIsWalletConnected(true);
    } else {
      setIsWalletConnected(false);
    }
  }, [authenticated, user]);

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
      // Mock exchange rate calculation - replace with actual DEX aggregator API
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
      const calculated = (parseFloat(value) * mockRate).toFixed(2);
      setReceiveAmount(calculated);
    } else {
      setReceiveAmount("0.00");
    }
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
      // TODO: Replace with actual swap transaction logic
      // 1. Get quote from DEX aggregator (1inch, 0x, etc.)
      // 2. Check and approve token allowance if needed
      // 3. Execute swap transaction
      // 4. Wait for transaction confirmation

      // Simulate transaction (70% success rate for demo)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const isSuccess = Math.random() > 0.3;

      if (isSuccess) {
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
        }, 3000);
      } else {
        throw new Error("User rejected transaction");
      }
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
                  {isWalletConnected ? sellToken.balance : 0} {sellToken.symbol}
                </span>
                <button className="text-muted-foreground hover:text-foreground">
                  50%
                </button>
                <button className="text-muted-foreground hover:text-foreground">
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
                <span>{isWalletConnected ? receiveToken.balance : "--"}</span>
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
