"use client";
import { X, Check, XCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface SwapNotificationProps {
  type: "success" | "failed";
  sellAmount: string;
  sellToken: string;
  receiveAmount: string;
  receiveToken: string;
  onClose: () => void;
  transactionHash?: string | null;
  /** On-chain revert reason (e.g. "insufficient allowance") when swap failed */
  revertReason?: string | null;
}

const SwapNotification = ({
  type,
  sellAmount,
  sellToken,
  receiveAmount,
  receiveToken,
  onClose,
  transactionHash,
  revertReason,
}: SwapNotificationProps) => {
  const isSuccess = type === "success";

  const handleViewTransaction = () => {
    if (transactionHash) {
      // Arc Scan Testnet URL
      const arcscanUrl = `https://testnet.arcscan.app/tx/${transactionHash}`;
      window.open(arcscanUrl, "_blank");
    }
  };

  if (isSuccess) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.28 }}
          className="fixed left-1/2 top-6 z-50 w-[min(92vw,22.5rem)] -translate-x-1/2"
        >
          <div className="rounded-[1.75rem] border border-white/10 bg-[#1d1d1f]/90 px-4 py-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1dd75f]">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <h3 className="text-[1.05rem] font-medium text-white">
                  Swap Successful!
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#b7b8bb] transition-colors hover:text-white"
                aria-label="Close swap notification"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 pl-9 text-[0.95rem] leading-6 text-[#e4e4e6]">
              <p>
                Swapped {sellAmount} {sellToken} for
              </p>
              <p>
                {receiveAmount} {receiveToken}
              </p>
            </div>

            <div className="mb-4 flex items-center gap-1.5 pl-9 text-xs text-[#a3a4a8]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#a3a4a8]"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Via Tower</span>
            </div>

            <div className="pl-9">
              <button
                type="button"
                onClick={handleViewTransaction}
                disabled={!transactionHash}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                View Transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.3 }}
      className="fixed left-1/2 top-8 z-50 w-[min(92vw,22rem)] -translate-x-1/2"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1a1d1f] px-5 py-4 shadow-2xl backdrop-blur-md">
        <div className="pt-0.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
            <XCircle className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="mb-1 text-base font-semibold text-white">
            Swap Failed
          </h3>
          <p className="text-sm text-gray-300">
            {revertReason ? revertReason : "Transaction failed or was rejected."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 transition-colors hover:text-white"
          aria-label="Close swap notification"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default SwapNotification;
