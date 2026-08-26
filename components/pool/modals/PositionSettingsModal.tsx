"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";

interface PositionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AUTO_SLIPPAGE = 2.5;

export default function PositionSettingsModal({
  isOpen,
  onClose,
}: PositionSettingsModalProps) {
  const [isAutoSlippage, setIsAutoSlippage] = useState(true);
  const [customSlippage, setCustomSlippage] = useState(String(AUTO_SLIPPAGE));
  const [deadlineMinutes, setDeadlineMinutes] = useState("30");
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="position-settings-backdrop"
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
            role="dialog"
            aria-modal="true"
            aria-label="Position settings"
            className="w-full max-w-[380px] rounded-2xl bg-card px-5 py-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    Max Slippage
                  </span>
                  <span
                    title="Your transaction will revert if the price changes unfavorably by more than this percentage."
                    className="inline-flex text-muted-foreground"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Max slippage information</span>
                  </span>
                </div>

                <div className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-card p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoSlippage(true);
                      setCustomSlippage(String(AUTO_SLIPPAGE));
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      isAutoSlippage
                        ? "bg-[#2A4060] text-[#9EC5FF]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Auto
                  </button>
                  {isAutoSlippage ? (
                    <button
                      type="button"
                      onClick={() => setIsAutoSlippage(false)}
                      className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-xs font-medium text-foreground transition-opacity hover:opacity-80"
                      aria-label="Edit slippage"
                    >
                      {AUTO_SLIPPAGE}%
                    </button>
                  ) : (
                    <label className="inline-flex h-6 min-w-[52px] items-center justify-center gap-0.5 rounded-full px-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={customSlippage}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "" || /^\d{0,2}(\.\d{0,2})?$/.test(value)) {
                            setCustomSlippage(value);
                          }
                        }}
                        onBlur={() => {
                          if (!customSlippage.trim()) {
                            setCustomSlippage(String(AUTO_SLIPPAGE));
                            setIsAutoSlippage(true);
                          }
                        }}
                        className="w-[28px] appearance-none border-0 bg-transparent p-0 text-center text-xs font-medium leading-none text-foreground outline-none ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        aria-label="Custom slippage percent"
                      />
                      <span className="text-xs font-medium leading-none text-foreground">
                        %
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    Tx. Deadline
                  </span>
                  <span
                    title="Your transaction will revert if it is pending for longer than this."
                    className="inline-flex text-muted-foreground"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">
                      Transaction deadline information
                    </span>
                  </span>
                </div>

                <div className="inline-flex h-9 min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-full bg-card px-4">
                  {isEditingDeadline ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={deadlineMinutes}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "" || /^\d{0,4}$/.test(value)) {
                          setDeadlineMinutes(value);
                        }
                      }}
                      onBlur={() => {
                        if (!deadlineMinutes.trim()) {
                          setDeadlineMinutes("30");
                        }
                        setIsEditingDeadline(false);
                      }}
                      className="w-10 appearance-none border-0 bg-transparent p-0 text-center text-xs font-medium leading-none text-foreground outline-none ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Transaction deadline in minutes"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingDeadline(true)}
                      className="min-w-[40px] text-center text-xs font-medium leading-none text-foreground transition-opacity hover:opacity-80"
                      aria-label="Edit transaction deadline"
                    >
                      {deadlineMinutes || "30"}
                    </button>
                  )}
                  <span className="text-xs font-medium leading-none text-foreground">
                    Minutes
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
