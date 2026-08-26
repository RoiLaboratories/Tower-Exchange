"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";
import { getTokenIcon } from "@/lib/tokenIcons";

export interface ClaimFeeTokenRow {
  token: string;
  amount: string;
}

interface ClaimFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCollect?: () => void;
  fees?: ClaimFeeTokenRow[];
}

const DEFAULT_FEES: ClaimFeeTokenRow[] = [
  { token: "USDC", amount: "<0" },
  { token: "EURC", amount: "0" },
];

export default function ClaimFeesModal({
  isOpen,
  onClose,
  onCollect,
  fees = DEFAULT_FEES,
}: ClaimFeesModalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const handleCollect = () => {
    onCollect?.();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="claim-fees-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22 }}
            className="relative w-full min-w-0 max-w-[380px] overflow-hidden rounded-[30px] bg-card px-5 pb-5 pt-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close claim fees"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-center text-lg font-medium text-foreground">
              Claim fees
            </h2>

            <div className="mt-5 space-y-3 rounded-[16px] bg-secondary px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              {fees.map((row) => {
                const icon = getTokenIcon(row.token);
                return (
                  <div
                    key={row.token}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="inline-flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-card">
                        {icon ? (
                          <Image
                            src={icon}
                            alt=""
                            width={24}
                            height={24}
                            className="h-full w-full object-contain"
                          />
                        ) : null}
                      </span>
                      <span className="text-sm font-light text-foreground">
                        {row.amount}
                      </span>
                    </div>
                    <span className="text-sm font-light text-foreground">
                      {row.token}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 w-full max-w-full break-words px-1 text-center text-[11px] font-light leading-relaxed text-foreground sm:text-xs">
              Collecting fee will withdraw currently available fees for you.
            </p>

            <button
              type="button"
              onClick={handleCollect}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-black transition-colors hover:bg-primary/90"
            >
              Collect
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
