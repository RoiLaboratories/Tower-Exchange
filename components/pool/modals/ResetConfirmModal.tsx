"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: ResetConfirmModalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="reset-confirm-backdrop"
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
            aria-labelledby="reset-confirm-title"
            className="relative w-full max-w-[400px] rounded-2xl bg-card px-5 pb-5 pt-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 pr-8">
              <Image
                src="/assets/reset icon.svg"
                alt=""
                width={28}
                height={28}
                className="mt-0.5 h-7 w-7 shrink-0"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2
                  id="reset-confirm-title"
                  className="text-base font-semibold text-foreground"
                >
                  Are you sure?
                </h2>
                <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
                  Your tokens, price, and range selections will be reset
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close reset confirmation"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-muted text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#E53935] text-sm font-medium text-foreground transition-colors hover:bg-[#D32F2F]"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
