"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import Image from "next/image";
import { tokens, type Token } from "@/mockData/token";

interface TokenDropdownProps {
  label: string;
  selected: Token | null;
  onSelect: (token: Token) => void;
  showInfo?: boolean;
  placeholder?: string;
  availableTokens?: Token[];
  disabledTokenSymbols?: string[];
  infoMessage?: string;
}

export const TokenDropdown = ({
  label,
  selected,
  onSelect,
  showInfo = false,
  placeholder = "Select Token",
  availableTokens,
  disabledTokenSymbols = [],
  infoMessage = "Select which token you'll use to make your regular purchases",
}: TokenDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const displayTokens = availableTokens || tokens;
  const disabledSymbols = new Set(
    disabledTokenSymbols.map((symbol) => symbol.toUpperCase()),
  );
  const isTokenDisabled = (symbol: string) =>
    disabledSymbols.has(symbol.toUpperCase());

  useEffect(() => {
    const isTouchEnabled = () => {
      return (
        window.matchMedia("(pointer:coarse)").matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
      );
    };
    setIsTouchDevice(isTouchEnabled());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-info-button]")) {
        setShowTooltip(false);
      }
    };

    if (showTooltip && isTouchDevice) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showTooltip, isTouchDevice]);

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
        <span className="tower-field-label text-sm font-medium">{label}</span>
        {showInfo && (
          <div className="relative group flex items-center">
            <button
              data-info-button
              onClick={() => isTouchDevice && setShowTooltip(!showTooltip)}
              onMouseEnter={() => !isTouchDevice && setShowTooltip(true)}
              onMouseLeave={() => !isTouchDevice && setShowTooltip(false)}
              className="tower-field-label-info flex items-center p-0 transition-opacity hover:opacity-80"
              aria-label={`${label} information`}
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg bg-popover/95 border border-border px-3 py-2 text-xs text-muted-foreground backdrop-blur-md whitespace-normal"
              >
                {infoMessage}
              </motion.div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3.5 text-sm transition-colors hover:bg-accent sm:rounded-xl sm:py-4"
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
              <span className="font-medium text-foreground">{selected.symbol}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="ml-auto"
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-[16px] border border-border bg-popover shadow-xl sm:rounded-[18px]"
              style={
                {
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                } as React.CSSProperties & { WebkitOverflowScrolling?: string }
              }
            >
              {displayTokens.map((token, index) => {
                const disabled = isTokenDisabled(token.symbol);

                return (
                  <motion.button
                    key={token.symbol}
                    type="button"
                    disabled={disabled}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => {
                      if (disabled) {
                        return;
                      }

                      onSelect(token);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      disabled
                        ? "cursor-not-allowed opacity-45"
                        : "hover:bg-accent"
                    }`}
                    aria-disabled={disabled}
                  >
                    <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                      <Image
                        src={token.icon}
                        alt={token.symbol}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>
                    <span className="font-medium text-foreground">{token.symbol}</span>
                    {disabled && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Already selected
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};