"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TransactionConfirmation } from "./TransactionConfirmation";

interface AppErrorModalProps {
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  dismissLabel?: string;
  title?: string;
}

export const AppErrorModal = ({
  error,
  onClose,
  onRetry,
  retryLabel = "Try Again",
  dismissLabel = "Close",
  title = "Something went wrong",
}: AppErrorModalProps) => {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#1d1d1f]/90 p-4 shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <TransactionConfirmation
              status="error"
              error={error}
              title={title}
              errorLayout="stacked"
            />

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                {dismissLabel}
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-100"
                >
                  {retryLabel}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
