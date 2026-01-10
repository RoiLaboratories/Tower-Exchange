"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import Image from "next/image";
import { tokens } from "@/mockData/token";

interface TokenDropdownProps {
  label: string;
  selected: any;
  onSelect: (token: any) => void;
  showInfo?: boolean;
  placeholder?: string;
}

export const TokenDropdown = ({
  label,
  selected,
  onSelect,
  showInfo = false,
  placeholder = "Select Token",
}: TokenDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-white">{label}</span>
        {showInfo && <Info className="w-4 h-4 text-gray-500" />}
      </div>
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950 hover:bg-black transition-colors"
        >
          {selected ? (
            <>
              <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src={selected.icon}
                  alt={selected.symbol}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <span className="font-medium text-white">{selected.symbol}</span>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="ml-auto"
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto"
              style={
                {
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                } as React.CSSProperties & { WebkitOverflowScrolling?: string }
              }
            >
              {tokens.map((token, index) => (
                <motion.button
                  key={token.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    onSelect(token);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                    <Image
                      src={token.icon}
                      alt={token.symbol}
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                  <span className="font-medium text-white">{token.symbol}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
