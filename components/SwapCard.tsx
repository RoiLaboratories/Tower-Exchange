"use client";
import {
  ArrowDown,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image, { StaticImageData } from "next/image";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";

const tokens = [
  { symbol: "USDC", icon: usdcLogo, name: "USD Coin" },
  { symbol: "ETH", icon: ethLogo, name: "Ethereum" },
  { symbol: "USDT", icon: usdtLogo, name: "Tether" },
  { symbol: "UNI", icon: uniLogo, name: "Uniswap" },
  { symbol: "HYPE", icon: hypeLogo, name: "Hyperliquid" },
];

interface TokenDropdownProps {
  selected: (typeof tokens)[0];
  onSelect: (token: (typeof tokens)[0]) => void;
  excludeSymbol?: string;
}

const TokenDropdown = ({
  selected,
  onSelect,
  excludeSymbol,
}: TokenDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTokens = tokens.filter((t) => t.symbol !== excludeSymbol);

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
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
        <span className="font-medium">{selected.symbol}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="py-2">
              {filteredTokens.map((token, index) => (
                <motion.button
                  key={token.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    onSelect(token);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors ${
                    token.symbol === selected.symbol ? "bg-secondary" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
                    <Image
                      src={token.icon}
                      alt={`${token.symbol} logo`}
                      width={32}
                      height={32}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">
                      {token.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {token.name}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SwapCard = () => {
  const [sellAmount, setSellAmount] = useState("0.00");
  const [receiveAmount, setReceiveAmount] = useState("0.00");
  const [sellToken, setSellToken] = useState(tokens[0]);
  const [receiveToken, setReceiveToken] = useState(tokens[1]);

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
      <motion.div
        className="bg-card border border-border rounded-2xl p-6"
        whileHover={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.1)" }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Swap</h2>
          <div className="flex items-center gap-2">
            <motion.button
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            <motion.button
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Sell Input */}
        <div className="bg-input rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Sell</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>0 ARC</span>
              <button className="text-muted-foreground hover:text-foreground">
                50%
              </button>
              <button className="text-muted-foreground hover:text-foreground">
                Max
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <TokenDropdown
              selected={sellToken}
              onSelect={setSellToken}
              excludeSymbol={receiveToken.symbol}
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

        {/* Swap Arrow */}
        <div className="flex justify-center -my-3 relative z-10">
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

        {/* Receive Input */}
        <div className="bg-input rounded-xl p-4 mt-2 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Receive</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>--</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <TokenDropdown
              selected={receiveToken}
              onSelect={setReceiveToken}
              excludeSymbol={sellToken.symbol}
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

        {/* Connect Wallet Button */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button className="w-full gradient-primary hover:opacity-90 rounded-xl h-14 text-base font-semibold">
            Connect Wallet
          </Button>
        </motion.div>
      </motion.div>

      {/* Quick Token Buttons */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <motion.button
          onClick={() => setSellToken(tokens[0])}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-secondary/50 border border-border hover:bg-secondary transition-colors"
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
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-secondary/50 border border-border hover:bg-secondary transition-colors"
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
    </motion.div>
  );
};

export default SwapCard;
