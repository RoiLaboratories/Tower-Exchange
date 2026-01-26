"use client";
import { X } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import Image from "next/image";

import usdcLogo from "@/public/assets/USDC-fotor-bg-remover-2025111075935.png";
import usdtLogo from "@/public/assets/usdt_logo-removebg-preview.png";
import ethLogo from "@/public/assets/Eth_logo_3-removebg-preview.png";
import uniLogo from "@/public/assets/uniswap-removebg-preview.png";
import hypeLogo from "@/public/assets/hype.png";
import eurcLogo from "@/public/assets/Euro_Coin logo.png";
import swprcLogo from "@/public/assets/swapr_logo.png";
import quantumLogo from "@/public/assets/quantum-logo.png";

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

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  selected: (typeof tokens)[0];
  onSelect: (token: (typeof tokens)[0]) => void;
  excludeSymbol?: string;
}

const TokenModal = ({
  isOpen,
  onClose,
  selected,
  onSelect,
  excludeSymbol,
}: TokenModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setTimeout(() => {
        setSearchQuery("");
      }, 0);
    }
  }, [isOpen]);

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      if (token.symbol === excludeSymbol) return false;

      const matchesSearch =
        !debouncedSearchQuery.trim() ||
        token.symbol
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [debouncedSearchQuery, excludeSymbol]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#18191b] border border-border/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h3 className="text-base font-medium text-foreground/90">
              Select a token
            </h3>
            <motion.button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#191A1C] transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          <div className="p-6">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Token"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1b1e] border-0 rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-border transition-all"
              />
            </div>
          </div>

          <div className="max-h-100 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground/60">
                No tokens found
              </div>
            ) : (
              <div className="px-2 pb-2">
                {filteredTokens.map((token, index) => {
                  const isSelected = selected.symbol === token.symbol;
                  return (
                    <motion.button
                      key={token.symbol}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => {
                        onSelect(token);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg transition-colors group ${
                        isSelected
                          ? "bg-primary/20 hover:bg-primary/30"
                          : "hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden ${
                          isSelected ? "bg-primary/40" : "bg-primary/20"
                        }`}>
                          <Image
                            src={token.icon}
                            alt={`${token.symbol} logo`}
                            width={36}
                            height={36}
                            className="object-contain w-full h-full"
                          />
                        </div>
                        <div className="text-left">
                          <p className={`font-medium text-sm ${
                            isSelected ? "text-primary" : "text-foreground"
                          }`}>
                            {token.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            {token.name}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-primary text-lg font-bold">✓</span>
                      )}
                      {!isSelected && (
                        <span className="text-muted-foreground/40 text-lg">−</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TokenModal;
export { tokens };
export type { TokenModalProps };
