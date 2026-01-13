"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import TokenModal from "./TokenModal";
import SettingsModal from "./SettingsModal";
import ChartModal from "./ChartModal";

const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin" },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum" },
  { symbol: "USDT", icon: usdtLogo, name: "Tether" },
  { symbol: "UNI", icon: uniLogo, name: "Uniswap" },
  { symbol: "HYPE", icon: hypeLogo, name: "Hyperliquid" },
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
  const [sellAmount, setSellAmount] = useState("0.00");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [sellToken, setSellToken] = useState(tokens[0]);
  const [receiveToken, setReceiveToken] = useState(tokens[1]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSellTokenModalOpen, setIsSellTokenModalOpen] = useState(false);
  const [isReceiveTokenModalOpen, setIsReceiveTokenModalOpen] = useState(false);

  const handleSwapTokens = () => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);
    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <AnimatePresence>
        {isChartOpen && (
          <ChartModal
            isOpen={isChartOpen}
            onClose={() => setIsChartOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ x: isChartOpen ? -200 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-[#191A1C] border border-border rounded-2xl p-6"
        whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Swap</h2>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setIsChartOpen(true)}
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

        <div className="bg-[#151617] rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between mb-2 ">
            <span className="text-sm text-muted-foreground">Sell</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>0 {sellToken.symbol}</span>
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
            <div className="text-right">
              <input
                type="text"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="bg-transparent text-2xl font-semibold text-right w-32 outline-none text-foreground"
                placeholder="0.00"
              />
              <p className="text-sm text-muted-foreground">~$0</p>
            </div>
          </div>
        </div>

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

        <div className="bg-[#151617] rounded-xl p-4 mt-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Receive</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>--</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <TokenSelector
              selected={receiveToken}
              onSelect={setReceiveToken}
              excludeSymbol={sellToken.symbol}
              onOpenModal={() => setIsReceiveTokenModalOpen(true)}
            />
            <div className="text-right">
              <input
                type="text"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                className="bg-transparent text-2xl font-semibold text-right w-32 outline-none text-foreground"
                placeholder="0.00"
              />
              <p className="text-sm text-muted-foreground">~$0</p>
            </div>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button className="w-full bg-primary hover:opacity-90 rounded-xl h-14 text-base font-semibold text-black">
            Connect Wallet
          </Button>
        </motion.div>
      </motion.div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <motion.button
          onClick={() => setSellToken(tokens[0])}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
            <Image
              src={tokens[0].icon}
              alt={`${tokens[0].symbol} logo`}
              width={24}
              height={24}
              className="object-contain w-full h-full"
            />
          </div>
          <span className="font-medium text-foreground">USDC</span>
          <span className="text-muted-foreground">$1</span>
        </motion.button>
        <motion.button
          onClick={() => setReceiveToken(tokens[1])}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#191A1C] border border-border hover:bg-secondary transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
            <Image
              src={tokens[1].icon}
              alt={`${tokens[1].symbol} logo`}
              width={24}
              height={24}
              className="object-contain w-full h-full"
            />
          </div>
          <span className="font-medium text-foreground">ETH</span>
          <span className="text-muted-foreground">$1</span>
        </motion.button>
      </div>

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
  );
};

export default SwapCard;
