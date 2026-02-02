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
}

const SwapNotification = ({
  type,
  sellAmount,
  sellToken,
  receiveAmount,
  receiveToken,
  onClose,
  transactionHash,
}: SwapNotificationProps) => {
  const isSuccess = type === "success";

  const handleViewTransaction = () => {
    if (transactionHash) {
      // Arc Scan Testnet URL
      const arcscanUrl = `https://testnet.arcscan.app/tx/${transactionHash}`;
      window.open(arcscanUrl, "_blank");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.3 }}
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div
        className={`${
          isSuccess ? "bg-[#1a1d1f]" : "bg-[#1a1d1f]"
        } backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3 min-w-[320px] border border-white/10`}
      >
        <div className="pt-0.5">
          {isSuccess ? (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <XCircle className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-white text-base mb-1">
            {isSuccess ? "Swap Successful!" : "Swap Failed"}
          </h3>
          {isSuccess ? (
            <>
              <p className="text-sm text-gray-300">
                Swapped {sellAmount} {sellToken} for
              </p>
              <p className="text-sm text-gray-300 mb-2">
                {receiveAmount} {receiveToken}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-gray-400"
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
              <button
                onClick={handleViewTransaction}
                disabled={!transactionHash}
                className="bg-white text-black text-sm font-medium px-4 py-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                View Transaction
                <ExternalLink className="w-3 h-3" />
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-300">User Rejected Request</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default SwapNotification;
