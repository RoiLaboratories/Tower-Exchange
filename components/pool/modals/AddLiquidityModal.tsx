"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import TokenPairIcon from "@/components/pool/TokenPairIcon";

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd?: () => void | Promise<void>;
  isAdding?: boolean;
  errorMessage?: string | null;
  pair: string;
  token0: string;
  token1: string;
  feeLabel: string;
  rangeLabel: string;
  depositLabel: string;
  currentPrice: string;
  priceUnitLabel: string;
}

export default function AddLiquidityModal({
  isOpen,
  onClose,
  onAdd,
  isAdding = false,
  errorMessage = null,
  pair,
  token0,
  token1,
  feeLabel,
  rangeLabel,
  depositLabel,
  currentPrice,
  priceUnitLabel,
}: AddLiquidityModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (typeof document === "undefined") {
    return null;
  }

  const handleAdd = () => {
    if (!onAdd) {
      onClose();
      return;
    }

    void onAdd();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="add-liquidity-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          style={{
            paddingTop: "max(5.5rem, env(safe-area-inset-top))",
            paddingBottom: "max(6.5rem, env(safe-area-inset-bottom))",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-[480px] rounded-[30px] bg-card px-5 py-4 sm:max-w-[520px] sm:px-6 sm:py-5"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close add liquidity preview"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-foreground transition-opacity hover:opacity-80 sm:right-4 sm:top-3.5"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="pr-8 text-center text-base font-medium text-foreground sm:text-lg">
              Add Liquidity
            </h2>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="inline-flex min-w-0 items-center gap-2">
                <TokenPairIcon token0={token0} token1={token1} size="sm" />
                <span className="truncate text-sm font-medium text-foreground">
                  {pair}
                </span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-light text-[#07D54F] sm:text-sm">
                In range
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#07D54F]"
                  aria-hidden
                />
              </span>
            </div>

            <div className="mt-3 space-y-2 rounded-[20px] bg-card px-3.5 py-3 text-[11px] font-light leading-snug text-muted-foreground shadow-[inset_0_0_0_1px_#2F2F2F] sm:space-y-2.5 sm:px-4 sm:py-3.5 sm:text-xs sm:leading-relaxed">
              <p>
                <span className="font-medium text-foreground">Pool:</span> You&apos;re
                about to add liquidity to the{" "}
                <span className="font-medium text-foreground">{pair}</span> pool and
                earn a share of the{" "}
                <span className="font-medium text-foreground">
                  {feeLabel} trading fees
                </span>{" "}
                whenever users swap between these tokens.
              </p>
              <p>
                <span className="font-medium text-foreground">Range:</span> Your
                liquidity will be active at all price levels (
                <span className="font-medium text-foreground">{rangeLabel}</span>), so
                it can be used for trades regardless of price movements.
              </p>
              <p>
                <span className="font-medium text-foreground">Deposit:</span> You&apos;ll
                add{" "}
                <span className="font-medium text-foreground">{depositLabel}</span> to
                the pool.
              </p>
              <p>
                <span className="font-medium text-foreground">Fee accrual:</span> Swap fees stay in the pair reserves, so your LP tokens represent a pro-rata claim on the larger pool as trading volume flows through it. Indexed APR and USD fee estimates will appear once pool analytics are available.
              </p>
            </div>

            <div className="mt-2.5 rounded-[20px] bg-card px-3.5 py-3 text-center shadow-[inset_0_0_0_1px_#2F2F2F] sm:mt-3 sm:px-4 sm:py-3.5">
              <p className="text-xs font-light text-muted-foreground">Current Price</p>
              <p className="mt-1 text-[26px] font-medium leading-none tracking-tight text-foreground sm:text-[28px]">
                {currentPrice}
              </p>
              <p className="mt-1 text-xs font-light text-muted-foreground">
                {priceUnitLabel}
              </p>
            </div>

            {errorMessage ? (
              <p className="mt-3 rounded-[14px] bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:mt-4 sm:h-12"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}





